import express from 'express';
import fs from 'fs';
import path from 'path';
import { crud } from '../utils/crud.js';
import { guard, allowRoles } from '../middleware/auth.js';
import { scopes } from '../services/scope.js';
import { projectFinancials, finFor } from '../services/finance.js';
import { stockLevels } from '../services/stock.js';
import {
  Project, Task, DailyReport, Room, Document, Boq, Quotation, Material, Attendance, WorkOrder, Ticket,
} from '../models/index.js';
import { ApiError, isValidId, startOfDay } from '../utils/helpers.js';

const router = express.Router();
const P = (path, select = 'name code') => ({ path, select });

/* ---------------- Projects ---------------- */
router.use(
  '/projects',
  guard('projects'),
  crud(Project, {
    populate: [P('client', 'name code phone email'), P('manager', 'name email phone'), P('team', 'name role'), P('quotation', 'code version grandTotal')],
    search: ['name', 'code', 'siteAddress', 'city'],
    filters: ['status', 'projectType', 'client', 'manager'],
    scope: scopes.projects,
    beforeDelete: async (doc) => {
      if (await Task.exists({ project: doc._id })) throw new ApiError(400, 'Project has tasks. Mark it Cancelled instead of deleting.');
    },
    extend: (r, { findScoped }) => {
      r.get('/:id/summary', async (req, res) => {
        const project = await findScoped(req);
        const id = project._id;
        const today = startOfDay();
        const [fin, taskAgg, overdue, boq, reports, stock, materials, labourDays, workOrders] = await Promise.all([
          projectFinancials([id]),
          Task.aggregate([{ $match: { project: id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
          Task.countDocuments({ project: id, status: { $ne: 'Done' }, dueDate: { $lt: today } }),
          Boq.findOne({ project: id }).select('code costTotal materialTotal labourTotal otherExpenses total').lean(),
          DailyReport.find({ project: id }).sort('-date').limit(5).populate('submittedBy', 'name').lean(),
          stockLevels({ location: String(id) }),
          Material.find().select('name unit code category rate').lean(),
          Attendance.aggregate([
            { $match: { project: id, status: { $ne: 'Absent' } } },
            { $group: { _id: null, days: { $sum: { $cond: [{ $eq: ['$status', 'Half Day'] }, 0.5, 1] } } } },
          ]),
          WorkOrder.find({ project: id }).populate('subcontractor', 'name').select('code title contractAmount progress status').lean(),
        ]);
        const matMap = new Map(materials.map((m) => [String(m._id), m]));
        const tasks = Object.fromEntries(taskAgg.map((t) => [t._id, t.count]));
        res.json({
          finance: finFor(fin, id),
          tasks: { ...tasks, total: taskAgg.reduce((s, t) => s + t.count, 0), overdue },
          boq,
          reports,
          labourDays: labourDays[0]?.days || 0,
          workOrders,
          stock: stock
            .filter((s) => s.quantity !== 0)
            .map((s) => ({ ...s, material: matMap.get(s.material) })),
        });
      });
    },
  }),
);

/* ---------------- Tasks ---------------- */
router.use(
  '/tasks',
  guard('tasks'),
  crud(Task, {
    populate: [P('project'), P('assignedTo', 'name role'), P('dependsOn', 'title code status')],
    search: ['title', 'code', 'area', 'team'],
    filters: ['project', 'status', 'priority', 'assignedTo', 'area'],
    dateField: 'dueDate',
    sort: 'dueDate',
    scope: scopes.tasks,
    queryFilter: (q) => {
      if (q.overdue === 'true') return { status: { $ne: 'Done' }, dueDate: { $lt: startOfDay() } };
      if (q.open === 'true') return { status: { $ne: 'Done' } };
      return {};
    },
    beforeSave: async (doc) => {
      if (doc.dependsOn?.some((d) => String(d) === String(doc._id))) throw new ApiError(400, 'A task cannot depend on itself');
      if (doc.isModified('status') && ['In Progress', 'Done'].includes(doc.status) && doc.dependsOn?.length) {
        const blocking = await Task.find({ _id: { $in: doc.dependsOn }, status: { $ne: 'Done' } }).select('title').lean();
        if (blocking.length) {
          throw new ApiError(400, `Blocked by unfinished dependency: ${blocking.map((b) => b.title).join(', ')}`);
        }
      }
    },
    // Finishing a rework task resolves the service ticket it came from
    afterSave: async (doc) => {
      if (doc.status !== 'Done') return;
      await Ticket.updateMany({ task: doc._id, status: { $in: ['Open', 'In Progress'] } }, { status: 'Resolved', resolvedAt: new Date() });
    },
  }),
);

/* ---------------- Daily Site Reports ---------------- */
router.use(
  '/daily-reports',
  guard('dailyReports'),
  crud(DailyReport, {
    populate: [P('project'), P('submittedBy', 'name role')],
    search: ['code', 'workDone', 'issues'],
    filters: ['project', 'status', 'submittedBy'],
    dateField: 'date',
    sort: '-date',
    scope: scopes.byProject,
    sanitize: (body, req, isNew) => (isNew ? { ...body, submittedBy: req.user._id } : body),
    beforeSave: async (doc, _req, isNew) => {
      if (isNew && doc.progress == null) doc.progress = (await Project.findById(doc.project).lean())?.progress;
    },
  }),
);

/* ---------------- Interior Rooms ---------------- */
router.post('/rooms/:id/respond', allowRoles('Client', 'Project Manager', 'Designer'), async (req, res) => {
  if (!isValidId(req.params.id)) throw new ApiError(400, 'Invalid id');
  const room = await Room.findOne({ _id: req.params.id, ...(await scopes.byProject(req.user)) });
  if (!room) throw new ApiError(404, 'Room not found');
  const { action, comments } = req.body;
  if (action === 'approve') {
    room.designStatus = 'Approved';
    room.approvedAt = new Date();
  } else {
    if (!comments) throw new ApiError(400, 'Please describe the changes required');
    room.designStatus = 'Changes Requested';
    room.revisions.push({
      version: room.revisions.length + 1,
      notes: comments,
      requestedBy: req.user.role === 'Client' ? 'Client' : 'Internal',
    });
  }
  if (comments) room.clientComments = comments;
  await room.save();
  res.json(room);
});

router.use(
  '/rooms',
  guard('rooms'),
  crud(Room, {
    populate: [P('project'), P('designer', 'name')],
    search: ['name', 'roomType', 'customWork'],
    filters: ['project', 'designStatus', 'roomType', 'designer'],
    sort: 'createdAt',
    scope: scopes.byProject,
    extend: (r, { findScoped }) => {
      r.post('/:id/submit', async (req, res) => {
        const room = await findScoped(req);
        room.designStatus = 'Pending Approval';
        await room.save();
        res.json(room);
      });
    },
  }),
);

/* ---------------- Documents & Photos ---------------- */
router.use(
  '/documents',
  guard('documents'),
  crud(Document, {
    populate: [P('project'), P('room', 'name'), P('uploadedBy', 'name')],
    search: ['title', 'fileName', 'notes'],
    filters: ['project', 'category', 'room'],
    scope: scopes.byProject,
    sanitize: (body, req, isNew) => (isNew ? { ...body, uploadedBy: req.user._id } : body),
    beforeDelete: async (doc) => {
      if (doc.fileUrl?.includes('/uploads/')) {
        const file = path.resolve('uploads', path.basename(doc.fileUrl));
        fs.promises.unlink(file).catch(() => {});
      }
    },
  }),
);

// Quotation lookup for project detail (kept here to avoid exposing all quotations)
router.get('/projects/:id/quotation', guard('projects'), async (req, res) => {
  const p = await Project.findOne({ _id: req.params.id, ...(await scopes.projects(req.user)) }).lean();
  if (!p) throw new ApiError(404, 'Project not found');
  res.json(p.quotation ? await Quotation.findById(p.quotation).lean() : null);
});

export default router;
