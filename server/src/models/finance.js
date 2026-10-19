import mongoose from 'mongoose';
import { autoCode, opts, ref } from './plugins.js';
import { round2 } from '../utils/helpers.js';
import {
  BILL_TYPES, BILL_STATUS, PAYMENT_CATEGORIES, PAYMENT_MODES, EXPENSE_CATEGORIES, INCOME_CATEGORIES, UNITS,
} from '../config/constants.js';

/* ---------------- Bill (client invoice / purchase invoice / contractor bill) ---------------- */
const billSchema = new mongoose.Schema(
  {
    billType: { type: String, enum: BILL_TYPES, required: true },
    project: ref('Project'),
    client: ref('Client'),
    vendor: ref('Vendor'),
    subcontractor: ref('Subcontractor'),
    purchaseOrder: ref('PurchaseOrder'),
    workOrder: ref('WorkOrder'),
    measurement: ref('Measurement'),
    partyInvoiceNo: String,
    billDate: { type: Date, default: Date.now },
    dueDate: Date,
    items: [
      {
        description: { type: String, required: true },
        unit: { type: String, enum: UNITS, default: 'LS' },
        quantity: { type: Number, default: 1 },
        rate: { type: Number, default: 0 },
        amount: Number,
      },
    ],
    subtotal: Number,
    gstPercent: { type: Number, default: 18 },
    gstAmount: Number,
    retentionPercent: { type: Number, default: 0 },
    retentionAmount: Number,
    total: Number,
    paidAmount: { type: Number, default: 0 },
    balance: Number,
    status: { type: String, enum: BILL_STATUS, default: 'Issued' },
    notes: String,
  },
  opts,
);
billSchema.methods.recalc = function () {
  let sub = 0;
  for (const it of this.items) {
    it.amount = round2((it.quantity || 0) * (it.rate || 0));
    sub += it.amount;
  }
  this.subtotal = round2(sub);
  this.gstAmount = round2((this.subtotal * Number(this.gstPercent || 0)) / 100);
  this.retentionAmount = round2((this.subtotal * Number(this.retentionPercent || 0)) / 100);
  this.total = round2(this.subtotal + this.gstAmount - this.retentionAmount);
  this.balance = round2(this.total - (this.paidAmount || 0));
  if (!['Draft', 'Cancelled'].includes(this.status)) {
    if (this.paidAmount <= 0) this.status = 'Issued';
    else if (this.balance <= 0.5) this.status = 'Paid';
    else this.status = 'Partially Paid';
  }
};
billSchema.pre('save', function () {
  this.recalc();
});
const BILL_PREFIX = { Client: 'INV', Vendor: 'PB', Contractor: 'CB' };
autoCode(billSchema, (doc) => BILL_PREFIX[doc.billType] || 'BILL');
export const Bill = mongoose.model('Bill', billSchema);

/* ---------------- Payment ---------------- */
const paymentSchema = new mongoose.Schema(
  {
    direction: { type: String, enum: ['In', 'Out'] },
    category: { type: String, enum: PAYMENT_CATEGORIES, required: true },
    bill: ref('Bill'),
    project: ref('Project'),
    client: ref('Client'),
    vendor: ref('Vendor'),
    subcontractor: ref('Subcontractor'),
    worker: ref('Worker'),
    employee: ref('Employee'),
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: Date, default: Date.now },
    mode: { type: String, enum: PAYMENT_MODES, default: 'Bank Transfer' },
    reference: String,
    notes: String,
    recordedBy: ref('User'),
  },
  opts,
);
paymentSchema.pre('save', async function () {
  this.direction = INCOME_CATEGORIES.includes(this.category) ? 'In' : 'Out';
  // Inherit party / project from the linked bill so reports stay consistent.
  if (this.bill) {
    const bill = await Bill.findById(this.bill).lean();
    if (bill) {
      this.project = this.project || bill.project;
      this.client = this.client || bill.client;
      this.vendor = this.vendor || bill.vendor;
      this.subcontractor = this.subcontractor || bill.subcontractor;
    }
  }
});

export async function syncBillPaid(billId) {
  if (!billId) return;
  const bill = await Bill.findById(billId);
  if (!bill) return;
  const [agg] = await Payment.aggregate([
    { $match: { bill: bill._id } },
    { $group: { _id: null, sum: { $sum: '$amount' } } },
  ]);
  bill.paidAmount = round2(agg?.sum || 0);
  await bill.save();
}
paymentSchema.post('save', (doc) => syncBillPaid(doc.bill));
paymentSchema.post('deleteOne', { document: true, query: false }, (doc) => syncBillPaid(doc.bill));
autoCode(paymentSchema, (doc) => (INCOME_CATEGORIES.includes(doc.category) ? 'RCPT' : 'PAY'));
export const Payment = mongoose.model('Payment', paymentSchema);

/* ---------------- Expense ---------------- */
const expenseSchema = new mongoose.Schema(
  {
    project: ref('Project'),
    category: { type: String, enum: EXPENSE_CATEGORIES, default: 'Site Expense' },
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    paidTo: String,
    mode: { type: String, enum: PAYMENT_MODES, default: 'Cash' },
    receipt: String,
    recordedBy: ref('User'),
  },
  opts,
);
autoCode(expenseSchema, 'EXP');
export const Expense = mongoose.model('Expense', expenseSchema);
