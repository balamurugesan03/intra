import express from 'express';
import { crud } from '../utils/crud.js';
import { guard } from '../middleware/auth.js';
import { isHR, hasPermission } from '../config/permissions.js';
import { Employee, StaffAttendance, Leave, Payroll, Advance, Payment } from '../models/index.js';
import { buildPayrollLines, recoverAdvances, monthRange } from '../services/payroll.js';
import { LEAVE_TYPES, LEAVE_QUOTA, STAFF_ATTENDANCE_STATUS } from '../config/constants.js';
import { ApiError, dayKey, isValidId, oid, round2 } from '../utils/helpers.js';

const router = express.Router();
const P = (path, select = 'name code') => ({ path, select });
const NO_PROFILE = 'No employee profile is linked to your login. Ask HR to link it.';

/** Employee profile of the logged-in user (null when none is linked). */
const myEmployee = (user) => Employee.findOne({ user: user._id }).lean();

/* ---------------- Employees ---------------- */
router.use(
  '/employees',
  guard('employees'),
  crud(Employee, {
    populate: [P('user', 'name email role'), P('reportingTo', 'name code designation')],
    search: ['name', 'code', 'phone', 'email', 'designation'],
    filters: ['department', 'status', 'reportingTo'],
    sort: 'name',
    sanitize: (body) => {
      for (const k of ['user', 'reportingTo']) if (body[k] === '') body[k] = null;
      return body;
    },
    beforeSave: async (doc) => {
      if (doc.reportingTo && String(doc.reportingTo) === String(doc._id)) throw new ApiError(400, 'An employee cannot report to themselves');
      if (doc.user && (await Employee.exists({ user: doc.user, _id: { $ne: doc._id } }))) throw new ApiError(400, 'That login is already linked to another employee');
    },
    beforeDelete: async (doc) => {
      if (await Payroll.exists({ 'lines.employee': doc._id })) throw new ApiError(400, 'Employee is on a payroll. Mark as Exited instead.');
    },
  }),
);

/* ---------------- Staff attendance ---------------- */
router.use(
  '/staff-attendance',
  guard('staffAttendance'),
  crud(StaffAttendance, {
    populate: [P('employee', 'name code designation department'), P('leave', 'code leaveType')],
    filters: ['employee', 'status'],
    dateField: 'date',
    sort: '-date',
    sanitize: (body, req, isNew) => ({
      ...body,
      ...(body.date || isNew ? { date: dayKey(body.date) } : {}),
      markedBy: req.user._id,
    }),
    beforeSave: async (doc) => {
      if (doc.status === 'Leave' && !doc.leave) throw new ApiError(400, 'Leave days come from an approved leave application');
    },
    extend: (r) => {
      // Daily muster: every current employee + their mark for the day
      r.get('/sheet', async (req, res) => {
        const date = dayKey(req.query.date);
        const [employees, marks] = await Promise.all([
          Employee.find({ status: { $ne: 'Exited' }, $or: [{ joiningDate: null }, { joiningDate: { $lte: date } }] })
            .select('name code designation department').sort('name').lean(),
          StaffAttendance.find({ date }).populate('leave', 'code leaveType halfDay').lean(),
        ]);
        const byEmp = new Map(marks.map((m) => [String(m.employee), m]));
        res.json({ date, rows: employees.map((e) => ({ employee: e, attendance: byEmp.get(String(e._id)) || null })) });
      });

      r.post('/bulk', async (req, res) => {
        const date = dayKey(req.body.date);
        let saved = 0;
        for (const e of req.body.entries || []) {
          if (!e.employee || !e.status || e.status === 'Leave') continue;
          const doc = (await StaffAttendance.findOne({ date, employee: e.employee })) || new StaffAttendance({ date, employee: e.employee });
          if (doc.leave) continue; // days covered by approved leave are managed from the leave
          doc.set({ status: e.status, checkIn: e.checkIn, checkOut: e.checkOut, remarks: e.remarks, markedBy: req.user._id });
          await doc.save();
          saved++;
        }
        res.json({ saved });
      });

      // Monthly register: day counts per employee
      r.get('/summary', async (req, res) => {
        const month = req.query.month || new Date().toISOString().slice(0, 7);
        const { start, end } = monthRange(month);
        const [agg, employees] = await Promise.all([
          StaffAttendance.aggregate([
            { $match: { date: { $gte: start, $lt: end } } },
            { $group: { _id: { employee: '$employee', status: '$status' }, count: { $sum: 1 } } },
          ]),
          Employee.find({ $or: [{ status: { $ne: 'Exited' } }, { exitDate: { $gte: start } }] }).select('name code designation department').sort('name').lean(),
        ]);
        const rows = employees.map((e) => {
          const counts = Object.fromEntries(STAFF_ATTENDANCE_STATUS.map((s) => [s, agg.find((a) => String(a._id.employee) === String(e._id) && a._id.status === s)?.count || 0]));
          return { employee: e, counts, marked: Object.values(counts).reduce((a, b) => a + b, 0) };
        });
        res.json({ month, days: Math.round((end - start) / 864e5), rows });
      });
    },
  }),
);

