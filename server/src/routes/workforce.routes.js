import express from 'express';
import { crud } from '../utils/crud.js';
import { guard } from '../middleware/auth.js';
import { scopes } from '../services/scope.js';
import { Worker, Attendance, Subcontractor, WorkOrder, Measurement, Project, Bill, Payment } from '../models/index.js';
import { ApiError, round2, dayKey } from '../utils/helpers.js';

const router = express.Router();
const P = (path, select = 'name code') => ({ path, select });

/** Attendance not yet paid out, grouped per worker & site, for a site and/or period. */
async function unpaidWages({ project, from, to, workers }) {
  const match = { payment: null, wage: { $gt: 0 } };
  if (project) match.project = project;
  if (workers?.length) match.worker = { $in: workers };
  if (from || to) match.date = { ...(from && { $gte: dayKey(from) }), ...(to && { $lte: dayKey(to) }) };
  const rows = await Attendance.find(match).populate('worker', 'name code trade').populate('project', 'name code').sort('date').lean();
  const groups = new Map();
  for (const a of rows) {
    if (!a.worker || !a.project) continue;
    const k = `${a.worker._id}-${a.project._id}`;
    if (!groups.has(k)) groups.set(k, { worker: a.worker, project: a.project, days: 0, otHours: 0, amount: 0, from: a.date, to: a.date, ids: [] });
    const g = groups.get(k);
    g.days += a.status === 'Present' ? 1 : a.status === 'Half Day' ? 0.5 : 0;
    g.otHours += a.otHours || 0;
    g.amount = round2(g.amount + a.wage);
    g.to = a.date;
    g.ids.push(a._id);
  }
  return [...groups.values()].sort((a, b) => a.project.code.localeCompare(b.project.code) || a.worker.name.localeCompare(b.worker.name));
}

// Pay out unpaid wages: one Labour Wages payment per worker & site, attendance rows get locked to it
router.post('/attendance/settle', guard('payments'), async (req, res) => {
  const { project, from, to, workers, date = new Date(), mode = 'Cash', reference } = req.body || {};
  const groups = await unpaidWages({ project, from, to, workers });
  if (!groups.length) throw new ApiError(400, 'No unpaid wages for this selection');
  for (const g of groups) {
    const pay = await Payment.create({
      category: 'Labour Wages', worker: g.worker._id, project: g.project._id, amount: g.amount, date, mode, reference,
      notes: `Wages ${g.from.toISOString().slice(0, 10)} to ${g.to.toISOString().slice(0, 10)} · ${g.days} day(s), ${g.otHours} OT hr(s)`,
      recordedBy: req.user._id,
    });
    await Attendance.updateMany({ _id: { $in: g.ids } }, { payment: pay._id });
  }
  res.json({ payments: groups.length, amount: round2(groups.reduce((s, g) => s + g.amount, 0)) });
});

/* ---------------- Workers ---------------- */
router.use(
  '/workers',
  guard('workers'),
  crud(Worker, {
    populate: [P('subcontractor'), P('currentProject')],
    search: ['name', 'code', 'phone', 'trade'],
    filters: ['skillType', 'trade', 'active', 'currentProject', 'subcontractor'],
    sort: 'name',
    beforeDelete: async (doc) => {
      if (await Attendance.exists({ worker: doc._id })) throw new ApiError(400, 'Worker has attendance records. Mark inactive instead.');
    },
  }),
);

/* ---------------- Attendance ---------------- */
router.use(
  '/attendance',
  guard('attendance'),
  crud(Attendance, {
    populate: [P('worker', 'name code trade skillType dailyWage'), P('project')],
    filters: ['project', 'worker', 'status'],
    dateField: 'date',
    sort: '-date',
    sanitize: (body, req, isNew) => ({
      ...body,
      ...(body.date || isNew ? { date: dayKey(body.date) } : {}),
      markedBy: req.user._id,
    }),
    beforeSave: async (doc, _req, isNew) => {
      if (!isNew && doc.payment && (doc.isModified('status') || doc.isModified('otHours'))) throw new ApiError(400, 'Wages for this day are already paid');
    },
    beforeDelete: async (doc) => {
      if (doc.payment) throw new ApiError(400, 'Wages for this day are already paid');
    },
    extend: (r) => {
      r.get('/wages', async (req, res) => {
        const items = await unpaidWages(req.query);
        res.json({ items: items.map(({ ids, ...g }) => ({ ...g, entries: ids.length })), total: round2(items.reduce((s, g) => s + g.amount, 0)) });
      });

      // Daily muster sheet: every active worker + their attendance for the day
      r.get('/sheet', async (req, res) => {
        const date = dayKey(req.query.date);
        const { project } = req.query;
        if (!project) throw new ApiError(400, 'Select a project');
        const [workers, marks] = await Promise.all([
          Worker.find({ active: true }).populate('currentProject', 'name code').sort('name').lean(),
          Attendance.find({ date }).lean(),
        ]);
        const byWorker = new Map(marks.map((m) => [String(m.worker), m]));
        const rows = workers
          .map((w) => ({ worker: w, attendance: byWorker.get(String(w._id)) || null }))
          // show workers of this site first, then others
          .sort((a, b) => {
            const pa = String(a.worker.currentProject?._id) === project ? 0 : 1;
            const pb = String(b.worker.currentProject?._id) === project ? 0 : 1;
            return pa - pb;
          });
        res.json({ date, rows });
      });

      r.post('/bulk', async (req, res) => {
        const { project, entries = [] } = req.body;
        const date = dayKey(req.body.date);
        if (!project) throw new ApiError(400, 'Select a project');
        let saved = 0;
        for (const e of entries) {
          if (!e.worker || !e.status) continue;
          let doc = await Attendance.findOne({ date, worker: e.worker });
          if (doc && String(doc.project) !== String(project)) {
            const w = await Worker.findById(e.worker).lean();
            throw new ApiError(400, `${w?.name} is already marked at another site on this date`);
          }
          if (doc?.payment) continue; // wage already paid, the day is locked
          doc = doc || new Attendance({ date, worker: e.worker, project });
          doc.set({ status: e.status, otHours: Number(e.otHours || 0), remarks: e.remarks, markedBy: req.user._id });
          await doc.save();
          saved++;
        }
        res.json({ saved });
      });
    },
  }),
);

