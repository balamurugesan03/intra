import mongoose from 'mongoose';
import { autoCode, opts, ref } from './plugins.js';
import { round2, ApiError } from '../utils/helpers.js';
import {
  DEPARTMENTS, EMPLOYEE_STATUS, STAFF_ATTENDANCE_STATUS, LEAVE_TYPES, LEAVE_STATUS, PAYROLL_STATUS, PAYMENT_MODES,
} from '../config/constants.js';

/* ---------------- Employee (office & site staff on payroll) ---------------- */
const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    email: String,
    user: ref('User'), // login used for self-service (apply leave, payslips)
    department: { type: String, enum: DEPARTMENTS, default: 'Projects' },
    designation: String,
    reportingTo: ref('Employee'), // approves leave
    joiningDate: Date,
    dob: Date,
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    address: String,
    emergencyContact: String,
    pan: String,
    aadhaar: String,
    uan: String,
    esiNo: String,
    bankName: String,
    bankAccount: String,
    ifsc: String,
    // Monthly salary structure
    basic: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    gross: Number,
    pfApplicable: { type: Boolean, default: true },
    esiApplicable: { type: Boolean, default: false },
    professionalTax: { type: Number, default: 200 },
    status: { type: String, enum: EMPLOYEE_STATUS, default: 'Active' },
    exitDate: Date,
  },
  opts,
);
employeeSchema.pre('save', function () {
  this.gross = round2(Number(this.basic || 0) + Number(this.hra || 0) + Number(this.allowances || 0));
  if (this.status === 'Exited' && !this.exitDate) this.exitDate = new Date();
});
autoCode(employeeSchema, 'EMP');
export const Employee = mongoose.model('Employee', employeeSchema);

/* ---------------- Staff attendance ---------------- */
const staffAttendanceSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    employee: ref('Employee', { required: true }),
    status: { type: String, enum: STAFF_ATTENDANCE_STATUS, default: 'Present' },
    checkIn: String,
    checkOut: String,
    leave: ref('Leave'), // set when the day comes from an approved leave
    remarks: String,
    markedBy: ref('User'),
  },
  opts,
);
staffAttendanceSchema.index({ date: 1, employee: 1 }, { unique: true });
staffAttendanceSchema.pre('save', function () {
  if (this.status !== 'Leave') this.leave = undefined;
});
export const StaffAttendance = mongoose.model('StaffAttendance', staffAttendanceSchema);

/* ---------------- Leave application ---------------- */
const leaveSchema = new mongoose.Schema(
  {
    employee: ref('Employee', { required: true }),
    leaveType: { type: String, enum: LEAVE_TYPES, default: 'Casual Leave' },
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    halfDay: { type: Boolean, default: false },
    days: Number,
    reason: String,
    status: { type: String, enum: LEAVE_STATUS, default: 'Pending' },
    approvedBy: ref('User'),
    approvedAt: Date,
    remarks: String,
  },
  opts,
);
leaveSchema.pre('validate', function () {
  if (this.halfDay) this.to = this.from;
  if (this.from && this.to && this.to < this.from) throw new ApiError(400, 'Leave end date is before the start date');
  if (this.from && this.to) this.days = this.halfDay ? 0.5 : Math.round((this.to - this.from) / 864e5) + 1;
});
autoCode(leaveSchema, 'LV');
export const Leave = mongoose.model('Leave', leaveSchema);

/* ---------------- Salary advance (recovered through payroll) ---------------- */
const advanceSchema = new mongoose.Schema(
  {
    employee: ref('Employee', { required: true }),
    date: { type: Date, default: Date.now },
    amount: { type: Number, required: true, min: 1 },
    installment: { type: Number, required: true, min: 1 }, // recovered every month
    mode: { type: String, enum: PAYMENT_MODES, default: 'Bank Transfer' },
    reason: String,
    payment: ref('Payment'),
    recoveries: [{ payroll: ref('Payroll'), month: String, amount: Number }],
    recovered: { type: Number, default: 0 },
    balance: Number,
    status: { type: String, enum: ['Open', 'Closed'], default: 'Open' },
  },
  opts,
);
advanceSchema.pre('save', function () {
  this.recovered = round2(this.recoveries.reduce((s, r) => s + (r.amount || 0), 0));
  this.balance = round2(this.amount - this.recovered);
  this.status = this.balance <= 0.5 ? 'Closed' : 'Open';
});
autoCode(advanceSchema, 'ADV');
export const Advance = mongoose.model('Advance', advanceSchema);

/* ---------------- Monthly payroll run ---------------- */
const payLineSchema = new mongoose.Schema({
  employee: ref('Employee'),
  name: String,
  code: String,
  designation: String,
  department: String,
  monthDays: Number,
  presentDays: Number,
  paidLeave: Number,
  lopDays: Number,
  payableDays: Number,
  basic: { type: Number, default: 0 },
  hra: { type: Number, default: 0 },
  allowances: { type: Number, default: 0 },
  bonus: { type: Number, default: 0 },
  gross: Number,
  pf: { type: Number, default: 0 },
  esi: { type: Number, default: 0 },
  pt: { type: Number, default: 0 },
  advance: { type: Number, default: 0 },
  otherDeduction: { type: Number, default: 0 },
  deductions: Number,
  net: Number,
  payment: ref('Payment'),
});

const payrollSchema = new mongoose.Schema(
  {
    month: { type: String, required: true, unique: true, match: [/^\d{4}-\d{2}$/, 'Month must be YYYY-MM'] },
    lines: [payLineSchema],
    gross: Number,
    deductions: Number,
    net: Number,
    status: { type: String, enum: PAYROLL_STATUS, default: 'Draft' },
    approvedBy: ref('User'),
    approvedAt: Date,
    paidAt: Date,
    notes: String,
  },
  opts,
);
payrollSchema.pre('save', function () {
  let gross = 0;
  let ded = 0;
  for (const l of this.lines) {
    l.gross = round2(l.basic + l.hra + l.allowances + Number(l.bonus || 0));
    l.deductions = round2(l.pf + l.esi + l.pt + Number(l.advance || 0) + Number(l.otherDeduction || 0));
    l.net = round2(l.gross - l.deductions);
    gross += l.gross;
    ded += l.deductions;
  }
  this.gross = round2(gross);
  this.deductions = round2(ded);
  this.net = round2(gross - ded);
});
autoCode(payrollSchema, 'PR');
export const Payroll = mongoose.model('Payroll', payrollSchema);