/* ---------------- Leave ---------------- */
/** HR sees every leave; others see their own and their direct reports'. */
async function leaveScope(user) {
  if (isHR(user.role)) return {};
  const me = await myEmployee(user);
  if (!me) return { _id: null };
  const team = await Employee.find({ reportingTo: me._id }).distinct('_id');
  return { employee: { $in: [me._id, ...team] } };
}

async function canApprove(user, leave) {
  if (isHR(user.role)) return true;
  const emp = await Employee.findById(leave.employee).populate('reportingTo', 'user').lean();
  return !!emp?.reportingTo?.user && String(emp.reportingTo.user) === String(user._id);
}

/** Taken / pending / remaining days per leave type for the calendar year of `on`. */
export async function leaveBalance(employee, on = new Date()) {
  const y = new Date(on).getUTCFullYear();
  const used = await Leave.aggregate([
    { $match: { employee: oid(employee), status: { $in: ['Pending', 'Approved'] }, from: { $gte: new Date(Date.UTC(y, 0, 1)), $lt: new Date(Date.UTC(y + 1, 0, 1)) } } },
    { $group: { _id: { type: '$leaveType', status: '$status' }, days: { $sum: '$days' } } },
  ]);
  const sum = (type, status) => used.find((u) => u._id.type === type && u._id.status === status)?.days || 0;
  return LEAVE_TYPES.map((type) => {
    const quota = LEAVE_QUOTA[type] ?? null;
    const taken = sum(type, 'Approved');
    const pending = sum(type, 'Pending');
    return { type, quota, taken, pending, balance: quota == null ? null : round2(quota - taken - pending) };
  });
}

router.get('/leaves/balance', guard('leaves'), async (req, res) => {
  let id = req.query.employee;
  if (!id) {
    const me = await myEmployee(req.user);
    if (!me) throw new ApiError(404, NO_PROFILE);
    id = me._id;
  } else if (!isHR(req.user.role)) {
    const scope = await leaveScope(req.user);
    if (!scope.employee?.$in.some((x) => String(x) === String(id))) throw new ApiError(403, 'Access denied');
  }
  const employee = await Employee.findById(id).select('name code designation department joiningDate').lean();
  if (!employee) throw new ApiError(404, 'Employee not found');
  res.json({ employee, year: new Date().getUTCFullYear(), balance: await leaveBalance(id) });
});

