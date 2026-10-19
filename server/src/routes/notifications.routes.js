import express from 'express';
import { hasPermission, isHR } from '../config/permissions.js';
import { visibleProjectIds } from '../services/scope.js';
import { stockLevels } from '../services/stock.js';
import {
  Task, Bill, Material, Project, Quotation, Room, MaterialRequest, PurchaseOrder, Lead, Measurement, Activity, Ticket, Employee, Leave,
  Payroll,
} from '../models/index.js';
import { startOfDay, addDays, endOfDay } from '../utils/helpers.js';

const router = express.Router();
const money = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const days = (d) => Math.round((startOfDay() - startOfDay(d)) / 864e5);

/**
 * Notifications are derived live from data, so they are always accurate
 * and need no background jobs. Each user only sees alerts for modules they can access.
 */
router.get('/notifications', async (req, res) => {
  const u = req.user;
  const can = (m, a = 'view') => hasPermission(u.role, m, a);
  const ids = await visibleProjectIds(u);
  const pf = ids ? { project: { $in: ids } } : {};
  const today = startOfDay();
  const out = [];
  const push = (n) => out.push({ id: `${n.type}-${n.ref}`, ...n });
  const jobs = [];

  if (can('tasks')) {
    const tf = u.role === 'Worker' ? { assignedTo: u._id } : pf;
    jobs.push(
      Task.find({ ...tf, status: { $ne: 'Done' }, dueDate: { $lte: endOfDay(addDays(today, 2)) } })
        .populate('project', 'name code').sort('dueDate').limit(30).lean()
        .then((rows) => rows.forEach((t) => {
          const late = t.dueDate < today;
          push({
            type: 'task', ref: t._id, severity: late ? 'high' : 'medium', category: 'Task reminder',
            title: late ? `Overdue: ${t.title}` : `Due soon: ${t.title}`,
            message: `${t.project?.code} · ${late ? `${days(t.dueDate)} day(s) late` : 'due within 2 days'}`,
            date: t.dueDate, link: `/projects/${t.project?._id}?tab=tasks`,
          });
        })),
    );
  }

  if (can('bills')) {
    const bf = u.role === 'Client' ? { client: u.client, billType: 'Client' } : u.role === 'Contractor' ? { subcontractor: u.subcontractor, billType: 'Contractor' } : {};
    jobs.push(
      Bill.find({ ...bf, balance: { $gt: 0 }, status: { $nin: ['Draft', 'Cancelled'] }, dueDate: { $lte: endOfDay(addDays(today, 5)) } })
        .populate('client', 'name').populate('vendor', 'name').populate('subcontractor', 'name').sort('dueDate').limit(30).lean()
        .then((rows) => rows.forEach((b) => {
          const party = b.client?.name || b.vendor?.name || b.subcontractor?.name;
          const late = b.dueDate < today;
          const label = b.billType === 'Client' ? 'Payment due from' : b.billType === 'Contractor' ? 'Contractor payment to' : 'Vendor payment to';
          push({
            type: 'bill', ref: b._id, severity: late ? 'high' : 'medium', category: 'Payment reminder',
            title: `${label} ${party}`,
            message: `${b.code} · ${money(b.balance)} ${late ? `overdue by ${days(b.dueDate)} day(s)` : 'due soon'}`,
            date: b.dueDate, link: `/finance/bills/${b._id}`,
          });
        })),
    );
  }

  if (can('stock')) {
    jobs.push(
      Promise.all([Material.find({ minStock: { $gt: 0 } }).lean(), stockLevels()]).then(([mats, levels]) => {
        const tot = new Map();
        for (const l of levels) tot.set(l.material, (tot.get(l.material) || 0) + l.quantity);
        for (const m of mats) {
          const q = tot.get(String(m._id)) || 0;
          if (q < m.minStock) {
            push({
              type: 'stock', ref: m._id, severity: q <= 0 ? 'high' : 'medium', category: 'Material shortage',
              title: `Low stock: ${m.name}`, message: `${q} ${m.unit} available · minimum ${m.minStock}`,
              date: new Date(), link: '/inventory/stock',
            });
          }
        }
      }),
    );
  }

  if (can('projects')) {
    jobs.push(
      Project.find({ ...(ids ? { _id: { $in: ids } } : {}), status: { $in: ['Planning', 'Ongoing', 'On Hold'] }, endDate: { $lte: addDays(today, 14) } })
        .lean().then((rows) => rows.forEach((p) => {
          const late = p.endDate < today;
          push({
            type: 'deadline', ref: p._id, severity: late ? 'high' : 'low', category: 'Project deadline',
            title: late ? `Deadline passed: ${p.name}` : `Deadline approaching: ${p.name}`,
            message: `${p.code} · ${p.progress}% complete`, date: p.endDate, link: `/projects/${p._id}`,
          });
        })),
    );
  }

  if (can('quotations')) {
    const qf = u.role === 'Client' ? { client: u.client } : {};
    jobs.push(
      Quotation.find({ ...qf, status: 'Sent' }).populate('client', 'name').lean().then((rows) => rows.forEach((q) => push({
        type: 'quote', ref: q._id, severity: 'medium', category: 'Approval pending',
        title: u.role === 'Client' ? `Quotation awaiting your approval` : `Quotation awaiting client approval`,
        message: `${q.code} v${q.version} · ${q.client?.name} · ${money(q.grandTotal)}`, date: q.updatedAt, link: `/quotations/${q._id}`,
      }))),
    );
  }

  if (can('rooms')) {
    jobs.push(
      Room.find({ ...pf, designStatus: { $in: ['Pending Approval', 'Changes Requested'] } }).populate('project', 'name code').lean()
        .then((rows) => rows.forEach((r) => push({
          type: 'design', ref: r._id, severity: 'low', category: 'Approval pending',
          title: r.designStatus === 'Pending Approval' ? `Design approval pending: ${r.name}` : `Client requested changes: ${r.name}`,
          message: r.project?.name, date: r.updatedAt, link: `/interior?project=${r.project?._id}`,
        }))),
    );
  }

  if (can('materialRequests', 'edit')) {
    jobs.push(
      MaterialRequest.find({ ...pf, status: { $in: ['Pending', 'Approved'] } }).populate('project', 'name code').lean()
        .then((rows) => rows.forEach((m) => push({
          type: 'mr', ref: m._id, severity: m.priority === 'Critical' || m.priority === 'High' ? 'high' : 'low', category: 'Purchase pending',
          title: `Material request ${m.status === 'Pending' ? 'awaiting approval' : 'awaiting PO'}: ${m.code}`,
          message: `${m.project?.code} · ${m.items.length} item(s) · ${m.priority} priority`, date: m.requiredDate || m.createdAt, link: '/inventory/requests',
        }))),
    );
  }

  if (can('purchaseOrders', 'edit')) {
    jobs.push(
      PurchaseOrder.find({ status: { $in: ['Draft', 'Approved', 'Partially Received'] } }).populate('vendor', 'name').lean()
        .then((rows) => rows.forEach((p) => {
          const late = p.expectedDate && p.expectedDate < today && p.status !== 'Draft';
          if (p.status !== 'Draft' && !late) return;
          push({
            type: 'po', ref: p._id, severity: late ? 'medium' : 'low', category: 'Purchase pending',
            title: p.status === 'Draft' ? `PO awaiting approval: ${p.code}` : `Delivery delayed: ${p.code}`,
            message: `${p.vendor?.name} · ${money(p.total)}`, date: p.expectedDate || p.createdAt, link: `/purchase/orders/${p._id}`,
          });
        })),
    );
  }

  if (can('leads')) {
    jobs.push(
      Lead.find({ status: { $nin: ['Won', 'Lost'] }, followUpDate: { $lte: endOfDay(today) } }).lean()
        .then((rows) => rows.forEach((l) => push({
          type: 'lead', ref: l._id, severity: 'medium', category: 'Client follow-up',
          title: `Follow up with ${l.name}`, message: `${l.code} · ${l.status} · ${l.phone}`, date: l.followUpDate, link: '/leads',
        }))),
    );
  }

  if (can('measurements', 'edit')) {
    jobs.push(
      Measurement.find({ ...pf, status: 'Verified' }).populate('project', 'name code').lean()
        .then((rows) => rows.forEach((m) => push({
          type: 'mb', ref: m._id, severity: 'low', category: 'Billing pending',
          title: `Measurement ready to bill: ${m.code}`, message: `${m.project?.code} · ${m.measurementType} · ${money(m.total)}`,
          date: m.date, link: '/measurements',
        }))),
    );
  }

  if (can('activities')) {
    // Follow-ups with clients that have no open lead (lead follow-ups are covered above)
    jobs.push(
      Activity.find({ status: 'Open', lead: null, nextFollowUp: { $lte: endOfDay(today) } }).populate('client', 'name phone').lean()
        .then((rows) => rows.forEach((a) => push({
          type: 'activity', ref: a._id, severity: 'medium', category: 'Client follow-up',
          title: `Follow up with ${a.client?.name}`, message: `${a.nextAction || a.subject} · ${a.client?.phone || ''}`, date: a.nextFollowUp, link: '/crm/activities?status=Open',
        }))),
    );
  }

  if (can('tickets')) {
    const tf = u.role === 'Client' ? { client: u.client } : {};
    jobs.push(
      Ticket.find({ ...tf, status: { $in: ['Open', 'In Progress'] } }).populate('project', 'name code').lean()
        .then((rows) => rows.forEach((t) => {
          const late = t.dueDate && t.dueDate < today;
          if (u.role !== 'Client' && !late && !['High', 'Critical'].includes(t.priority) && t.status !== 'Open') return;
          push({
            type: 'ticket', ref: t._id, severity: late || t.priority === 'Critical' ? 'high' : 'medium', category: 'Service ticket',
            title: `${late ? 'Overdue: ' : ''}${t.title}`, message: `${t.code} · ${t.project?.name || ''} · ${t.status}`,
            date: t.dueDate || t.createdAt, link: '/crm/tickets',
          });
        })),
    );
  }

  if (can('leaves', 'edit')) {
    // HR sees every pending leave; a manager sees their direct reports'
    jobs.push(
      (async () => {
        let ef = {};
        if (!isHR(u.role)) {
          const me = await Employee.findOne({ user: u._id }).lean();
          if (!me) return;
          ef = { employee: { $in: await Employee.find({ reportingTo: me._id }).distinct('_id') } };
        }
        const rows = await Leave.find({ ...ef, status: 'Pending' }).populate('employee', 'name').lean();
        rows.forEach((l) => push({
          type: 'leave', ref: l._id, severity: 'medium', category: 'Approval pending',
          title: `Leave approval: ${l.employee?.name}`, message: `${l.leaveType} · ${l.days} day(s) from ${l.from.toISOString().slice(0, 10)}`,
          date: l.createdAt, link: '/hr/leaves?status=Pending',
        }));
      })(),
    );
  }

  if (can('payroll', 'edit')) {
    const prev = new Date(Date.UTC(today.getFullYear(), today.getMonth() - 1, 1)).toISOString().slice(0, 7);
    jobs.push(
      Promise.all([Payroll.findOne({ month: prev }).lean(), Employee.exists({ status: { $ne: 'Exited' } })]).then(([p, staff]) => {
        if (!staff || p?.status === 'Paid') return;
        push({
          type: 'payroll', ref: prev, severity: 'medium', category: 'Payroll',
          title: p ? `Payroll ${prev} is ${p.status} — salaries not paid yet` : `Run payroll for ${prev}`,
          message: p ? `${p.code} · net ${money(p.net)}` : 'Attendance and leave for last month are ready to process',
          date: today, link: p ? `/hr/payroll/${p._id}` : '/hr/payroll',
        });
      }),
    );
  }

  await Promise.all(jobs);
  const rank = { high: 0, medium: 1, low: 2 };
  out.sort((a, b) => rank[a.severity] - rank[b.severity] || new Date(a.date) - new Date(b.date));
  res.json({ items: out, total: out.length });
});

export default router;
