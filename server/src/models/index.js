import mongoose from 'mongoose';
import { opts } from './plugins.js';

export { default as User } from './User.js';
export * from './sales.js';
export * from './project.js';
export * from './inventory.js';
export * from './workforce.js';
export * from './finance.js';
export * from './crm.js';
export * from './hr.js';

/* Single-document company settings (letterhead for quotations / invoices) */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'company', unique: true },
    companyName: { type: String, default: 'Intra Interiors' },
    tagline: { type: String, default: 'Design · Build · Deliver' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    gstin: { type: String, default: '' },
    bankDetails: { type: String, default: '' },
    currency: { type: String, default: 'INR' },
  },
  opts,
);
export const Setting = mongoose.model('Setting', settingSchema);