router.use(
  '/leaves',
  guard('leaves'),
  crud(Leave, {
    populate: [P('employee', 'name code designation department'), P('approvedBy', 'name')],
    search: ['code', 'reason'],
    filters: ['employee', 'status', 'leaveType'],
    dateField: 'from',
    sort: '-from',
    scope: leaveScope,
    sanitize: async (body, req, isNew) => {
      // Status only changes through approve / reject / cancel
      for (const k of ['status', 'approvedBy', 'approvedAt', 'days']) delete body[k];
      if (!isNew) delete body.employee;
      else if (!isHR(req.user.role) || !body.employee) {
        const me = await myEmployee(req.user);
        if (!me) throw new ApiError(400, NO_PROFILE);
        body.employee = me._id;
      }
      for (const k of ['from', 'to']) if (body[k]) body[k] = dayKey(body[k]);
      return body;
    },
    beforeSave: async (doc, _req, isNew) => {
      if (!isNew && doc.status !== 'Pending') throw new ApiError(400, `Leave is already ${doc.status}`);
      await doc.validate(); // computes days
      const overlap = await Leave.exists({
        _id: { $ne: doc._id }, employee: doc.employee, status: { $in: ['Pending', 'Approved'] }, from: { $lte: doc.to }, to: { $gte: doc.from },
      });
      if (overlap) throw new ApiError(400, 'These dates overlap another leave application');
      if (LEAVE_QUOTA[doc.leaveType] != null) {
        const bal = (await leaveBalance(doc.employee, doc.from)).find((b) => b.type === doc.leaveType);
        const prev = isNew ? null : await Leave.findById(doc._id).lean(); // an edit frees the days it already holds
        const left = round2(bal.balance + (prev?.leaveType === doc.leaveType ? prev.days : 0));
        if (doc.days > left) throw new ApiError(400, `Only ${Math.max(0, left)} day(s) of ${doc.leaveType} left this year. Apply the rest as Loss of Pay.`);
      }
    },
    beforeDelete: async (doc) => {
      if (doc.status !== 'Pending') throw new ApiError(400, 'Only pending leave can be deleted. Cancel it instead.');
    },
    extend: (r, { findScoped, fetchPopulated }) => {
      r.post('/:id/approve', async (req, res) => {
        const leave = await findScoped(req);
        if (leave.status !== 'Pending') throw new ApiError(400, `Leave is already ${leave.status}`);
        if (!(await canApprove(req.user, leave))) throw new ApiError(403, 'Only HR or the reporting manager can approve this leave');
        leave.set({ status: 'Approved', approvedBy: req.user._id, approvedAt: new Date(), remarks: req.body?.remarks || leave.remarks });
        await leave.save();
        // Approved leave lands on the attendance muster, which feeds payroll
        for (let d = new Date(leave.from); d <= leave.to; d = new Date(+d + 864e5)) {
          await StaffAttendance.findOneAndUpdate({ date: d, employee: leave.employee }, { status: 'Leave', leave: leave._id, markedBy: req.user._id }, { upsert: true });
        }
        res.json(await fetchPopulated(leave._id));
      });

      r.post('/:id/reject', async (req, res) => {
        const leave = await findScoped(req);
        if (leave.status !== 'Pending') throw new ApiError(400, `Leave is already ${leave.status}`);
        if (!(await canApprove(req.user, leave))) throw new ApiError(403, 'Only HR or the reporting manager can reject this leave');
        leave.set({ status: 'Rejected', approvedBy: req.user._id, approvedAt: new Date(), remarks: req.body?.remarks || leave.remarks });
        await leave.save();
        res.json(await fetchPopulated(leave._id));
      });

      r.post('/:id/cancel', async (req, res) => {
        const leave = await findScoped(req);
        if (!['Pending', 'Approved'].includes(leave.status)) throw new ApiError(400, `Leave is already ${leave.status}`);
        const me = await myEmployee(req.user);
        if (!isHR(req.user.role) && String(me?._id) !== String(leave.employee)) throw new ApiError(403, 'Only the employee or HR can cancel this leave');
        if (leave.status === 'Approved') await StaffAttendance.deleteMany({ leave: leave._id });
        leave.status = 'Cancelled';
        await leave.save();
        res.json(await fetchPopulated(leave._id));
      });
    },
  }),
);

/* ---------------- Salary advances ---------------- */
router.use(
  '/advances',
  guard('advances'),
  crud(Advance, {
    populate: [P('employee', 'name code designation'), P('payment', 'code')],
    search: ['code', 'reason'],
    filters: ['employee', 'status'],
    dateField: 'date',
    sort: '-date',
    // Once paid out only the instalment and reason can change
    sanitize: (body, _req, isNew) => (isNew ? { ...body, recoveries: [], payment: undefined } : { installment: body.installment, reason: body.reason }),
    afterSave: async (doc, req, isNew) => {
      if (!isNew) return;
      // The advance is paid out now; payroll recovers it in monthly instalments
      const pay = await Payment.create({
        category: 'Salary Advance', employee: doc.employee, amount: doc.amount, date: doc.date, mode: doc.mode,
        notes: `Salary advance ${doc.code}`, recordedBy: req.user._id,
      });
      doc.payment = pay._id;
      await doc.save();
    },
    beforeDelete: async (doc) => {
      if (doc.recovered > 0) throw new ApiError(400, 'Advance is partly recovered and cannot be deleted');
      if (doc.payment) await Payment.deleteOne({ _id: doc.payment });
    },
  }),
);

