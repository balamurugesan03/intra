import express from 'express';
import { crud } from '../utils/crud.js';
import { guard } from '../middleware/auth.js';
import { scopes } from '../services/scope.js';
import { Activity, Ticket, Lead, Project, Quotation, Task } from '../models/index.js';
import { ApiError, endOfDay } from '../utils/helpers.js';

const router = express.Router();
const P = (path, select = 'name code') => ({ path, select });

/* ---------------- Activities & follow-ups ---------------- */
router.use(
  '/activities',
  guard('activities'),
  crud(Activity, {
    populate: [P('lead', 'name code phone status'), P('client', 'name code phone'), P('quotation', 'code version title'), P('by', 'name')],
    search: ['subject', 'code', 'outcome', 'nextAction'],
    filters: ['type', 'status', 'lead', 'client', 'quotation', 'by'],
    dateField: 'date',
    sort: '-date',
    queryFilter: (q) => (q.due === 'true' ? { status: 'Open', nextFollowUp: { $lte: endOfDay() } } : {}),
    sanitize: (body, req, isNew) => (isNew ? { ...body, by: req.user._id } : body),
    beforeSave: async (doc) => {
      if (doc.quotation && !doc.client) doc.client = (await Quotation.findById(doc.quotation).lean())?.client;
      if (doc.lead && !doc.client) doc.client = (await Lead.findById(doc.lead).lean())?.client;
      if (!doc.lead && !doc.client) throw new ApiError(400, 'Select a lead or client');
    },
    afterSave: async (doc, _req, isNew) => {
      if (!isNew) return;
      // A new interaction closes the earlier pending follow-ups with the same lead / client
      await Activity.updateMany({ ...(doc.lead ? { lead: doc.lead } : { client: doc.client }), _id: { $ne: doc._id }, status: 'Open' }, { status: 'Done' });
      // ...and drives the lead's next follow-up date
      const lead = doc.lead ? await Lead.findById(doc.lead) : await Lead.findOne({ client: doc.client });
      if (!lead || ['Won', 'Lost'].includes(lead.status)) return;
      lead.followUpDate = doc.nextFollowUp || undefined;
      if (lead.status === 'New') lead.status = 'Contacted';
      await lead.save();
    },
  }),
);

/* ---------------- Service tickets (complaints, snags, warranty) ---------------- */
const isClient = (u) => u.role === 'Client';

router.use(
  '/tickets',
  guard('tickets'),
  crud(Ticket, {
    populate: [P('client', 'name code phone'), P('project', 'name code siteAddress'), P('assignedTo', 'name'), P('raisedBy', 'name role'), P('task', 'code title status')],
    search: ['title', 'code', 'description', 'location'],
    filters: ['status', 'category', 'priority', 'client', 'project', 'assignedTo'],
    dateField: 'createdAt',
    queryFilter: (q) => (q.open === 'true' ? { status: { $in: ['Open', 'In Progress'] } } : {}),
    scope: scopes.tickets,
    sanitize: (body, req, isNew) => {
      if (isClient(req.user)) {
        // Clients raise and describe tickets; assignment and resolution stay with the team
        for (const k of ['status', 'assignedTo', 'resolution', 'dueDate', 'task', 'client']) delete body[k];
        if (!isNew) delete body.project;
      }
      return isNew ? { ...body, raisedBy: req.user._id, ...(isClient(req.user) ? { client: req.user.client } : {}) } : body;
    },
    beforeSave: async (doc, req) => {
      if (doc.project) {
        const p = await Project.findById(doc.project).lean();
        if (!p) throw new ApiError(400, 'Project not found');
        if (isClient(req.user) && String(p.client) !== String(req.user.client)) throw new ApiError(403, 'Select one of your projects');
        doc.client = p.client;
      }
      if (!doc.client) throw new ApiError(400, 'Select a client or project');
    },
    beforeDelete: async (_doc, req) => {
      if (isClient(req.user)) throw new ApiError(403, 'Please ask the team to withdraw this ticket');
    },
    extend: (r, { findScoped, fetchPopulated }) => {
      // Snag / complaint -> rework task on the project. Completing the task resolves the ticket.
      r.post('/:id/task', async (req, res) => {
        if (isClient(req.user)) throw new ApiError(403, 'Access denied');
        const t = await findScoped(req);
        if (!t.project) throw new ApiError(400, 'Link the ticket to a project first');
        if (t.task) throw new ApiError(400, 'A rework task already exists for this ticket');
        const task = await Task.create({
          project: t.project,
          title: `${t.code}: ${t.title}`,
          area: t.location,
          description: t.description,
          priority: t.priority,
          dueDate: t.dueDate,
          assignedTo: t.assignedTo,
        });
        t.task = task._id;
        t.status = 'In Progress';
        await t.save();
        res.status(201).json(await fetchPopulated(t._id));
      });
    },
  }),
);

export default router;
