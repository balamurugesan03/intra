import express from 'express';
import { crud } from '../utils/crud.js';
import { guard, allowRoles } from '../middleware/auth.js';
import { scopes } from '../services/scope.js';
import { projectFinancials, totalsOf } from '../services/finance.js';
import { Lead, Client, SiteVisit, Boq, Quotation, Project, Activity, Ticket, Bill } from '../models/index.js';
import { LEAD_STATUS } from '../config/constants.js';
import { ApiError, round2, isValidId } from '../utils/helpers.js';

const router = express.Router();
const P = (path, select = 'name code') => ({ path, select });

/** Moves a lead forward in the funnel (never backwards, never out of Won/Lost). */
export async function advanceLead({ lead, client }, status) {
  const doc = lead ? await Lead.findById(lead) : client ? await Lead.findOne({ client }) : null;
  if (!doc || ['Won', 'Lost'].includes(doc.status)) return;
  if (status === 'Won' || LEAD_STATUS.indexOf(status) > LEAD_STATUS.indexOf(doc.status)) {
    doc.status = status;
    await doc.save();
  }
}

/* ---------------- Leads ---------------- */
router.use(
  '/leads',
  guard('leads'),
  crud(Lead, {
    populate: [P('assignedTo', 'name'), P('client')],
    search: ['name', 'phone', 'email', 'code', 'location', 'company'],
    filters: ['status', 'source', 'projectType', 'assignedTo'],
    dateField: 'createdAt',
    extend: (r, { findScoped }) => {
      // Lead -> Client conversion
      r.post('/:id/convert', async (req, res) => {
        const lead = await findScoped(req);
        if (lead.client) return res.json(await Client.findById(lead.client));
        const client = await Client.create({
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          company: lead.company,
          address: lead.location,
          lead: lead._id,
          notes: lead.requirement,
        });
        lead.client = client._id;
        if (lead.status === 'New') lead.status = 'Contacted';
        await lead.save();
        // Earlier calls / meetings now belong to the client's history too
        await Activity.updateMany({ lead: lead._id, client: null }, { client: client._id });
        res.status(201).json(client);
      });
    },
  }),
);

/* ---------------- Clients ---------------- */
router.use(
  '/clients',
  guard('clients'),
  crud(Client, {
    populate: [P('lead')],
    search: ['name', 'phone', 'email', 'code', 'company', 'city'],
    filters: ['city'],
    beforeDelete: async (doc) => {
      if (await Project.exists({ client: doc._id })) throw new ApiError(400, 'Client has projects and cannot be deleted');
    },
    extend: (r, { findScoped }) => {
      // Client 360°: the whole relationship from enquiry to after-sales on one page
      r.get('/:id/summary', async (req, res) => {
        const client = await findScoped(req);
        const id = client._id;
        const [leads, visits, quotes, projects, outstanding, activities, openTickets] = await Promise.all([
          Lead.find({ $or: [{ client: id }, ...(client.lead ? [{ _id: client.lead }] : [])] }).select('code name status source budget followUpDate createdAt').lean(),
          SiteVisit.countDocuments({ client: id }),
          Quotation.find({ client: id, status: { $ne: 'Revised' } }).select('status grandTotal').lean(),
          Project.find({ client: id }).select('code name status progress contractValue').lean(),
          Bill.aggregate([
            { $match: { client: id, billType: 'Client', status: { $nin: ['Draft', 'Cancelled'] } } },
            { $group: { _id: null, sum: { $sum: '$balance' } } },
          ]),
          Activity.find({ $or: [{ client: id }, ...(client.lead ? [{ lead: client.lead }] : [])] }).populate('by', 'name').sort('-date').limit(8).lean(),
          Ticket.countDocuments({ client: id, status: { $in: ['Open', 'In Progress'] } }),
        ]);
        const fin = projects.length ? totalsOf(await projectFinancials(projects.map((p) => p._id))) : { billed: 0, received: 0 };
        res.json({
          leads,
          projects,
          activities,
          counts: {
            siteVisits: visits,
            quotations: quotes.length,
            approvedQuotes: quotes.filter((q) => ['Approved', 'Converted'].includes(q.status)).length,
            projects: projects.length,
            openTickets,
          },
          finance: {
            quoted: round2(quotes.reduce((s, q) => s + (q.grandTotal || 0), 0)),
            contractValue: round2(projects.reduce((s, p) => s + (p.contractValue || 0), 0)),
            billed: fin.billed,
            received: fin.received,
            outstanding: round2(outstanding[0]?.sum || 0),
          },
        });
      });
    },
  }),
);

/* ---------------- Site Visits ---------------- */
router.use(
  '/site-visits',
  guard('siteVisits'),
  crud(SiteVisit, {
    populate: [P('lead'), P('client'), P('visitedBy', 'name')],
    search: ['code', 'address', 'requirement'],
    filters: ['status', 'lead', 'client', 'visitedBy'],
    dateField: 'date',
    sort: '-date',
    beforeSave: async (doc) => {
      if (doc.lead && !doc.client) {
        const lead = await Lead.findById(doc.lead).lean();
        if (lead?.client) doc.client = lead.client;
        if (lead && !doc.address) doc.address = lead.location;
      }
    },
    afterSave: (doc) => advanceLead(doc, 'Site Visit'),
  }),
);