/* ---------------- Payroll ---------------- */
router.use(
  '/payroll',
  guard('payroll'),
  crud(Payroll, {
    populate: [P('approvedBy', 'name')],
    search: ['month', 'code'],
    filters: ['status'],
    sort: '-month',
    // Creating a payroll = running it for the month; afterwards only notes are edited here (lines via /lines)
    sanitize: async (body, _req, isNew) => (isNew ? { month: body.month, notes: body.notes, lines: await buildPayrollLines(body.month) } : { notes: body.notes }),
    beforeDelete: async (doc) => {
      if (doc.status !== 'Draft') throw new ApiError(400, `${doc.status} payroll cannot be deleted`);
    },
    extend: (r, { findScoped, fetchPopulated }) => {
      const draft = async (req) => {
        const p = await findScoped(req);
        if (p.status !== 'Draft') throw new ApiError(400, `Payroll is ${p.status}. Reopen it to make changes.`);
        return p;
      };

      // Hand adjustments: bonus / incentive and other deductions per employee
      r.put('/:id/lines', async (req, res) => {
        const p = await draft(req);
        for (const x of req.body.lines || []) {
          const l = p.lines.id(x._id);
          if (!l) continue;
          if (x.bonus !== undefined) l.bonus = Number(x.bonus) || 0;
          if (x.otherDeduction !== undefined) l.otherDeduction = Number(x.otherDeduction) || 0;
        }
        await p.save();
        res.json(await fetchPopulated(p._id));
      });

      // Re-read attendance, leave and advances (keeps hand adjustments)
      r.post('/:id/regenerate', async (req, res) => {
        const p = await draft(req);
        const keep = new Map(p.lines.map((l) => [String(l.employee), { bonus: l.bonus, otherDeduction: l.otherDeduction }]));
        p.lines = await buildPayrollLines(p.month, keep);
        await p.save();
        res.json(await fetchPopulated(p._id));
      });

      r.post('/:id/approve', async (req, res) => {
        const p = await draft(req);
        if (!p.lines.length) throw new ApiError(400, 'Payroll has no employees');
        p.set({ status: 'Approved', approvedBy: req.user._id, approvedAt: new Date() });
        await p.save();
        res.json(await fetchPopulated(p._id));
      });

      r.post('/:id/reopen', async (req, res) => {
        const p = await findScoped(req);
        if (p.status !== 'Approved') throw new ApiError(400, 'Only approved (unpaid) payroll can be reopened');
        p.set({ status: 'Draft', approvedBy: undefined, approvedAt: undefined });
        await p.save();
        res.json(await fetchPopulated(p._id));
      });

      // Pay salaries: one payment per employee (shows in Payments & cash flow) and recover advances
      r.post('/:id/pay', async (req, res) => {
        const p = await findScoped(req);
        if (p.status !== 'Approved') throw new ApiError(400, 'Approve the payroll before paying salaries');
        const { date = new Date(), mode = 'Bank Transfer', reference } = req.body || {};
        for (const l of p.lines) {
          if (l.payment || l.net <= 0) continue;
          const pay = await Payment.create({
            category: 'Salary', employee: l.employee, amount: l.net, date, mode, reference,
            notes: `Salary ${p.month} (${p.code})`, recordedBy: req.user._id,
          });
          l.payment = pay._id;
        }
        p.set({ status: 'Paid', paidAt: new Date() });
        await p.save();
        await recoverAdvances(p);
        res.json(await fetchPopulated(p._id));
      });
    },
  }),
);

/* ---------------- Payslips (HR / accounts, and each employee for their own) ---------------- */
router.get('/payslips', async (req, res) => {
  const me = await myEmployee(req.user);
  if (!me) return res.json({ employee: null, items: [] });
  const rolls = await Payroll.find({ status: { $in: ['Approved', 'Paid'] }, 'lines.employee': me._id }).sort('-month').lean();
  res.json({
    employee: me,
    items: rolls.map((p) => ({ payroll: p._id, code: p.code, month: p.month, status: p.status, line: p.lines.find((l) => String(l.employee) === String(me._id)) })),
  });
});

router.get('/payslips/:payroll/:employee', async (req, res) => {
  const { payroll, employee } = req.params;
  if (!isValidId(payroll) || !isValidId(employee)) throw new ApiError(400, 'Invalid id');
  const p = await Payroll.findById(payroll).lean();
  const line = p?.lines.find((l) => String(l.employee) === employee);
  if (!line) throw new ApiError(404, 'Payslip not found');
  const me = await myEmployee(req.user);
  const own = me && String(me._id) === employee && p.status !== 'Draft';
  if (!own && !hasPermission(req.user.role, 'payroll')) throw new ApiError(403, 'Access denied');
  const emp = await Employee.findById(employee).select('name code designation department joiningDate pan uan esiNo bankName bankAccount ifsc').lean();
  res.json({ code: p.code, month: p.month, status: p.status, employee: emp, line });
});

export default router;
