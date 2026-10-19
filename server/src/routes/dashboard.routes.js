import express from 'express';
import { guard } from '../middleware/auth.js';
import { visibleProjectIds } from '../services/scope.js';
import { projectFinancials, finFor, totalsOf } from '../services/finance.js';
import { stockLevels } from '../services/stock.js';
import {
  Project, Task, Payment, Expense, DailyReport, Lead, Client, SiteVisit, Boq, Quotation, Material, Bill, Measurement,
  Activity, Ticket, Employee, Leave, Payroll, Attendance,
} from '../models/index.js';
import { startOfDay, addDays, round2 } from '../utils/helpers.js';

const router = express.Router();

router.get('/dashboard', guard('dashboard'), async (req, res) => {
  const ids = await visibleProjectIds(req.user);
  const external = ids !== null;
  const pFilter = external ? { _id: { $in: ids } } : {};
  const tFilter = external ? { project: { $in: ids } } : {};
  if (req.user.role === 'Worker') tFilter.assignedTo = req.user._id;
  const today = startOfDay();

  const projects = await Project.find(pFilter).populate('client', 'name').populate('manager', 'name').sort('-createdAt').lean();
  const fin = await projectFinancials(projects.map((p) => p._id));
  const totals = totalsOf(fin);

  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const payMatch = { date: { $gte: sixMonthsAgo }, ...(external ? { project: { $in: ids } } : {}) };
  const [upcomingTasks, overdueTasks, cashIn, cashOut, monthlyExpenses, recentReports, taskStatus] = await Promise.all([
    Task.find({ ...tFilter, status: { $ne: 'Done' }, dueDate: { $gte: today, $lte: addDays(today, 7) } })
      .populate('project', 'name code').populate('assignedTo', 'name').sort('dueDate').limit(8).lean(),
    Task.find({ ...tFilter, status: { $ne: 'Done' }, dueDate: { $lt: today } })
      .populate('project', 'name code').populate('assignedTo', 'name').sort('dueDate').limit(8).lean(),
    Payment.aggregate([
      { $match: { ...payMatch, direction: 'In' } },
      { $group: { _id: { y: { $year: '$date' }, m: { $month: '$date' } }, sum: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $match: { ...payMatch, direction: 'Out' } },
      { $group: { _id: { y: { $year: '$date' }, m: { $month: '$date' } }, sum: { $sum: '$amount' } } },
    ]),
    Expense.aggregate([
      { $match: payMatch },
      { $group: { _id: { y: { $year: '$date' }, m: { $month: '$date' } }, sum: { $sum: '$amount' } } },
    ]),
    DailyReport.find(tFilter).populate('project', 'name code').populate('submittedBy', 'name').sort('-date').limit(5).lean(),
    Task.aggregate([{ $match: tFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const k = (arr) => arr.find((x) => x._id.y === d.getFullYear() && x._id.m === d.getMonth() + 1)?.sum || 0;
    months.push({
      month: d.toLocaleString('en-US', { month: 'short' }),
      inflow: round2(k(cashIn)),
      outflow: round2(k(cashOut) + k(monthlyExpenses)),
    });
  }

  const status = { Planning: 0, Ongoing: 0, 'On Hold': 0, Completed: 0, Cancelled: 0 };
  for (const p of projects) status[p.status]++;
  const contractValue = round2(projects.reduce((s, p) => s + (p.contractValue || 0), 0));
  const active = projects.filter((p) => p.status !== 'Cancelled');

  // Low stock count (internal users only)
  let lowStock = 0;
  if (!external) {
    const [materials, levels] = await Promise.all([Material.find({ minStock: { $gt: 0 } }).lean(), stockLevels()]);
    const tot = new Map();
    for (const l of levels) tot.set(l.material, (tot.get(l.material) || 0) + l.quantity);
    lowStock = materials.filter((m) => (tot.get(String(m._id)) || 0) < m.minStock).length;
  }

  res.json({
    kpis: {
      totalProjects: projects.length,
      ...status,
      avgProgress: active.length ? Math.round(active.reduce((s, p) => s + (p.progress || 0), 0) / active.length) : 0,
      contractValue,
      received: totals.received,
      pending: round2(contractValue - totals.received),
      billed: totals.billed,
      material: totals.material,
      labour: totals.labour,
      subcontract: totals.subcontract,
      expenses: totals.expenses,
      totalCost: totals.totalCost,
      profit: round2(totals.billed - totals.totalCost),
      lowStock,
    },
    projectStatus: Object.entries(status).map(([name, value]) => ({ name, value })),
    taskStatus: taskStatus.map((t) => ({ name: t._id, value: t.count })),
    cashflow: months,
    upcomingTasks,
    overdueTasks,
    recentReports,
    sites: projects.map((p) => {
      const f = finFor(fin, p._id);
      return {
        _id: p._id,
        code: p.code,
        name: p.name,
        client: p.client?.name,
        manager: p.manager?.name,
        projectType: p.projectType,
        status: p.status,
        progress: p.progress,
        endDate: p.endDate,
        contractValue: p.contractValue,
        budget: p.budget,
        cost: f.totalCost,
        received: f.received,
        billed: f.billed,
      };
    }),
  });
});

/* Funnel counts for the core business flow */
router.get('/dashboard/pipeline', guard('pipeline'), async (req, res) => {
  const [leads, leadStatus, clients, visits, boqs, quotes, approved, projects, ongoing, measurements, invoices, receipts, completed,
    followUps, tickets, employees, pendingLeaves, payrolls, unpaidWages] =
    await Promise.all([
      Lead.countDocuments(),
      Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Client.countDocuments(),
      SiteVisit.countDocuments(),
      Boq.countDocuments(),
      Quotation.countDocuments({ status: { $ne: 'Revised' } }),
      Quotation.countDocuments({ status: { $in: ['Approved', 'Converted'] } }),
      Project.countDocuments(),
      Project.countDocuments({ status: 'Ongoing' }),
      Measurement.countDocuments(),
      Bill.countDocuments({ billType: 'Client', status: { $nin: ['Draft', 'Cancelled'] } }),
      Payment.countDocuments({ direction: 'In' }),
      Project.countDocuments({ status: 'Completed' }),
      Activity.countDocuments({ status: 'Open' }),
      Ticket.countDocuments({ status: { $in: ['Open', 'In Progress'] } }),
      Employee.countDocuments({ status: { $ne: 'Exited' } }),
      Leave.countDocuments({ status: 'Pending' }),
      Payroll.countDocuments({ status: 'Paid' }),
      Attendance.aggregate([{ $match: { payment: null } }, { $group: { _id: null, sum: { $sum: '$wage' } } }]),
    ]);
  const fin = totalsOf(await projectFinancials());
  res.json({
    leadStatus: leadStatus.map((s) => ({ name: s._id, value: s.count })),
    stages: [
      { key: 'leads', label: 'Leads', count: leads, to: '/leads' },
      { key: 'followups', label: 'Follow-ups due', count: followUps, to: '/crm/activities?status=Open' },
      { key: 'clients', label: 'Clients', count: clients, to: '/clients' },
      { key: 'visits', label: 'Site Visits', count: visits, to: '/site-visits' },
      { key: 'boq', label: 'Estimation / BOQ', count: boqs, to: '/boq' },
      { key: 'quotes', label: 'Quotations', count: quotes, to: '/quotations' },
      { key: 'approved', label: 'Client Approval', count: approved, to: '/quotations?status=Approved' },
      { key: 'projects', label: 'Projects', count: projects, to: '/projects' },
      { key: 'execution', label: 'Site Execution', count: ongoing, to: '/projects?status=Ongoing' },
      { key: 'measurement', label: 'Measurement', count: measurements, to: '/measurements' },
      { key: 'billing', label: 'Client Billing', count: invoices, to: '/finance/bills?billType=Client' },
      { key: 'payment', label: 'Payments', count: receipts, to: '/finance/payments' },
      { key: 'completed', label: 'Completed', count: completed, to: '/projects?status=Completed' },
      { key: 'tickets', label: 'Open service tickets', count: tickets, to: '/crm/tickets?status=Open' },
    ],
    finance: { ...fin, profit: round2(fin.billed - fin.totalCost) },
    hr: { employees, pendingLeaves, payrolls, unpaidWages: round2(unpaidWages[0]?.sum || 0) },
  });
});

export default router;
