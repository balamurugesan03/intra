import mongoose from 'mongoose';
import { autoCode, opts, ref } from './plugins.js';
import { ACTIVITY_TYPES, TICKET_CATEGORIES, TICKET_STATUS, PRIORITIES } from '../config/constants.js';

/* ---------------- Activity (calls, meetings, follow-ups with a lead / client) ---------------- */
const activitySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ACTIVITY_TYPES, default: 'Call' },
    subject: { type: String, required: true, trim: true },
    lead: ref('Lead'),
    client: ref('Client'),
    quotation: ref('Quotation'),
    date: { type: Date, default: Date.now },
    outcome: String,
    nextFollowUp: Date,
    nextAction: String,
    // Open = the next follow-up is still pending; closed when done or when a newer activity is logged
    status: { type: String, enum: ['Open', 'Done'], default: 'Done' },
    by: ref('User'),
  },
  opts,
);
activitySchema.pre('save', function () {
  if (this.isModified('nextFollowUp')) this.status = this.nextFollowUp ? 'Open' : 'Done';
});
autoCode(activitySchema, 'ACT');
export const Activity = mongoose.model('Activity', activitySchema);

/* ---------------- Service ticket (complaints, snags, warranty after handover) ---------------- */
const ticketSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    client: ref('Client'),
    project: ref('Project'),
    category: { type: String, enum: TICKET_CATEGORIES, default: 'Complaint' },
    priority: { type: String, enum: PRIORITIES, default: 'Medium' },
    location: String,
    description: String,
    photos: [String],
    status: { type: String, enum: TICKET_STATUS, default: 'Open' },
    assignedTo: ref('User'),
    raisedBy: ref('User'),
    dueDate: Date,
    task: ref('Task'),
    resolution: String,
    resolvedAt: Date,
  },
  opts,
);
ticketSchema.pre('save', function () {
  if (this.isModified('status')) this.resolvedAt = ['Resolved', 'Closed'].includes(this.status) ? this.resolvedAt || new Date() : undefined;
});
autoCode(ticketSchema, 'TKT');
export const Ticket = mongoose.model('Ticket', ticketSchema);