/* ---------------- Subcontractors ---------------- */
router.use(
  '/subcontractors',
  guard('subcontractors'),
  crud(Subcontractor, {
    search: ['name', 'code', 'company', 'trade', 'phone'],
    filters: ['trade'],
    sort: 'name',
    beforeDelete: async (doc) => {
      if (await WorkOrder.exists({ subcontractor: doc._id })) throw new ApiError(400, 'Subcontractor has work orders and cannot be deleted');
    },
  }),
);

/* ---------------- Work Orders ---------------- */
router.use(
  '/work-orders',
  guard('workOrders'),
  crud(WorkOrder, {
    populate: [P('subcontractor', 'name code phone'), P('project')],
    search: ['title', 'code', 'scope'],
    filters: ['subcontractor', 'project', 'status'],
    scope: scopes.workOrders,
    extend: (r, { findScoped }) => {
      r.get('/:id/account', async (req, res) => {
        const wo = await findScoped(req);
        const [measured, bills] = await Promise.all([
          Measurement.aggregate([{ $match: { workOrder: wo._id } }, { $group: { _id: null, sum: { $sum: '$total' } } }]),
          Bill.find({ workOrder: wo._id, status: { $ne: 'Cancelled' } }).select('code total paidAmount balance status billDate').lean(),
        ]);
        const billed = round2(bills.reduce((s, b) => s + b.total, 0));
        const paid = round2(bills.reduce((s, b) => s + b.paidAmount, 0));
        res.json({ contractAmount: wo.contractAmount, measured: round2(measured[0]?.sum || 0), billed, paid, outstanding: round2(billed - paid), bills });
      });
    },
  }),
);

/* ---------------- Measurement Book ---------------- */
router.use(
  '/measurements',
  guard('measurements'),
  crud(Measurement, {
    populate: [P('project', 'name code client'), P('workOrder', 'code title'), P('subcontractor'), P('measuredBy', 'name'), P('bill', 'code total status')],
    search: ['code', 'remarks'],
    filters: ['project', 'measurementType', 'status', 'subcontractor', 'workOrder'],
    dateField: 'date',
    sort: '-date',
    scope: scopes.measurements,
    sanitize: (body, req, isNew) => (isNew ? { ...body, measuredBy: req.user._id } : body),
    beforeSave: async (doc) => {
      if (doc.status === 'Billed' && doc.isModified('items')) throw new ApiError(400, 'Billed measurements are locked');
      if (doc.workOrder) {
        const wo = await WorkOrder.findById(doc.workOrder).lean();
        if (wo) {
          doc.measurementType = 'Contractor';
          doc.subcontractor = wo.subcontractor;
          doc.project = doc.project || wo.project;
        }
      }
      if (doc.measurementType === 'Contractor' && !doc.subcontractor) throw new ApiError(400, 'Select the work order / subcontractor');
    },
    extend: (r, { findScoped, fetchPopulated }) => {
      r.post('/:id/verify', async (req, res) => {
        const m = await findScoped(req);
        if (m.status !== 'Draft') throw new ApiError(400, `Measurement is already ${m.status}`);
        m.status = 'Verified';
        await m.save();
        res.json(await fetchPopulated(m._id));
      });

      // Verified measurement -> Client invoice or Contractor bill (progress-based billing)
      r.post('/:id/bill', async (req, res) => {
        const m = await findScoped(req);
        if (m.status !== 'Verified') throw new ApiError(400, 'Verify the measurement before billing');
        const project = await Project.findById(m.project).lean();
        const isClient = m.measurementType === 'Client';
        const bill = await Bill.create({
          billType: isClient ? 'Client' : 'Contractor',
          project: m.project,
          client: isClient ? project.client : undefined,
          subcontractor: isClient ? undefined : m.subcontractor,
          workOrder: m.workOrder,
          measurement: m._id,
          dueDate: new Date(Date.now() + (isClient ? 15 : 30) * 864e5),
          gstPercent: req.body.gstPercent ?? (isClient ? 18 : 0),
          retentionPercent: req.body.retentionPercent ?? (isClient ? 0 : 5),
          items: m.items.map((it) => ({
            description: [it.description, it.area].filter(Boolean).join(' – '),
            unit: it.unit,
            quantity: it.quantity,
            rate: it.rate,
          })),
          notes: `Running bill against measurement ${m.code}`,
        });
        m.status = 'Billed';
        m.bill = bill._id;
        await m.save();
        res.status(201).json(bill);
      });
    },
  }),
);

// Contractor ledger: payments made
router.get('/subcontractors/:id/ledger', guard('subcontractors'), async (req, res) => {
  const [bills, payments] = await Promise.all([
    Bill.find({ subcontractor: req.params.id, status: { $ne: 'Cancelled' } }).populate('project', 'name code').sort('-billDate').lean(),
    Payment.find({ subcontractor: req.params.id }).sort('-date').lean(),
  ]);
  res.json({ bills, payments });
});

export default router;
