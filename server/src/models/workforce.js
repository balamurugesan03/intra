import mongoose from 'mongoose';
import { autoCode, opts, ref } from './plugins.js';
import { round2 } from '../utils/helpers.js';
import {
  SKILL_TYPES, TRADES, ATTENDANCE_STATUS, WORK_ORDER_STATUS, MEASUREMENT_STATUS, UNITS,
} from '../config/constants.js';

/* ---------------- Worker ---------------- */
const workerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: String,
    skillType: { type: String, enum: SKILL_TYPES, default: 'Skilled' },
    trade: { type: String, enum: TRADES, default: 'Helper' },
    dailyWage: { type: Number, default: 0 },
    otRate: { type: Number, default: 0 },
    subcontractor: ref('Subcontractor'),
    currentProject: ref('Project'),
    idProof: String,
    address: String,
    active: { type: Boolean, default: true },
  },
  opts,
);
autoCode(workerSchema, 'WRK');
export const Worker = mongoose.model('Worker', workerSchema);

/* ---------------- Attendance ---------------- */
const attendanceSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    project: ref('Project', { required: true }),
    worker: ref('Worker', { required: true }),
    status: { type: String, enum: ATTENDANCE_STATUS, default: 'Present' },
    otHours: { type: Number, default: 0 },
    wage: { type: Number, default: 0 },
    remarks: String,
    markedBy: ref('User'),
    payment: ref('Payment'), // set once the wage is settled
  },
  opts,
);
attendanceSchema.index({ date: 1, worker: 1 }, { unique: true });
attendanceSchema.pre('save', async function () {
  const w = await Worker.findById(this.worker).lean();
  const day = this.status === 'Present' ? 1 : this.status === 'Half Day' ? 0.5 : 0;
  const ot = this.status === 'Absent' ? 0 : Number(this.otHours || 0) * (w?.otRate || 0);
  this.wage = round2(day * (w?.dailyWage || 0) + ot);
});
export const Attendance = mongoose.model('Attendance', attendanceSchema);

/* ---------------- Subcontractor ---------------- */
const subcontractorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: String,
    phone: { type: String, required: true },
    email: String,
    trade: String,
    gstin: String,
    pan: String,
    address: String,
    bankDetails: String,
    rating: { type: Number, min: 0, max: 5, default: 4 },
  },
  opts,
);
autoCode(subcontractorSchema, 'SC');
export const Subcontractor = mongoose.model('Subcontractor', subcontractorSchema);

/* ---------------- Work Order (work package) ---------------- */
const workOrderSchema = new mongoose.Schema(
  {
    subcontractor: ref('Subcontractor', { required: true }),
    project: ref('Project', { required: true }),
    title: { type: String, required: true },
    scope: String,
    items: [
      { description: String, unit: { type: String, enum: UNITS, default: 'Sqft' }, quantity: Number, rate: Number, amount: Number },
    ],
    contractAmount: { type: Number, default: 0 },
    startDate: Date,
    endDate: Date,
    progress: { type: Number, default: 0, min: 0, max: 100 },
    status: { type: String, enum: WORK_ORDER_STATUS, default: 'Active' },
  },
  opts,
);
workOrderSchema.pre('save', function () {
  let sum = 0;
  for (const it of this.items) {
    it.amount = round2((it.quantity || 0) * (it.rate || 0));
    sum += it.amount;
  }
  if (this.items.length) this.contractAmount = round2(sum);
});
autoCode(workOrderSchema, 'WO');
export const WorkOrder = mongoose.model('WorkOrder', workOrderSchema);

/* ---------------- Measurement Book ---------------- */
const measurementItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  area: String,
  unit: { type: String, enum: UNITS, default: 'Sqft' },
  nos: { type: Number, default: 1 },
  length: Number,
  breadth: Number,
  height: Number,
  quantity: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  amount: Number,
});

const measurementSchema = new mongoose.Schema(
  {
    project: ref('Project', { required: true }),
    measurementType: { type: String, enum: ['Client', 'Contractor'], default: 'Client' },
    workOrder: ref('WorkOrder'),
    subcontractor: ref('Subcontractor'),
    date: { type: Date, default: Date.now },
    items: [measurementItemSchema],
    total: Number,
    status: { type: String, enum: MEASUREMENT_STATUS, default: 'Draft' },
    bill: ref('Bill'),
    measuredBy: ref('User'),
    remarks: String,
  },
  opts,
);
measurementSchema.pre('save', function () {
  let sum = 0;
  for (const it of this.items) {
    const dims = [it.length, it.breadth, it.height].filter((d) => Number(d) > 0);
    if (dims.length) it.quantity = round2((it.nos || 1) * dims.reduce((a, b) => a * b, 1));
    it.amount = round2((it.quantity || 0) * (it.rate || 0));
    sum += it.amount;
  }
  this.total = round2(sum);
});
autoCode(measurementSchema, 'MB');
export const Measurement = mongoose.model('Measurement', measurementSchema);
