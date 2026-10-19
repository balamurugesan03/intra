import { Employee, StaffAttendance, Advance } from '../models/index.js';
import { round2, ApiError } from '../utils/helpers.js';

const PF_WAGE_CEILING = 15000; // PF is 12% of basic, capped at this wage
const ESI_GROSS_LIMIT = 21000; // ESI (0.75%) applies only up to this monthly gross

/** "2026-10" -> { start: 1 Oct 00:00 UTC, end: 1 Nov 00:00 UTC (exclusive) } */
export function monthRange(month) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) throw new ApiError(400, 'Month must be YYYY-MM');
  const [y, m] = month.split('-').map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

const utcDay = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/**
 * Payroll lines for a month from each employee's salary structure, staff attendance and approved leave.
 * Attendance is by exception: unmarked days are paid. Pay is reduced only for Absent days, half of a
 * Half Day, Loss-of-Pay leave and days outside employment (before joining / after exit).
 * `keep` carries hand-entered bonus / other deductions over when a draft is regenerated.
 */
export async function buildPayrollLines(month, keep = new Map()) {
  const { start, end } = monthRange(month);
  const monthDays = Math.round((end - start) / 864e5);
  const employees = await Employee.find({
    $and: [
      { $or: [{ joiningDate: null }, { joiningDate: { $lt: end } }] },
      { $or: [{ status: { $ne: 'Exited' } }, { exitDate: { $gte: start } }] },
    ],
  }).sort('name').lean();
  const ids = employees.map((e) => e._id);
  const [marks, advances] = await Promise.all([
    StaffAttendance.find({ employee: { $in: ids }, date: { $gte: start, $lt: end } }).populate('leave', 'leaveType halfDay').lean(),
    Advance.find({ employee: { $in: ids }, status: 'Open', date: { $lt: end } }).lean(),
  ]);

  return employees.map((e) => {
    const id = String(e._id);
    const from = e.joiningDate && e.joiningDate > start ? e.joiningDate : start;
    const to = e.exitDate && e.exitDate < end ? e.exitDate : new Date(end - 864e5);
    const inService = Math.max(0, Math.round((utcDay(to) - utcDay(from)) / 864e5) + 1);

    let present = 0;
    let paidLeave = 0;
    let lop = monthDays - inService;
    for (const a of marks) {
      if (String(a.employee) !== id) continue;
      if (a.status === 'Present') present += 1;
      else if (a.status === 'Half Day') {
        present += 0.5;
        lop += 0.5;
      } else if (a.status === 'Absent') lop += 1;
      else if (a.status === 'Leave') {
        const d = a.leave?.halfDay ? 0.5 : 1;
        if (a.leave?.leaveType === 'Loss of Pay') lop += d;
        else paidLeave += d;
        present += 1 - d;
      }
    }
    const payableDays = Math.max(0, monthDays - lop);
    const f = payableDays / monthDays;
    const basic = round2(e.basic * f);
    const hra = round2(e.hra * f);
    const allowances = round2(e.allowances * f);
    const { bonus = 0, otherDeduction = 0 } = keep.get(id) || {};
    const gross = basic + hra + allowances + bonus;
    const pf = e.pfApplicable ? Math.round(Math.min(basic, PF_WAGE_CEILING) * 0.12) : 0;
    const esi = e.esiApplicable && e.gross <= ESI_GROSS_LIMIT ? Math.ceil(gross * 0.0075) : 0;
    const pt = payableDays > 0 ? e.professionalTax || 0 : 0;
    const due = advances.filter((a) => String(a.employee) === id).reduce((s, a) => s + Math.min(a.installment, a.balance), 0);
    const advance = round2(Math.max(0, Math.min(due, gross - pf - esi - pt - otherDeduction)));

    return {
      employee: e._id, name: e.name, code: e.code, designation: e.designation, department: e.department,
      monthDays, presentDays: present, paidLeave, lopDays: lop, payableDays,
      basic, hra, allowances, bonus, pf, esi, pt, advance, otherDeduction,
    };
  });
}

/** On salary payment, spread each employee's advance deduction over their open advances, oldest first. */
export async function recoverAdvances(payroll) {
  for (const l of payroll.lines) {
    let left = l.advance || 0;
    if (left <= 0) continue;
    const open = await Advance.find({ employee: l.employee, status: 'Open' }).sort('date');
    for (const a of open) {
      if (left <= 0) break;
      const amount = round2(Math.min(left, a.balance));
      a.recoveries.push({ payroll: payroll._id, month: payroll.month, amount });
      await a.save();
      left = round2(left - amount);
    }
  }
}