/* ---------------- BOQ / Estimation ---------------- */
router.use(
  '/boq',
  guard('boq'),
  crud(Boq, {
    populate: [P('client'), P('lead'), P('siteVisit', 'code date'), P('project')],
    search: ['title', 'code'],
    filters: ['status', 'client', 'lead', 'project', 'projectType'],
    beforeSave: async (doc) => {
      if (doc.siteVisit && (!doc.client || !doc.lead)) {
        const sv = await SiteVisit.findById(doc.siteVisit).lean();
        doc.client = doc.client || sv?.client;
        doc.lead = doc.lead || sv?.lead;
      }
      if (doc.lead && !doc.client) doc.client = (await Lead.findById(doc.lead).lean())?.client;
    },
    afterSave: (doc) => advanceLead(doc, 'Estimation'),
    extend: (r, { findScoped }) => {
      // BOQ -> Quotation: rates carry the profit margin, overheads become a lump-sum line.
      r.post('/:id/quotation', async (req, res) => {
        const boq = await findScoped(req);
        if (!boq.client) throw new ApiError(400, 'Link a client to this BOQ before creating a quotation');
        if (!boq.items.length) throw new ApiError(400, 'BOQ has no items');
        const m = 1 + Number(boq.profitMargin || 0) / 100;
        const items = boq.items.map((it) => ({
          area: it.area,
          description: it.description,
          unit: it.unit,
          quantity: it.quantity,
          rate: round2((it.materialRate + it.labourRate) * m),
        }));
        if (boq.otherExpenses > 0) {
          items.push({ description: 'Site overheads, transport & miscellaneous', unit: 'LS', quantity: 1, rate: round2(boq.otherExpenses * m) });
        }
        const client = await Client.findById(boq.client).lean();
        const q = await Quotation.create({
          title: boq.title,
          client: boq.client,
          lead: boq.lead,
          boq: boq._id,
          projectType: boq.projectType,
          siteAddress: client?.address,
          items,
          validUntil: new Date(Date.now() + 30 * 864e5),
        });
        boq.status = 'Final';
        await boq.save();
        await advanceLead(boq, 'Quoted');
        res.status(201).json(q);
      });
    },
  }),
);

/* ---------------- Quotations ---------------- */
// Client-facing approve / reject (clients only see their own, non-draft quotations)
router.post('/quotations/:id/respond', allowRoles('Client', 'Project Manager', 'Estimator'), async (req, res) => {
  if (!isValidId(req.params.id)) throw new ApiError(400, 'Invalid id');
  const { action, notes } = req.body;
  const q = await Quotation.findOne({ _id: req.params.id, ...(await scopes.quotations(req.user)) });
  if (!q) throw new ApiError(404, 'Quotation not found');
  if (q.status !== 'Sent') throw new ApiError(400, 'Only quotations that are sent can be approved or rejected');
  q.status = action === 'approve' ? 'Approved' : 'Rejected';
  if (notes) q.notes = [q.notes, `${req.user.name}: ${notes}`].filter(Boolean).join('\n');
  await q.save();
  if (q.status === 'Rejected') await advanceLead(q, 'Quoted');
  res.json(q);
});

router.use(
  '/quotations',
  guard('quotations'),
  crud(Quotation, {
    populate: [P('client', 'name code phone email address gstin'), P('boq', 'code title costTotal'), P('project'), P('lead')],
    search: ['title', 'code', 'baseCode'],
    filters: ['status', 'client', 'projectType', 'baseCode', 'boq'],
    scope: scopes.quotations,
    beforeSave: async (doc) => {
      if (['Converted'].includes(doc.status) && doc.isModified('items')) {
        throw new ApiError(400, 'Converted quotations are locked. Create a revision instead.');
      }
    },
    afterSave: (doc) => advanceLead(doc, 'Quoted'),
    extend: (r, { findScoped }) => {
      r.post('/:id/send', async (req, res) => {
        const q = await findScoped(req);
        if (!['Draft', 'Rejected'].includes(q.status)) throw new ApiError(400, `Quotation is already ${q.status}`);
        q.status = 'Sent';
        await q.save();
        res.json(q);
      });

      // New version of a quotation (keeps history)
      r.post('/:id/revise', async (req, res) => {
        const q = await findScoped(req);
        if (q.status === 'Converted') throw new ApiError(400, 'Quotation already converted to a project');
        const latest = await Quotation.findOne({ baseCode: q.baseCode }).sort('-version').lean();
        const copy = q.toObject();
        for (const k of ['_id', 'id', 'code', 'createdAt', 'updatedAt', 'approvedAt', '__v']) delete copy[k];
        copy.items = copy.items.map(({ _id, ...it }) => it);
        const revision = await Quotation.create({ ...copy, version: (latest?.version || q.version) + 1, status: 'Draft' });
        q.status = 'Revised';
        await q.save();
        res.status(201).json(revision);
      });

      // Approved quotation -> Project
      r.post('/:id/convert', async (req, res) => {
        const q = await findScoped(req);
        if (q.status !== 'Approved') throw new ApiError(400, 'Only approved quotations can be converted to a project');
        const boq = q.boq ? await Boq.findById(q.boq) : null;
        const b = req.body || {};
        const project = await Project.create({
          name: b.name || q.title,
          client: q.client,
          projectType: q.projectType,
          siteAddress: b.siteAddress || q.siteAddress,
          city: b.city,
          startDate: b.startDate || new Date(),
          endDate: b.endDate,
          manager: b.manager || (req.user.role === 'Project Manager' ? req.user._id : undefined),
          contractValue: q.grandTotal,
          budget: b.budget || boq?.costTotal || round2(q.taxable * 0.8),
          quotation: q._id,
          status: 'Ongoing',
        });
        q.status = 'Converted';
        q.project = project._id;
        await q.save();
        if (boq) {
          boq.project = project._id;
          await boq.save();
        }
        await advanceLead(q, 'Won');
        res.status(201).json(project);
      });
    },
  }),
);

export default router;
