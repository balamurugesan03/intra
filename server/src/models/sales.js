import mongoose from 'mongoose';
import { autoCode, opts, ref } from './plugins.js';
import { round2 } from '../utils/helpers.js';
import {
  PROJECT_TYPES, LEAD_SOURCES, LEAD_STATUS, SITE_VISIT_STATUS, BOQ_STATUS, QUOTATION_STATUS, UNITS,
} from '../config/constants.js';

/* ---------------- Lead ---------------- */
const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    email: String,
    company: String,
    source: { type: String, enum: LEAD_SOURCES, default: 'Walk-in' },
    projectType: { type: String, enum: PROJECT_TYPES, default: 'Interior' },
    requirement: String,
    location: String,
    budget: Number,
    status: { type: String, enum: LEAD_STATUS, default: 'New' },
    followUpDate: Date,
    lostReason: String,
    assignedTo: ref('User'),
    client: ref('Client'),
    notes: String,
  },
  opts,
);
autoCode(leadSchema, 'LD');
export const Lead = mongoose.model('Lead', leadSchema);

/* ---------------- Client ---------------- */
const clientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    email: String,
    company: String,
    address: String,
    city: String,
    gstin: String,
    lead: ref('Lead'),
    notes: String,
  },
  opts,
);
autoCode(clientSchema, 'CL');
export const Client = mongoose.model('Client', clientSchema);

/* ---------------- Site Visit ---------------- */
const siteVisitSchema = new mongoose.Schema(
  {
    lead: ref('Lead'),
    client: ref('Client'),
    date: { type: Date, required: true },
    address: String,
    visitedBy: ref('User'),
    requirement: String,
    observations: String,
    measurements: String,
    status: { type: String, enum: SITE_VISIT_STATUS, default: 'Scheduled' },
    photos: [String],
  },
  opts,
);
autoCode(siteVisitSchema, 'SV');
export const SiteVisit = mongoose.model('SiteVisit', siteVisitSchema);

/* ---------------- BOQ / Estimation ---------------- */
const boqItemSchema = new mongoose.Schema({
  area: String,
  category: String,
  description: { type: String, required: true },
  unit: { type: String, enum: UNITS, default: 'Sqft' },
  quantity: { type: Number, default: 0 },
  materialRate: { type: Number, default: 0 },
  labourRate: { type: Number, default: 0 },
  materialAmount: Number,
  labourAmount: Number,
  amount: Number,
});

const boqSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    client: ref('Client'),
    lead: ref('Lead'),
    siteVisit: ref('SiteVisit'),
    project: ref('Project'),
    projectType: { type: String, enum: PROJECT_TYPES, default: 'Interior' },
    items: [boqItemSchema],
    otherExpenses: { type: Number, default: 0 },
    profitMargin: { type: Number, default: 15 },
    materialTotal: Number,
    labourTotal: Number,
    costTotal: Number,
    profitAmount: Number,
    total: Number,
    status: { type: String, enum: BOQ_STATUS, default: 'Draft' },
    notes: String,
  },
  opts,
);
boqSchema.pre('save', function () {
  let mat = 0;
  let lab = 0;
  for (const it of this.items) {
    it.materialAmount = round2(it.quantity * it.materialRate);
    it.labourAmount = round2(it.quantity * it.labourRate);
    it.amount = round2(it.materialAmount + it.labourAmount);
    mat += it.materialAmount;
    lab += it.labourAmount;
  }
  this.materialTotal = round2(mat);
  this.labourTotal = round2(lab);
  this.costTotal = round2(mat + lab + Number(this.otherExpenses || 0));
  this.profitAmount = round2((this.costTotal * Number(this.profitMargin || 0)) / 100);
  this.total = round2(this.costTotal + this.profitAmount);
});
autoCode(boqSchema, 'BOQ');
export const Boq = mongoose.model('Boq', boqSchema);

/* ---------------- Quotation ---------------- */
const quoteItemSchema = new mongoose.Schema({
  area: String,
  description: { type: String, required: true },
  unit: { type: String, enum: UNITS, default: 'Sqft' },
  quantity: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  amount: Number,
});

const quotationSchema = new mongoose.Schema(
  {
    baseCode: String,
    version: { type: Number, default: 1 },
    title: { type: String, required: true },
    client: ref('Client', { required: true }),
    lead: ref('Lead'),
    boq: ref('Boq'),
    projectType: { type: String, enum: PROJECT_TYPES, default: 'Interior' },
    siteAddress: String,
    items: [quoteItemSchema],
    subtotal: Number,
    discountPercent: { type: Number, default: 0 },
    discountAmount: Number,
    taxable: Number,
    gstPercent: { type: Number, default: 18 },
    gstAmount: Number,
    grandTotal: Number,
    validUntil: Date,
    terms: {
      type: String,
      default:
        '1. 50% advance along with work order.\n2. 40% on completion of 75% work.\n3. 10% on handover.\n4. Prices valid for 30 days.',
    },
    status: { type: String, enum: QUOTATION_STATUS, default: 'Draft' },
    approvedAt: Date,
    project: ref('Project'),
    notes: String,
  },
  opts,
);
quotationSchema.pre('save', function () {
  let sub = 0;
  for (const it of this.items) {
    it.amount = round2(it.quantity * it.rate);
    sub += it.amount;
  }
  this.subtotal = round2(sub);
  this.discountAmount = round2((this.subtotal * Number(this.discountPercent || 0)) / 100);
  this.taxable = round2(this.subtotal - this.discountAmount);
  this.gstAmount = round2((this.taxable * Number(this.gstPercent || 0)) / 100);
  this.grandTotal = round2(this.taxable + this.gstAmount);
  if (this.isModified('status') && this.status === 'Approved' && !this.approvedAt) this.approvedAt = new Date();
});
autoCode(quotationSchema, 'QT');
quotationSchema.pre('save', function () {
  if (!this.baseCode) this.baseCode = this.code;
});
export const Quotation = mongoose.model('Quotation', quotationSchema);
