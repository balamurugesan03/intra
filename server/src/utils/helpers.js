import mongoose from 'mongoose';

export const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

export const escapeRegex = (s = '') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const toId = (v) => (v && typeof v === 'object' && v._id ? v._id : v);

export const oid = (v) => new mongoose.Types.ObjectId(String(toId(v)));

export const isValidId = (v) => mongoose.isValidObjectId(toId(v));

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const endOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// Sums line items of a document: each item gets `amount = quantity * rate`.
export const computeLines = (items = [], qtyKey = 'quantity', rateKey = 'rate') => {
  let total = 0;
  for (const it of items) {
    it.amount = round2(Number(it[qtyKey] || 0) * Number(it[rateKey] || 0));
    total += it.amount;
  }
  return round2(total);
};

// Day-wise records (attendance) are stored as UTC midnight of the calendar day ("YYYY-MM-DD").
export const dayKey = (d) => new Date(String(d || new Date().toISOString()).slice(0, 10));
