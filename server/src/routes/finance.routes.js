import express from 'express';
import { crud } from '../utils/crud.js';
import { guard } from '../middleware/auth.js';
import { scopes } from '../services/scope.js';
import { Bill, Payment, Expense, Project, Attendance, Advance, Payroll } from '../models/index.js';
import { ApiError, round2 } from '../utils/helpers.js';

const router = express.Router();
const P = (path, select = 'name code') => ({ path, select });

/* ---------------- Bills: client invoices, purchase invoices, contractor bills ---------------- */
router.use(
  '/bills',
  guard('bills'),
  crud(Bill, {
    populate: [
      P('project', 'name code siteAddress'),
      P('client', 'name code phone email address gstin'),
      P('vendor', 'name code phone gstin address'),
      P('subcontractor', 'name code phone gstin'),
      P('purchaseOrder', 'code'),
      P('workOrder', 'code title'),
      P('measurement', 'code'),
    ],
    search: ['code', 'partyInvoiceNo', 'notes'],
    filters: ['billType', 'status', 'project', 'client', 'vendor', 'subcontractor', 'workOrder'],
    dateField: 'billDate',
    sort: '-billDate',
    scope: scopes.bills,
    queryFilter: (q) => (q.outstanding === 'true' ? { balance: { $gt: 0 }, status: { $nin: ['Draft', 'Cancelled'] } } : {}),
    beforeSave: async (doc) => {
      if (doc.billType === 'Client' && !doc.client && doc.project) {
        doc.client = (await Project.findById(doc.project).lean())?.client;
      }
      if (doc.billType === 'Client' && !doc.client) throw new ApiError(400, 'Select a client or project');
      if (doc.billType === 'Vendor' && !doc.vendor) throw new ApiError(400, 'Select a vendor');
      if (doc.billType === 'Contractor' && !doc.subcontractor) throw new ApiError(400, 'Select a subcontractor');
    },
    beforeDelete: async (doc) => {
      if (await Payment.exists({ bill: doc._id })) throw new ApiError(400, 'Bill has payments. Cancel it instead.');
    },
  }),
);

/* ---------------- Payments (receipts & payouts) ---------------- */
router.use(
  '/payments',
  guard('payments'),
  crud(Payment, {
    populate: [
      P('bill', 'code billType total balance'),
      P('project'),
      P('client'),
      P('vendor'),
      P('subcontractor'),
      P('worker'),
      P('employee'),
      P('recordedBy', 'name'),
    ],
    search: ['code', 'reference', 'notes'],
    filters: ['direction', 'category', 'project', 'mode', 'bill', 'client', 'vendor', 'subcontractor', 'worker', 'employee'],
    dateField: 'date',
    sort: '-date',
    sanitize: (body, req, isNew) => (isNew ? { ...body, recordedBy: req.user._id } : body),
    beforeSave: async (doc) => {
      if (!doc.bill || !doc.isModified('amount')) return;
      const bill = await Bill.findById(doc.bill).lean();
      if (!bill) throw new ApiError(400, 'Linked bill not found');
      if (['Draft', 'Cancelled'].includes(bill.status)) throw new ApiError(400, `Bill is ${bill.status}`);
      const others = await Payment.aggregate([
        { $match: { bill: bill._id, _id: { $ne: doc._id } } },
        { $group: { _id: null, sum: { $sum: '$amount' } } },
      ]);
      const remaining = round2(bill.total - (others[0]?.sum || 0));
      if (doc.amount > remaining + 0.5) throw new ApiError(400, `Amount exceeds bill balance (₹${remaining.toLocaleString('en-IN')})`);
    },
    beforeDelete: async (doc) => {
      if (await Advance.exists({ payment: doc._id })) throw new ApiError(400, 'This is a salary advance payout. Delete the advance instead.');
      if (await Payroll.exists({ 'lines.payment': doc._id })) throw new ApiError(400, 'This salary was paid through payroll and cannot be deleted');
      // Deleting a wage payout makes those attendance days payable again
      await Attendance.updateMany({ payment: doc._id }, { $unset: { payment: 1 } });
    },
  }),
);

/* ---------------- Expenses ---------------- */
router.use(
  '/expenses',
  guard('expenses'),
  crud(Expense, {
    populate: [P('project'), P('recordedBy', 'name')],
    search: ['code', 'description', 'paidTo'],
    filters: ['project', 'category', 'mode'],
    dateField: 'date',
    sort: '-date',
    sanitize: (body, req, isNew) => (isNew ? { ...body, recordedBy: req.user._id } : body),
  }),
);

export default router;
