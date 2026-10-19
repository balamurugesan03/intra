import {
  UserPlus, ArrowRightCircle, CalendarPlus, Calculator, FileText, Send, CheckCircle2, XCircle, Copy, FolderKanban,
  ShoppingCart, PackageCheck, Receipt, BadgeCheck, Wallet, Eye, Ban, Users, Building2, Ruler, Truck, ClipboardList,
  HardHat, Package, Boxes, Banknote, CreditCard, Briefcase, Store, Contact, Target, MapPin, ListChecks, Award,
  MessageSquare, LifeBuoy, Wrench, IdCard, CalendarOff, HandCoins, FileSpreadsheet, CheckCheck,
} from 'lucide-react';
import * as C from '../lib/constants';
import { money, number, fmtDate } from '../lib/format';
import { Badge, Progress } from '../components/ui';

/* ---------------- shared ref definitions ---------------- */
const codeName = (o) => (o ? `${o.code ? `${o.code} · ` : ''}${o.name || o.title || ''}` : '');
export const REF = {
  project: { module: 'projects', endpoint: '/projects', label: codeName, sub: (o) => o.client?.name },
  client: { module: 'clients', endpoint: '/clients', label: codeName, sub: (o) => o.phone },
  lead: { module: 'leads', endpoint: '/leads', label: codeName, sub: (o) => `${o.status} · ${o.phone}` },
  siteVisit: { module: 'siteVisits', endpoint: '/site-visits', label: (o) => `${o.code} · ${fmtDate(o.date)}`, sub: (o) => o.client?.name || o.lead?.name },
  boq: { module: 'boq', endpoint: '/boq', label: codeName },
  material: { module: 'materials', endpoint: '/materials', label: (o) => o.name, sub: (o) => `${o.code} · ${o.category} · ₹${o.rate}/${o.unit}` },
  vendor: { module: 'vendors', endpoint: '/vendors', label: codeName, sub: (o) => o.category },
  subcontractor: { module: 'subcontractors', endpoint: '/subcontractors', label: (o) => `${o.code} · ${o.company || o.name}`, sub: (o) => o.trade },
  worker: { module: 'workers', endpoint: '/workers', label: codeName, sub: (o) => `${o.trade} · ₹${o.dailyWage}/day` },
  workOrder: { module: 'workOrders', endpoint: '/work-orders', label: codeName, sub: (o) => o.subcontractor?.name },
  materialRequest: { module: 'materialRequests', endpoint: '/material-requests', label: (o) => o.code },
  staff: { endpoint: '/users/lookup', lookup: true, label: (o) => o.name, sub: (o) => o.role },
  task: { module: 'tasks', endpoint: '/tasks', label: codeName },
  room: { module: 'rooms', endpoint: '/rooms', label: (o) => o.name },
  quotation: { module: 'quotations', endpoint: '/quotations', label: (o) => `${o.code} v${o.version} · ${o.title}`, sub: (o) => o.client?.name },
  employee: { module: 'employees', endpoint: '/employees', label: codeName, sub: (o) => [o.designation, o.department].filter(Boolean).join(' · ') },
};

const nameCell = (primary, secondary) => (r) => (
  <div className="min-w-0">
    <div className="truncate font-medium text-slate-900 dark:text-white">{primary(r)}</div>
    {secondary && <div className="truncate text-xs text-slate-500">{secondary(r)}</div>}
  </div>
);
const projectCol = { key: 'project', label: 'Project', render: (r) => (r.project ? <span className="text-slate-700 dark:text-slate-300">{r.project.code} · {r.project.name}</span> : <span className="text-slate-400">Main Warehouse</span>), hideWhenFixed: true };
const code = { key: 'code', label: 'Code', type: 'code' };
const projectField = (extra = {}) => ({ name: 'project', label: 'Project', type: 'ref', ref: REF.project, required: true, ...extra });
const go = (ctx, url, body, success) => ctx.action.mutate({ url, body, success });

const lineTotal = (r) => (Number(r.quantity) || 0) * (Number(r.rate) || 0);
const itemsBase = (extra = []) => [
  { name: 'description', label: 'Description', required: true, width: '40%' },
  ...extra,
  { name: 'unit', label: 'Unit', type: 'select', options: C.UNITS, default: 'Sqft', width: 90 },
  { name: 'quantity', label: 'Qty', type: 'number', width: 90 },
  { name: 'rate', label: 'Rate', type: 'number', width: 110 },
  { name: 'amount', label: 'Amount', computed: lineTotal, width: 120 },
];
const gstSummary = (v, extra = {}) => {
  const sub = (v.items || []).reduce((s, r) => s + lineTotal(r), 0);
  const disc = (sub * (Number(v.discountPercent) || 0)) / 100;
  const taxable = sub - disc;
  const gst = (taxable * (Number(v.gstPercent) || 0)) / 100;
  const ret = (sub * (Number(v.retentionPercent) || 0)) / 100;
  return [
    { label: 'Subtotal', value: money(sub, true) },
    extra.discount && { label: `Discount (${v.discountPercent || 0}%)`, value: `- ${money(disc, true)}` },
    { label: `GST (${v.gstPercent || 0}%)`, value: money(gst, true) },
    extra.retention && Number(v.retentionPercent) > 0 && { label: `Retention (${v.retentionPercent}%)`, value: `- ${money(ret, true)}` },
    { label: 'Grand Total', value: money(taxable + gst - ret, true), strong: true },
  ].filter(Boolean);
};

/* =====================================================================
 * SALES & CRM
 * ===================================================================== */
export const leads = {
  key: 'leads', endpoint: '/leads', module: 'leads', icon: Target,
  title: 'Leads', singular: 'Lead', description: 'Capture enquiries and move them through the sales funnel.',
  searchPlaceholder: 'Search name, phone, location…',
  emptyText: 'Add your first enquiry to start the Lead → Project flow.',
  columns: [
    code,
    { key: 'name', label: 'Lead', render: nameCell((r) => r.name, (r) => r.phone) },
    { key: 'projectType', label: 'Type', type: 'status' },
    { key: 'location', label: 'Location' },
    { key: 'budget', label: 'Budget', type: 'currency' },
    { key: 'source', label: 'Source' },
    { key: 'followUpDate', label: 'Follow-up', render: (r) => (r.followUpDate ? <span className={new Date(r.followUpDate) < new Date() && !['Won', 'Lost'].includes(r.status) ? 'font-medium text-red-600' : ''}>{fmtDate(r.followUpDate)}</span> : '—') },
    { key: 'assignedTo.name', label: 'Owner' },
    { key: 'status', label: 'Status', type: 'status' },
  ],
  filters: [
    { name: 'status', label: 'Status', options: C.LEAD_STATUS },
    { name: 'projectType', label: 'Type', options: C.PROJECT_TYPES },
    { name: 'source', label: 'Source', options: C.LEAD_SOURCES },
  ],
  fields: [
    { name: 'name', label: 'Name', required: true, section: 'Contact' },
    { name: 'phone', label: 'Phone', type: 'tel', required: true, section: 'Contact' },
    { name: 'email', label: 'Email', type: 'email', section: 'Contact' },
    { name: 'company', label: 'Company', section: 'Contact' },
    { name: 'projectType', label: 'Project type', type: 'select', options: C.PROJECT_TYPES, required: true, default: 'Interior', section: 'Requirement' },
    { name: 'budget', label: 'Budget', type: 'currency', section: 'Requirement' },
    { name: 'location', label: 'Site location', span: 2, section: 'Requirement' },
    { name: 'requirement', label: 'Requirement', type: 'textarea', section: 'Requirement' },
    { name: 'source', label: 'Source', type: 'select', options: C.LEAD_SOURCES, default: 'Walk-in', section: 'Follow-up' },
    { name: 'status', label: 'Status', type: 'select', options: C.LEAD_STATUS, default: 'New', section: 'Follow-up' },
    { name: 'assignedTo', label: 'Assigned to', type: 'ref', ref: REF.staff, section: 'Follow-up' },
    { name: 'followUpDate', label: 'Next follow-up', type: 'date', section: 'Follow-up' },
    { name: 'lostReason', label: 'Reason lost', placeholder: 'Price, timeline, went with competitor…', showIf: (v) => v.status === 'Lost', section: 'Follow-up' },
    { name: 'notes', label: 'Notes', type: 'textarea', section: 'Follow-up' },
  ],
  rowActions: (r, ctx) => [
    ctx.can('activities', 'edit') && !['Won', 'Lost'].includes(r.status) && { label: 'Log call / follow-up', icon: MessageSquare, onClick: () => ctx.nav(`/crm/activities?create=1&lead=${r._id}`) },
    !r.client && { label: 'Convert to client', icon: UserPlus, onClick: () => go(ctx, `/leads/${r._id}/convert`, null, 'Client created from lead') },
    { label: 'Schedule site visit', icon: CalendarPlus, onClick: () => ctx.nav(`/site-visits?create=1&lead=${r._id}`) },
    r.client && { label: 'Prepare BOQ', icon: Calculator, onClick: () => ctx.nav(`/boq?create=1&lead=${r._id}&client=${r.client._id || r.client}&projectType=${r.projectType}`) },
    !['Won', 'Lost'].includes(r.status) && ctx.can('leads', 'edit') && { label: 'Mark as lost', icon: XCircle, onClick: () => ctx.action.mutate({ url: `/leads/${r._id}`, method: 'put', body: { status: 'Lost' }, success: 'Lead marked lost' }) },
  ],
};

export const clients = {
  key: 'clients', endpoint: '/clients', module: 'clients', icon: Contact,
  title: 'Clients', singular: 'Client', description: 'Customer master — every quotation, project and invoice links here.',
  searchPlaceholder: 'Search name, phone, city…',
  columns: [
    code,
    { key: 'name', label: 'Client', render: nameCell((r) => r.name, (r) => r.company) },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'city', label: 'City' },
    { key: 'gstin', label: 'GSTIN' },
    { key: 'createdAt', label: 'Since', type: 'date' },
  ],
  fields: [
    { name: 'name', label: 'Name', required: true },
    { name: 'company', label: 'Company' },
    { name: 'phone', label: 'Phone', type: 'tel', required: true },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'address', label: 'Address', type: 'textarea' },
    { name: 'city', label: 'City' },
    { name: 'gstin', label: 'GSTIN' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
  onRowClick: (r, ctx) => ctx.nav(`/clients/${r._id}`),
  rowActions: (r, ctx) => [
    { label: 'Open client 360°', icon: Eye, onClick: () => ctx.nav(`/clients/${r._id}`) },
    ctx.can('activities', 'edit') && { label: 'Log call / follow-up', icon: MessageSquare, onClick: () => ctx.nav(`/crm/activities?create=1&client=${r._id}`) },
    { label: 'Schedule site visit', icon: CalendarPlus, onClick: () => ctx.nav(`/site-visits?create=1&client=${r._id}`) },
    { label: 'Prepare BOQ', icon: Calculator, onClick: () => ctx.nav(`/boq?create=1&client=${r._id}`) },
    { label: 'View projects', icon: FolderKanban, onClick: () => ctx.nav(`/projects?client=${r._id}`) },
  ],
};

export const siteVisits = {
  key: 'site-visits', endpoint: '/site-visits', module: 'siteVisits', icon: MapPin,
  title: 'Site Visits', singular: 'Site Visit', description: 'Schedule visits, capture requirements and measurements on site.',
  columns: [
    code,
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'client', label: 'Client / Lead', render: nameCell((r) => r.client?.name || r.lead?.name || '—', (r) => r.lead?.code) },
    { key: 'address', label: 'Address' },
    { key: 'visitedBy.name', label: 'Visited by' },
    { key: 'status', label: 'Status', type: 'status' },
  ],
  filters: [{ name: 'status', label: 'Status', options: C.SITE_VISIT_STATUS }],
  fields: [
    { name: 'lead', label: 'Lead', type: 'ref', ref: REF.lead },
    { name: 'client', label: 'Client', type: 'ref', ref: REF.client, help: 'Auto-filled from the lead once converted' },
    { name: 'date', label: 'Visit date', type: 'date', required: true },
    { name: 'visitedBy', label: 'Visited by', type: 'ref', ref: REF.staff },
    { name: 'address', label: 'Site address', span: 2 },
    { name: 'status', label: 'Status', type: 'select', options: C.SITE_VISIT_STATUS, default: 'Scheduled' },
    { name: 'requirement', label: 'Client requirement', type: 'textarea' },
    { name: 'observations', label: 'Site observations', type: 'textarea' },
    { name: 'measurements', label: 'Measurements', type: 'textarea' },
    { name: 'photos', label: 'Site photos', type: 'files' },
  ],
  rowActions: (r, ctx) => [
    { label: 'Prepare BOQ / estimate', icon: Calculator, onClick: () => ctx.nav(`/boq?create=1&siteVisit=${r._id}${r.client ? `&client=${r.client._id}` : ''}${r.lead ? `&lead=${r.lead._id}` : ''}`) },
  ],
};

const boqItemCost = (r) => (Number(r.quantity) || 0) * ((Number(r.materialRate) || 0) + (Number(r.labourRate) || 0));
export const boq = {
  key: 'boq', endpoint: '/boq', module: 'boq', icon: Calculator,
  title: 'BOQ / Estimation', singular: 'BOQ', description: 'Item-wise material & labour estimation with margin — the base for quotations.',
  formWidth: 'max-w-5xl',
  columns: [
    code,
    { key: 'title', label: 'Estimate', render: nameCell((r) => r.title, (r) => r.client?.name) },
    { key: 'projectType', label: 'Type', type: 'status' },
    { key: 'materialTotal', label: 'Material', type: 'currency' },
    { key: 'labourTotal', label: 'Labour', type: 'currency' },
    { key: 'costTotal', label: 'Cost', type: 'currency' },
    { key: 'profitMargin', label: 'Margin', type: 'percent' },
    { key: 'total', label: 'Quote Value', type: 'currency' },
    { key: 'status', label: 'Status', type: 'status' },
  ],
  filters: [{ name: 'status', label: 'Status', options: C.BOQ_STATUS }, { name: 'projectType', label: 'Type', options: C.PROJECT_TYPES }],
  fields: [
    { name: 'title', label: 'Estimate title', required: true, span: 2 },
    { name: 'client', label: 'Client', type: 'ref', ref: REF.client },
    { name: 'lead', label: 'Lead', type: 'ref', ref: REF.lead },
    { name: 'siteVisit', label: 'Site visit', type: 'ref', ref: REF.siteVisit },
    { name: 'projectType', label: 'Project type', type: 'select', options: C.PROJECT_TYPES, default: 'Interior' },
    {
      name: 'items', label: 'Estimate items', type: 'items', itemLabel: 'line',
      columns: [
        { name: 'area', label: 'Area / Floor', width: 120 },
        { name: 'description', label: 'Item description', required: true, width: '30%' },
        { name: 'unit', label: 'Unit', type: 'select', options: C.UNITS, default: 'Sqft', width: 85 },
        { name: 'quantity', label: 'Qty', type: 'number', width: 80 },
        { name: 'materialRate', label: 'Material rate', type: 'number', width: 105 },
        { name: 'labourRate', label: 'Labour rate', type: 'number', width: 100 },
        { name: 'amount', label: 'Cost', computed: boqItemCost, width: 110 },
      ],
      total: boqItemCost,
    },
    { name: 'otherExpenses', label: 'Other expenses (transport, overheads)', type: 'currency', default: 0 },
    { name: 'profitMargin', label: 'Profit margin', type: 'percent', default: 15 },
    { name: 'status', label: 'Status', type: 'select', options: C.BOQ_STATUS, default: 'Draft' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
  summary: (v) => {
    const items = v.items || [];
    const mat = items.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.materialRate) || 0), 0);
    const lab = items.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.labourRate) || 0), 0);
    const cost = mat + lab + (Number(v.otherExpenses) || 0);
    const profit = (cost * (Number(v.profitMargin) || 0)) / 100;
    return [
      { label: 'Material cost', value: money(mat) }, { label: 'Labour cost', value: money(lab) },
      { label: 'Other expenses', value: money(v.otherExpenses || 0) }, { label: 'Total cost', value: money(cost) },
      { label: `Profit (${v.profitMargin || 0}%)`, value: money(profit) }, { label: 'Quotation value (pre-GST)', value: money(cost + profit), strong: true },
    ];
  },
  rowActions: (r, ctx) => [
    { label: 'Create quotation', icon: FileText, onClick: () => ctx.action.mutate({ url: `/boq/${r._id}/quotation`, success: 'Quotation created' }, { onSuccess: (q) => ctx.nav(`/quotations/${q._id}`) }) },
  ],
};

export const quotations = {
  key: 'quotations', endpoint: '/quotations', module: 'quotations', icon: FileText,
  title: 'Quotations', singular: 'Quotation', description: 'Versioned quotations with discount & GST. Approved quotes convert to projects.',
  formWidth: 'max-w-5xl',
  columns: [
    { key: 'code', label: 'Quote No', render: (r) => <span className="font-mono text-xs font-semibold text-brand-700 dark:text-brand-400">{r.code} <span className="text-slate-400">v{r.version}</span></span> },
    { key: 'title', label: 'Title', render: nameCell((r) => r.title, (r) => r.client?.name) },
    { key: 'projectType', label: 'Type', type: 'status' },
    { key: 'grandTotal', label: 'Amount', type: 'currency' },
    { key: 'validUntil', label: 'Valid until', type: 'date' },
    { key: 'createdAt', label: 'Created', type: 'date' },
    { key: 'status', label: 'Status', type: 'status' },
  ],
  filters: [{ name: 'status', label: 'Status', options: C.QUOTATION_STATUS }, { name: 'client', label: 'Client', ref: REF.client }],
  onRowClick: (r, ctx) => ctx.nav(`/quotations/${r._id}`),
  canEditRow: (r) => !['Converted', 'Revised'].includes(r.status),
  fields: [
    { name: 'title', label: 'Title', required: true, span: 2 },
    { name: 'client', label: 'Client', type: 'ref', ref: REF.client, required: true },
    { name: 'projectType', label: 'Project type', type: 'select', options: C.PROJECT_TYPES, default: 'Interior' },
    { name: 'siteAddress', label: 'Site address', span: 2 },
    { name: 'items', label: 'Quotation items', type: 'items', columns: itemsBase([{ name: 'area', label: 'Area', width: 120 }]), total: lineTotal },
    { name: 'discountPercent', label: 'Discount', type: 'percent', default: 0 },
    { name: 'gstPercent', label: 'GST', type: 'percent', default: 18 },
    { name: 'validUntil', label: 'Valid until', type: 'date' },
    { name: 'terms', label: 'Terms & conditions', type: 'textarea', rows: 4 },
  ],
  summary: (v) => gstSummary(v, { discount: true }),
  afterCreate: (q, ctx) => ctx.nav(`/quotations/${q._id}`),
};

const overdue = (d) => d && new Date(d) < new Date(new Date().toDateString());
export const activities = {
  key: 'activities', endpoint: '/activities', module: 'activities', icon: MessageSquare,
  title: 'Follow-ups & Activities', singular: 'Activity', createLabel: 'Log activity',
  description: 'Every call, meeting and message with leads and clients — and the next follow-up.',
  searchPlaceholder: 'Search subject, outcome…',
  emptyText: 'Log a call or meeting from a lead or client to start the follow-up trail.',
  columns: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'type', label: 'Type', type: 'status' },
    { key: 'subject', label: 'Activity', render: nameCell((r) => r.subject, (r) => r.outcome) },
    { key: 'party', label: 'Lead / Client', render: nameCell((r) => r.lead?.name || r.client?.name || '—', (r) => [r.lead?.code || r.client?.code, r.quotation && `${r.quotation.code} v${r.quotation.version}`].filter(Boolean).join(' · ')), exportValue: (r) => r.lead?.name || r.client?.name },
    { key: 'nextFollowUp', label: 'Next follow-up', render: (r) => (r.status === 'Open' && r.nextFollowUp ? <span className={overdue(r.nextFollowUp) ? 'font-medium text-red-600' : ''}>{fmtDate(r.nextFollowUp)}{r.nextAction ? ` · ${r.nextAction}` : ''}</span> : '—') },
    { key: 'by.name', label: 'By' },
    { key: 'status', label: 'Follow-up', render: (r) => <Badge tone={r.status === 'Open' ? 'amber' : 'green'} dot>{r.status === 'Open' ? 'Pending' : 'Done'}</Badge> },
  ],
  filters: [
    { name: 'status', label: 'Follow-up', options: [{ value: 'Open', label: 'Pending' }, { value: 'Done', label: 'Done' }] },
    { name: 'type', label: 'Type', options: C.ACTIVITY_TYPES },
    { name: 'lead', label: 'Lead', ref: REF.lead },
  ],
  defaults: () => ({ date: new Date().toISOString() }),
  fields: [
    { name: 'type', label: 'Type', type: 'select', options: C.ACTIVITY_TYPES, default: 'Call' },
    { name: 'date', label: 'Date', type: 'date' },
    { name: 'subject', label: 'Subject', required: true, span: 2, placeholder: 'e.g. Discussed revised kitchen layout' },
    { name: 'lead', label: 'Lead', type: 'ref', ref: REF.lead },
    { name: 'client', label: 'Client', type: 'ref', ref: REF.client, help: 'Auto-filled from the lead once converted' },
    { name: 'quotation', label: 'About quotation', type: 'ref', ref: { ...REF.quotation, params: (v) => ({ client: v.client || undefined }) }, span: 2 },
    { name: 'outcome', label: 'Outcome / notes', type: 'textarea' },
    { name: 'nextFollowUp', label: 'Next follow-up', type: 'date', help: 'Updates the lead and shows in notifications' },
    { name: 'nextAction', label: 'Next action', placeholder: 'e.g. Call back with revised quote' },
  ],
  rowActions: (r, ctx) => [
    r.status === 'Open' && ctx.can('activities', 'edit') && { label: 'Mark follow-up done', icon: CheckCheck, onClick: () => ctx.action.mutate({ url: `/activities/${r._id}`, method: 'put', body: { status: 'Done' }, success: 'Follow-up closed' }) },
    r.client && ctx.can('clients') && { label: 'Open client 360°', icon: Eye, onClick: () => ctx.nav(`/clients/${r.client._id}`) },
    r.quotation && ctx.can('quotations') && { label: 'View quotation', icon: FileText, onClick: () => ctx.nav(`/quotations/${r.quotation._id}`) },
  ],
};

export const tickets = {
  key: 'tickets', endpoint: '/tickets', module: 'tickets', icon: LifeBuoy,
  title: 'Service & Complaints', singular: 'Ticket', createLabel: 'Raise ticket',
  description: 'After handover: snags, complaints and warranty calls → rework task → resolved.',
  searchPlaceholder: 'Search issue, location…',
  emptyText: 'Raise a ticket when a client reports a snag or complaint.',
  columns: [
    code,
    { key: 'title', label: 'Issue', render: nameCell((r) => r.title, (r) => [r.category, r.location].filter(Boolean).join(' · ')) },
    { key: 'client', label: 'Client / Project', render: nameCell((r) => r.client?.name || '—', (r) => r.project?.name), exportValue: (r) => r.client?.name, hideWhenFixed: true },
    { key: 'priority', label: 'Priority', type: 'status' },
    { key: 'assignedTo.name', label: 'Assigned to' },
    { key: 'dueDate', label: 'Resolve by', render: (r) => <span className={overdue(r.dueDate) && ['Open', 'In Progress'].includes(r.status) ? 'font-medium text-red-600' : ''}>{fmtDate(r.dueDate)}</span> },
    { key: 'task', label: 'Rework task', render: (r) => (r.task ? <span className="font-mono text-xs">{r.task.code} · {r.task.status}</span> : '—'), exportValue: (r) => r.task?.code },
    { key: 'status', label: 'Status', type: 'status' },
  ],
  filters: [
    { name: 'status', label: 'Status', options: C.TICKET_STATUS },
    { name: 'priority', label: 'Priority', options: C.PRIORITIES },
    { name: 'category', label: 'Category', options: C.TICKET_CATEGORIES },
    { name: 'project', label: 'Project', ref: REF.project },
  ],
  fields: [
    { name: 'title', label: 'Issue', required: true, span: 2, placeholder: 'e.g. Wardrobe shutter not aligned' },
    projectField({ required: false, help: 'The client is taken from the project' }),
    { name: 'client', label: 'Client', type: 'ref', ref: REF.client, showIf: (v) => !v.project, staffOnly: true },
    { name: 'category', label: 'Category', type: 'select', options: C.TICKET_CATEGORIES, default: 'Complaint' },
    { name: 'priority', label: 'Priority', type: 'select', options: C.PRIORITIES, default: 'Medium' },
    { name: 'location', label: 'Location / area', placeholder: 'e.g. Master bedroom' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'photos', label: 'Photos', type: 'files' },
    { name: 'assignedTo', label: 'Assign to', type: 'ref', ref: { ...REF.staff, params: { role: 'Project Manager,Site Engineer,Site Supervisor,Designer' } }, staffOnly: true },
    { name: 'dueDate', label: 'Resolve by', type: 'date', staffOnly: true },
    { name: 'status', label: 'Status', type: 'select', options: C.TICKET_STATUS, default: 'Open', staffOnly: true },
    { name: 'resolution', label: 'Resolution', type: 'textarea', showIf: (v) => ['Resolved', 'Closed'].includes(v.status), staffOnly: true },
  ],
  rowActions: (r, ctx) => [
    ctx.can('tasks', 'edit') && r.project && !r.task && ['Open', 'In Progress'].includes(r.status) && { label: 'Create rework task', icon: Wrench, onClick: () => go(ctx, `/tickets/${r._id}/task`, null, 'Rework task created on the project') },
    r.task && ctx.can('tasks') && { label: 'View rework task', icon: ListChecks, onClick: () => ctx.nav(`/projects/${r.project._id}?tab=tasks`) },
    r.status === 'Resolved' && ctx.can('tasks', 'edit') && { label: 'Close ticket', icon: CheckCheck, onClick: () => ctx.action.mutate({ url: `/tickets/${r._id}`, method: 'put', body: { status: 'Closed' }, success: 'Ticket closed' }) },
  ],
};

/* =====================================================================
 * PROJECTS
 * ===================================================================== */
export const projects = {
  key: 'projects', endpoint: '/projects', module: 'projects', icon: FolderKanban,
  title: 'Projects', singular: 'Project', description: 'All construction, interior and renovation projects.',
  columns: [
    code,
    { key: 'name', label: 'Project', render: nameCell((r) => r.name, (r) => r.client?.name) },
    { key: 'projectType', label: 'Type', type: 'status' },
    { key: 'manager.name', label: 'Manager' },
    { key: 'endDate', label: 'Due', type: 'date' },
    { key: 'contractValue', label: 'Value', type: 'currency' },
    { key: 'progress', label: 'Progress', type: 'progress' },
    { key: 'status', label: 'Status', type: 'status' },
  ],
  filters: [{ name: 'status', label: 'Status', options: C.PROJECT_STATUS }, { name: 'projectType', label: 'Type', options: C.PROJECT_TYPES }],
  onRowClick: (r, ctx) => ctx.nav(`/projects/${r._id}`),
  fields: [
    { name: 'name', label: 'Project name', required: true, span: 2, section: 'Project' },
    { name: 'client', label: 'Client', type: 'ref', ref: REF.client, required: true, section: 'Project' },
    { name: 'projectType', label: 'Project type', type: 'select', options: C.PROJECT_TYPES, default: 'Interior', section: 'Project' },
    { name: 'siteAddress', label: 'Site address', span: 2, section: 'Project' },
    { name: 'city', label: 'City', section: 'Project' },
    { name: 'status', label: 'Status', type: 'select', options: C.PROJECT_STATUS, default: 'Planning', section: 'Project' },
    { name: 'startDate', label: 'Start date', type: 'date', section: 'Schedule & Budget' },
    { name: 'endDate', label: 'Expected end date', type: 'date', section: 'Schedule & Budget' },
    { name: 'contractValue', label: 'Contract value (client)', type: 'currency', section: 'Schedule & Budget' },
    { name: 'budget', label: 'Cost budget', type: 'currency', section: 'Schedule & Budget' },
    { name: 'manager', label: 'Project manager', type: 'ref', ref: { ...REF.staff, params: { role: 'Project Manager,Admin,Super Admin' } }, section: 'Team' },
    { name: 'team', label: 'Team members', type: 'multiref', ref: REF.staff, section: 'Team' },
    { name: 'description', label: 'Description', type: 'textarea', section: 'Team' },
  ],
  afterCreate: (p, ctx) => ctx.nav(`/projects/${p._id}`),
};

export const tasks = {
  key: 'tasks', endpoint: '/tasks', module: 'tasks', icon: ListChecks,
  title: 'Tasks', singular: 'Task', description: 'Floor/area-wise work plan with owners, priorities and dependencies.',
  columns: [
    code,
    { key: 'title', label: 'Task', render: nameCell((r) => r.title, (r) => [r.area, r.dependsOn?.length ? `Depends on ${r.dependsOn.map((d) => d.code).join(', ')}` : null].filter(Boolean).join(' · ')) },
    { ...projectCol },
    { key: 'assignedTo.name', label: 'Assignee' },
    { key: 'dueDate', label: 'Due', render: (r) => <span className={r.dueDate && new Date(r.dueDate) < new Date(new Date().toDateString()) && r.status !== 'Done' ? 'font-medium text-red-600' : ''}>{fmtDate(r.dueDate)}</span> },
    { key: 'priority', label: 'Priority', type: 'status' },
    { key: 'progress', label: 'Progress', type: 'progress' },
    { key: 'status', label: 'Status', type: 'status' },
  ],
  filters: [
    { name: 'project', label: 'Project', ref: REF.project },
    { name: 'status', label: 'Status', options: C.TASK_STATUS },
    { name: 'priority', label: 'Priority', options: C.PRIORITIES },
  ],
  fields: [
    projectField(),
    { name: 'title', label: 'Task title', required: true },
    { name: 'area', label: 'Floor / Area', placeholder: 'e.g. Kitchen, First Floor' },
    { name: 'assignedTo', label: 'Assign to', type: 'ref', ref: { endpoint: '/users/lookup', lookup: true, label: (o) => o.name, sub: (o) => o.role, params: { role: 'Project Manager,Site Engineer,Site Supervisor,Designer,Worker,Contractor' } } },
    { name: 'team', label: 'Team / Crew', placeholder: 'e.g. Carpentry team' },
    { name: 'priority', label: 'Priority', type: 'select', options: C.PRIORITIES, default: 'Medium' },
    { name: 'startDate', label: 'Start date', type: 'date' },
    { name: 'dueDate', label: 'Due date', type: 'date' },
    { name: 'status', label: 'Status', type: 'select', options: C.TASK_STATUS, default: 'To Do' },
    { name: 'progress', label: 'Progress', type: 'percent', default: 0, min: 0, max: 100 },
    { name: 'dependsOn', label: 'Depends on', type: 'multiref', ref: { ...REF.task, params: (v) => ({ project: v.project }) }, span: 2, help: 'Task cannot start until these are done' },
    { name: 'description', label: 'Description', type: 'textarea' },
  ],
  rowActions: (r, ctx) => [
    r.status === 'To Do' && ctx.can('tasks', 'edit') && { label: 'Start task', icon: ArrowRightCircle, onClick: () => ctx.action.mutate({ url: `/tasks/${r._id}`, method: 'put', body: { status: 'In Progress' }, success: 'Task started' }) },
    r.status !== 'Done' && ctx.can('tasks', 'edit') && { label: 'Mark done', icon: CheckCircle2, onClick: () => ctx.action.mutate({ url: `/tasks/${r._id}`, method: 'put', body: { status: 'Done' }, success: 'Task completed' }) },
  ],
};

export const dailyReports = {
  key: 'daily-reports', endpoint: '/daily-reports', module: 'dailyReports', icon: ClipboardList,
  title: 'Daily Site Reports', singular: 'Daily Report', description: 'Work done, pending, labour, issues and photos — every day, every site.',
  columns: [
    code,
    { key: 'date', label: 'Date', type: 'date' },
    { ...projectCol },
    { key: 'workDone', label: 'Work done', render: (r) => <span className="line-clamp-1 max-w-xs whitespace-normal">{r.workDone}</span> },
    { key: 'labourCount', label: 'Labour', type: 'number' },
    { key: 'issues', label: 'Issues', render: (r) => (r.issues ? <Badge tone="red">Issue</Badge> : <span className="text-slate-400">—</span>) },
    { key: 'submittedBy.name', label: 'By' },
    { key: 'status', label: 'Status', type: 'status' },
  ],
  filters: [{ name: 'project', label: 'Project', ref: REF.project }, { name: 'status', label: 'Status', options: ['Submitted', 'Reviewed'] }],
  defaults: () => ({ date: new Date().toISOString() }),
  fields: [
    projectField(),
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'weather', label: 'Weather', type: 'select', options: ['Clear', 'Cloudy', 'Rainy', 'Hot'], default: 'Clear' },
    { name: 'labourCount', label: 'Labour on site', type: 'number' },
    { name: 'workDone', label: 'Work completed today', type: 'textarea', required: true },
    { name: 'workPending', label: 'Work pending', type: 'textarea' },
    { name: 'materialsUsed', label: 'Materials used', type: 'textarea', rows: 2 },
    { name: 'instructions', label: 'Site instructions', type: 'textarea', rows: 2 },
    { name: 'issues', label: 'Issues / hindrances', type: 'textarea', rows: 2 },
    { name: 'progress', label: 'Overall progress', type: 'percent', min: 0, max: 100, help: 'Leave blank to use current project progress' },
    { name: 'status', label: 'Status', type: 'select', options: ['Submitted', 'Reviewed'], default: 'Submitted' },
    { name: 'photos', label: 'Site photos / videos', type: 'files' },
  ],
};

export const rooms = {
  key: 'rooms', endpoint: '/rooms', module: 'rooms', title: 'Interior Design', singular: 'Room / Area', formWidth: 'max-w-4xl',
  columns: [],
  fields: [
    projectField({ section: 'Room' }),
    { name: 'name', label: 'Room / area name', required: true, section: 'Room' },
    { name: 'roomType', label: 'Room type', type: 'select', options: C.ROOM_TYPES, default: 'Living Room', section: 'Room' },
    { name: 'areaSqft', label: 'Area (sqft)', type: 'number', section: 'Room' },
    { name: 'designer', label: 'Designer', type: 'ref', ref: { ...REF.staff, params: { role: 'Designer' } }, section: 'Room' },
    { name: 'designStatus', label: 'Design status', type: 'select', options: C.DESIGN_STATUS, default: 'Concept', section: 'Room' },
    { name: 'designImages', label: 'Design references / 3D views', type: 'files', section: 'Design' },
    {
      name: 'materials', label: 'Material selection', type: 'items', itemLabel: 'material', section: 'Design',
      columns: [
        { name: 'item', label: 'Item', width: '22%' }, { name: 'specification', label: 'Specification / finish', width: '30%' },
        { name: 'brand', label: 'Brand' }, { name: 'quantity', label: 'Qty', type: 'number', width: 80 },
        { name: 'unit', label: 'Unit', type: 'select', options: C.UNITS, default: 'Nos', width: 90 },
      ],
    },
    {
      name: 'furniture', label: 'Furniture items', type: 'items', itemLabel: 'furniture', section: 'Design',
      columns: [
        { name: 'name', label: 'Item', width: '25%' }, { name: 'specification', label: 'Specification', width: '35%' },
        { name: 'quantity', label: 'Qty', type: 'number', width: 80, default: 1 }, { name: 'cost', label: 'Unit cost', type: 'number', width: 110 },
        { name: 'total', label: 'Total', computed: (r) => (Number(r.quantity) || 0) * (Number(r.cost) || 0), width: 110 },
      ],
      total: (r) => (Number(r.quantity) || 0) * (Number(r.cost) || 0),
    },
    { name: 'customWork', label: 'Custom work', type: 'textarea', section: 'Design' },
  ],
};

export const documents = {
  key: 'documents', endpoint: '/documents', module: 'documents', title: 'Documents & Photos', singular: 'Document',
  columns: [],
  fields: [
    { name: 'fileUrl', label: 'File', type: 'file', required: true, span: 2, onSelect: (f, v) => (f ? { fileName: f.name, mimeType: f.mimeType, size: f.size, title: v.title || f.name.replace(/\.[^.]+$/, '') } : {}) },
    { name: 'title', label: 'Title', required: true },
    { name: 'category', label: 'Category', type: 'select', options: C.DOCUMENT_CATEGORIES, default: 'Site Photo' },
    projectField({ required: false }),
    { name: 'room', label: 'Room (interior)', type: 'ref', ref: { ...REF.room, params: (v) => ({ project: v.project }) } },
    { name: 'notes', label: 'Notes', type: 'textarea' },
    { name: 'fileName', hidden: true }, { name: 'mimeType', hidden: true }, { name: 'size', hidden: true },
  ],
};

/* =====================================================================
 * INVENTORY & PURCHASE
 * ===================================================================== */
export const materials = {
  key: 'materials', endpoint: '/materials', module: 'materials', icon: Package,
  title: 'Material Master', singular: 'Material', description: 'Construction & interior materials with standard rates and re-order levels.',
  pageSize: 50,
  columns: [
    code,
    { key: 'name', label: 'Material', render: nameCell((r) => r.name, (r) => r.brand) },
    { key: 'category', label: 'Category', render: (r) => <Badge tone="slate">{r.category}</Badge> },
    { key: 'unit', label: 'Unit' },
    { key: 'rate', label: 'Std. Rate', type: 'currency' },
    { key: 'minStock', label: 'Min Stock', type: 'number' },
    { key: 'hsn', label: 'HSN' },
  ],
  filters: [{ name: 'category', label: 'Category', options: C.MATERIAL_CATEGORIES }],
  fields: [
    { name: 'name', label: 'Material name', required: true, span: 2 },
    { name: 'category', label: 'Category', type: 'select', options: C.MATERIAL_CATEGORIES, required: true, default: 'Other' },
    { name: 'unit', label: 'Unit', type: 'select', options: C.UNITS, required: true, default: 'Nos' },
    { name: 'rate', label: 'Standard rate', type: 'currency' },
    { name: 'minStock', label: 'Minimum stock (alert level)', type: 'number' },
    { name: 'brand', label: 'Brand' },
    { name: 'hsn', label: 'HSN code' },
    { name: 'description', label: 'Description', type: 'textarea' },
  ],
};

const STOCK_LOC = { ...REF.project, nullLabel: 'Main Warehouse' };
export const stockTxns = {
  key: 'stock-transactions', endpoint: '/stock/transactions', module: 'stock', icon: Boxes,
  title: 'Stock Movements', singular: 'Stock Movement', createLabel: 'Record movement', deletable: true,
  columns: [
    code,
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'type', label: 'Type', type: 'status' },
    { key: 'material', label: 'Material', render: nameCell((r) => r.material?.name, (r) => r.material?.code) },
    { key: 'quantity', label: 'Qty', render: (r) => <span className="tabular-nums">{number(r.quantity)} {r.material?.unit}</span>, align: 'right' },
    { key: 'from', label: 'From', render: (r) => (['Consumption', 'Wastage', 'Transfer'].includes(r.type) ? r.fromProject?.name || 'Main Warehouse' : '—') },
    { key: 'to', label: 'To', render: (r) => (['Receipt', 'Return', 'Transfer'].includes(r.type) ? r.toProject?.name || 'Main Warehouse' : '—') },
    { key: 'value', label: 'Value', type: 'currency' },
    { key: 'remarks', label: 'Remarks' },
  ],
  filters: [{ name: 'type', label: 'Type', options: C.STOCK_TXN_TYPES }, { name: 'material', label: 'Material', ref: REF.material }],
  canEditRow: () => true,
  defaults: () => ({ date: new Date().toISOString(), type: 'Consumption' }),
  fields: [
    { name: 'type', label: 'Movement type', type: 'select', options: C.STOCK_TXN_TYPES, required: true },
    { name: 'date', label: 'Date', type: 'date' },
    { name: 'material', label: 'Material', type: 'ref', ref: REF.material, required: true, span: 2 },
    { name: 'quantity', label: 'Quantity', type: 'number', required: true },
    { name: 'rate', label: 'Rate (blank = standard rate)', type: 'currency' },
    { name: 'fromProject', label: 'From location', type: 'ref', ref: STOCK_LOC, default: null, showIf: (v) => ['Consumption', 'Wastage', 'Transfer'].includes(v.type) },
    { name: 'toProject', label: 'To location', type: 'ref', ref: STOCK_LOC, default: null, showIf: (v) => ['Receipt', 'Return', 'Transfer'].includes(v.type) },
    { name: 'remarks', label: 'Remarks', type: 'textarea', rows: 2 },
  ],
};

const mrItemCols = [
  { name: 'material', label: 'Material', type: 'ref', ref: REF.material, required: true, width: '45%' },
  { name: 'quantity', label: 'Quantity', type: 'number', width: 120 },
  { name: 'remarks', label: 'Remarks' },
];
export const materialRequests = {
  key: 'material-requests', endpoint: '/material-requests', module: 'materialRequests', icon: ClipboardList,
  title: 'Material Requests', singular: 'Material Request', description: 'Site requests → approval → purchase order.', formWidth: 'max-w-3xl',
  columns: [
    code,
    { ...projectCol },
    { key: 'items', label: 'Items', render: (r) => <span className="line-clamp-1 max-w-xs whitespace-normal text-slate-600 dark:text-slate-400">{r.items.map((i) => `${i.material?.name} (${i.quantity} ${i.material?.unit})`).join(', ')}</span> },
    { key: 'requiredDate', label: 'Needed by', type: 'date' },
    { key: 'priority', label: 'Priority', type: 'status' },
    { key: 'requestedBy.name', label: 'Requested by' },
    { key: 'status', label: 'Status', type: 'status' },
  ],
  filters: [{ name: 'project', label: 'Project', ref: REF.project }, { name: 'status', label: 'Status', options: C.MR_STATUS }],
  canEditRow: (r) => r.status === 'Pending',
  fields: [
    projectField(),
    { name: 'requiredDate', label: 'Required by', type: 'date' },
    { name: 'priority', label: 'Priority', type: 'select', options: C.PRIORITIES, default: 'Medium' },
    { name: 'items', label: 'Materials required', type: 'items', itemLabel: 'material', columns: mrItemCols },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
  rowActions: (r, ctx) => [
    r.status === 'Pending' && ctx.can('materialRequests', 'edit') && { label: 'Approve', icon: CheckCircle2, onClick: () => go(ctx, `/material-requests/${r._id}/status`, { status: 'Approved' }, 'Request approved') },
    r.status === 'Pending' && ctx.can('materialRequests', 'edit') && { label: 'Reject', icon: XCircle, onClick: () => go(ctx, `/material-requests/${r._id}/status`, { status: 'Rejected' }, 'Request rejected') },
    r.status === 'Approved' && ctx.can('purchaseOrders', 'edit') && { label: 'Raise purchase order', icon: ShoppingCart, onClick: () => ctx.openPo?.(r) },
  ],
};

export const vendors = {
  key: 'vendors', endpoint: '/vendors', module: 'vendors', icon: Store,
  title: 'Vendors', singular: 'Vendor', description: 'Supplier master with GST and payment terms.',
  columns: [
    code,
    { key: 'name', label: 'Vendor', render: nameCell((r) => r.name, (r) => r.contactPerson) },
    { key: 'category', label: 'Supplies' },
    { key: 'phone', label: 'Phone' },
    { key: 'gstin', label: 'GSTIN' },
    { key: 'paymentTerms', label: 'Terms' },
    { key: 'rating', label: 'Rating', render: (r) => <span className="text-amber-500">{'★'.repeat(Math.round(r.rating || 0))}<span className="text-slate-300 dark:text-slate-700">{'★'.repeat(5 - Math.round(r.rating || 0))}</span></span> },
  ],
  fields: [
    { name: 'name', label: 'Vendor name', required: true, span: 2 },
    { name: 'contactPerson', label: 'Contact person' },
    { name: 'phone', label: 'Phone', type: 'tel', required: true },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'gstin', label: 'GSTIN' },
    { name: 'category', label: 'Supplies (categories)', span: 2, placeholder: 'e.g. Cement, Steel' },
    { name: 'paymentTerms', label: 'Payment terms', default: '30 days' },
    { name: 'rating', label: 'Rating (0-5)', type: 'number', min: 0, max: 5, default: 4 },
    { name: 'address', label: 'Address', type: 'textarea' },
  ],
  rowActions: (r, ctx) => [{ label: 'Purchase orders', icon: ShoppingCart, onClick: () => ctx.nav(`/purchase/orders?vendor=${r._id}`) }],
};

export const rfqs = {
  key: 'rfqs', endpoint: '/rfqs', module: 'rfqs', icon: Send,
  title: 'RFQ', singular: 'RFQ', description: 'Request quotes from multiple vendors, compare and award.', formWidth: 'max-w-4xl',
  columns: [
    code,
    { key: 'title', label: 'RFQ', render: nameCell((r) => r.title, (r) => r.project?.name) },
    { key: 'vendors', label: 'Vendors', render: (r) => r.vendors?.map((v) => v.name).join(', ') || '—' },
    { key: 'responses', label: 'Quotes', render: (r) => `${r.responses?.length || 0} / ${r.vendors?.length || 0}` },
    { key: 'best', label: 'Best quote', render: (r) => { const b = [...(r.responses || [])].filter((x) => x.amount).sort((a, b2) => a.amount - b2.amount)[0]; return b ? `${money(b.amount)} · ${b.vendor?.name}` : '—'; } },
    { key: 'dueDate', label: 'Due', type: 'date' },
    { key: 'status', label: 'Status', type: 'status', render: (r) => (r.status === 'Closed' && r.selectedVendor ? <Badge tone="green" dot>Awarded · {r.selectedVendor.name}</Badge> : <Badge tone={r.status === 'Sent' ? 'blue' : 'slate'} dot>{r.status}</Badge>) },
  ],
  filters: [{ name: 'status', label: 'Status', options: C.RFQ_STATUS }],
  canEditRow: (r) => r.status !== 'Closed',
  fields: [
    { name: 'title', label: 'Title', required: true, span: 2 },
    projectField({ required: false }),
    { name: 'dueDate', label: 'Quote due date', type: 'date' },
    { name: 'items', label: 'Materials', type: 'items', itemLabel: 'material', columns: mrItemCols },
    { name: 'vendors', label: 'Invite vendors', type: 'multiref', ref: REF.vendor, span: 2 },
    { name: 'status', label: 'Status', type: 'select', options: ['Draft', 'Sent'], default: 'Draft' },
    {
      name: 'responses', label: 'Vendor quotes received', type: 'items', itemLabel: 'quote',
      columns: [
        { name: 'vendor', label: 'Vendor', type: 'ref', ref: REF.vendor, width: '35%' },
        { name: 'amount', label: 'Quoted amount', type: 'number', width: 140 },
        { name: 'deliveryDays', label: 'Delivery (days)', type: 'number', width: 120 },
        { name: 'remarks', label: 'Remarks' },
      ],
    },
  ],
  rowActions: (r, ctx) => (r.status !== 'Closed' ? (r.responses || []).filter((x) => x.vendor).map((x) => ({
    label: `Award to ${x.vendor.name}`, icon: Award,
    onClick: () => ctx.action.mutate({ url: `/rfqs/${r._id}/award`, body: { vendor: x.vendor._id }, success: 'Awarded – draft PO created' }, { onSuccess: (po) => ctx.nav(`/purchase/orders/${po._id}`) }),
  })) : []),
};

export const purchaseOrders = {
  key: 'purchase-orders', endpoint: '/purchase-orders', module: 'purchaseOrders', icon: ShoppingCart,
  title: 'Purchase Orders', singular: 'Purchase Order', description: 'Approve, receive goods (GRN) into site / warehouse stock and book purchase invoices.', formWidth: 'max-w-4xl',
  columns: [
    code,
    { key: 'orderDate', label: 'Date', type: 'date' },
    { key: 'vendor.name', label: 'Vendor' },
    { ...projectCol, label: 'Deliver to' },
    { key: 'items', label: 'Items', render: (r) => `${r.items.length} item(s)` },
    { key: 'total', label: 'Total', type: 'currency' },
    { key: 'received', label: 'Received', render: (r) => { const q = r.items.reduce((s, i) => s + i.quantity, 0); const x = r.items.reduce((s, i) => s + i.receivedQty, 0); return <Progress value={q ? (x / q) * 100 : 0} className="w-24" size="sm" />; } },
    { key: 'status', label: 'Status', type: 'status' },
  ],
  filters: [{ name: 'status', label: 'Status', options: C.PO_STATUS }, { name: 'vendor', label: 'Vendor', ref: REF.vendor }],
  onRowClick: (r, ctx) => ctx.nav(`/purchase/orders/${r._id}`),
  canEditRow: (r) => r.status === 'Draft',
  fields: [
    { name: 'vendor', label: 'Vendor', type: 'ref', ref: REF.vendor, required: true },
    { name: 'project', label: 'Deliver to', type: 'ref', ref: STOCK_LOC, default: null },
    { name: 'orderDate', label: 'Order date', type: 'date', default: () => new Date().toISOString() },
    { name: 'expectedDate', label: 'Expected delivery', type: 'date' },
    {
      name: 'items', label: 'Order items', type: 'items', itemLabel: 'material',
      columns: [
        { name: 'material', label: 'Material', type: 'ref', ref: REF.material, required: true, width: '40%', onSelect: (m) => ({ rate: m.rate }) },
        { name: 'quantity', label: 'Qty', type: 'number', width: 100 },
        { name: 'rate', label: 'Rate', type: 'number', width: 120 },
        { name: 'amount', label: 'Amount', computed: lineTotal, width: 130 },
      ],
      total: lineTotal,
    },
    { name: 'gstPercent', label: 'GST', type: 'percent', default: 18 },
    { name: 'notes', label: 'Notes / terms', type: 'textarea' },
  ],
  summary: (v) => gstSummary(v),
  afterCreate: (po, ctx) => ctx.nav(`/purchase/orders/${po._id}`),
};

/* =====================================================================
 * WORKFORCE
 * ===================================================================== */
export const workers = {
  key: 'workers', endpoint: '/workers', module: 'workers', icon: HardHat,
  title: 'Workers', singular: 'Worker', description: 'Skilled & unskilled workforce with daily wages and OT rates.', pageSize: 50,
  columns: [
    code,
    { key: 'name', label: 'Worker', render: nameCell((r) => r.name, (r) => r.phone) },
    { key: 'trade', label: 'Trade' },
    { key: 'skillType', label: 'Skill', type: 'status' },
    { key: 'dailyWage', label: 'Daily Wage', type: 'currency' },
    { key: 'otRate', label: 'OT / hr', type: 'currency' },
    { key: 'currentProject.name', label: 'Current site' },
    { key: 'subcontractor.name', label: 'Contractor' },
    { key: 'active', label: 'Status', render: (r) => (r.active ? <Badge tone="green" dot>Active</Badge> : <Badge tone="slate" dot>Inactive</Badge>) },
  ],
  filters: [
    { name: 'skillType', label: 'Skill', options: C.SKILL_TYPES },
    { name: 'trade', label: 'Trade', options: C.TRADES },
    { name: 'currentProject', label: 'Site', ref: REF.project },
  ],
  fields: [
    { name: 'name', label: 'Name', required: true },
    { name: 'phone', label: 'Phone', type: 'tel' },
    { name: 'trade', label: 'Trade', type: 'select', options: C.TRADES, default: 'Helper' },
    { name: 'skillType', label: 'Skill type', type: 'select', options: C.SKILL_TYPES, default: 'Skilled' },
    { name: 'dailyWage', label: 'Daily wage', type: 'currency', required: true },
    { name: 'otRate', label: 'OT rate / hour', type: 'currency' },
    { name: 'currentProject', label: 'Current site', type: 'ref', ref: REF.project },
    { name: 'subcontractor', label: 'Through contractor', type: 'ref', ref: REF.subcontractor },
    { name: 'idProof', label: 'ID proof no.' },
    { name: 'active', label: 'Active', type: 'checkbox', default: true },
    { name: 'address', label: 'Address', type: 'textarea' },
  ],
};

export const subcontractors = {
  key: 'subcontractors', endpoint: '/subcontractors', module: 'subcontractors', icon: Briefcase,
  title: 'Subcontractors', singular: 'Subcontractor', description: 'Labour & specialist contractors.',
  columns: [
    code,
    { key: 'company', label: 'Contractor', render: nameCell((r) => r.company || r.name, (r) => r.name) },
    { key: 'trade', label: 'Trade' },
    { key: 'phone', label: 'Phone' },
    { key: 'gstin', label: 'GSTIN' },
    { key: 'pan', label: 'PAN' },
  ],
  fields: [
    { name: 'company', label: 'Company / firm' },
    { name: 'name', label: 'Contact name', required: true },
    { name: 'phone', label: 'Phone', type: 'tel', required: true },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'trade', label: 'Trade', placeholder: 'Carpentry, Electrical, Civil…' },
    { name: 'gstin', label: 'GSTIN' },
    { name: 'pan', label: 'PAN' },
    { name: 'rating', label: 'Rating (0-5)', type: 'number', default: 4 },
    { name: 'bankDetails', label: 'Bank details', type: 'textarea', rows: 2 },
    { name: 'address', label: 'Address', type: 'textarea', rows: 2 },
  ],
  rowActions: (r, ctx) => [
    { label: 'Work orders', icon: Briefcase, onClick: () => ctx.nav(`/workforce/work-orders?subcontractor=${r._id}`) },
    { label: 'Bills', icon: Receipt, onClick: () => ctx.nav(`/finance/bills?subcontractor=${r._id}`) },
  ],
};

export const workOrders = {
  key: 'work-orders', endpoint: '/work-orders', module: 'workOrders', icon: Briefcase,
  title: 'Work Orders', singular: 'Work Order', description: 'Work packages awarded to subcontractors with contract value and progress.', formWidth: 'max-w-4xl',
  columns: [
    code,
    { key: 'title', label: 'Work package', render: nameCell((r) => r.title, (r) => r.subcontractor?.name) },
    { ...projectCol },
    { key: 'contractAmount', label: 'Contract', type: 'currency' },
    { key: 'endDate', label: 'Due', type: 'date' },
    { key: 'progress', label: 'Progress', type: 'progress' },
    { key: 'status', label: 'Status', type: 'status' },
  ],
  filters: [{ name: 'subcontractor', label: 'Contractor', ref: REF.subcontractor }, { name: 'status', label: 'Status', options: C.WORK_ORDER_STATUS }],
  fields: [
    { name: 'title', label: 'Work package title', required: true, span: 2 },
    { name: 'subcontractor', label: 'Subcontractor', type: 'ref', ref: REF.subcontractor, required: true },
    projectField(),
    { name: 'startDate', label: 'Start', type: 'date' },
    { name: 'endDate', label: 'End', type: 'date' },
    { name: 'scope', label: 'Scope of work', type: 'textarea' },
    { name: 'items', label: 'Rate items (contract amount auto-calculated)', type: 'items', columns: itemsBase(), total: lineTotal },
    { name: 'contractAmount', label: 'Lump-sum contract amount', type: 'currency', help: 'Used only when no rate items are entered' },
    { name: 'progress', label: 'Progress', type: 'percent', default: 0 },
    { name: 'status', label: 'Status', type: 'select', options: C.WORK_ORDER_STATUS, default: 'Active' },
  ],
  rowActions: (r, ctx) => [
    { label: 'Record measurement', icon: Ruler, onClick: () => ctx.nav(`/measurements?create=1&workOrder=${r._id}&project=${r.project?._id}&measurementType=Contractor`) },
  ],
};

const mbQty = (r) => {
  const dims = [r.length, r.breadth, r.height].map(Number).filter((d) => d > 0);
  return dims.length ? (Number(r.nos) || 1) * dims.reduce((a, b) => a * b, 1) : Number(r.quantity) || 0;
};
export const measurements = {
  key: 'measurements', endpoint: '/measurements', module: 'measurements', icon: Ruler,
  title: 'Measurement Book', singular: 'Measurement', description: 'Record executed quantities → verify → bill the client or contractor (progress billing).', formWidth: 'max-w-6xl',
  columns: [
    code,
    { key: 'date', label: 'Date', type: 'date' },
    { ...projectCol },
    { key: 'measurementType', label: 'For', render: (r) => <Badge tone={r.measurementType === 'Client' ? 'blue' : 'amber'}>{r.measurementType === 'Client' ? 'Client billing' : `Contractor · ${r.subcontractor?.name || ''}`}</Badge> },
    { key: 'items', label: 'Items', render: (r) => `${r.items.length}` },
    { key: 'total', label: 'Amount', type: 'currency' },
    { key: 'bill', label: 'Bill', render: (r) => (r.bill ? <span className="font-mono text-xs">{r.bill.code}</span> : '—') },
    { key: 'status', label: 'Status', type: 'status' },
  ],
  filters: [{ name: 'project', label: 'Project', ref: REF.project }, { name: 'measurementType', label: 'For', options: ['Client', 'Contractor'] }, { name: 'status', label: 'Status', options: C.MEASUREMENT_STATUS }],
  canEditRow: (r) => r.status !== 'Billed',
  defaults: () => ({ date: new Date().toISOString() }),
  fields: [
    projectField(),
    { name: 'date', label: 'Date', type: 'date' },
    { name: 'measurementType', label: 'Measurement for', type: 'select', options: [{ value: 'Client', label: 'Client billing' }, { value: 'Contractor', label: 'Contractor billing' }], default: 'Client' },
    { name: 'workOrder', label: 'Work order', type: 'ref', ref: { ...REF.workOrder, params: (v) => ({ project: v.project }) }, showIf: (v) => v.measurementType === 'Contractor' },
    {
      name: 'items', label: 'Measurements', type: 'items', itemLabel: 'measurement',
      columns: [
        { name: 'description', label: 'Description', required: true, width: '22%' },
        { name: 'area', label: 'Location', width: 100 },
        { name: 'unit', label: 'Unit', type: 'select', options: C.UNITS, default: 'Sqft', width: 80 },
        { name: 'nos', label: 'Nos', type: 'number', default: 1, width: 65 },
        { name: 'length', label: 'L', type: 'number', width: 70 },
        { name: 'breadth', label: 'B', type: 'number', width: 70 },
        { name: 'height', label: 'H/D', type: 'number', width: 70 },
        { name: 'quantity', label: 'Qty*', type: 'number', width: 80 },
        { name: 'rate', label: 'Rate', type: 'number', width: 90 },
        { name: 'amount', label: 'Amount', computed: (r) => mbQty(r) * (Number(r.rate) || 0), width: 110 },
      ],
      total: (r) => mbQty(r) * (Number(r.rate) || 0),
    },
    { name: 'remarks', label: 'Remarks', type: 'textarea', help: '* Quantity is auto-calculated as Nos × L × B × H when dimensions are entered.' },
  ],
  rowActions: (r, ctx) => [
    r.status === 'Draft' && ctx.can('measurements', 'edit') && { label: 'Verify measurement', icon: BadgeCheck, onClick: () => go(ctx, `/measurements/${r._id}/verify`, null, 'Measurement verified') },
    r.status === 'Verified' && ctx.can('measurements', 'edit') && {
      label: r.measurementType === 'Client' ? 'Generate client invoice' : 'Generate contractor bill', icon: Receipt,
      onClick: () => ctx.action.mutate({ url: `/measurements/${r._id}/bill`, success: 'Bill generated' }, { onSuccess: (b) => ctx.nav(`/finance/bills/${b._id}`) }),
    },
    r.bill && { label: 'View bill', icon: Eye, onClick: () => ctx.nav(`/finance/bills/${r.bill._id}`) },
  ],
};

/* =====================================================================
 * FINANCE
 * ===================================================================== */
export const bills = {
  key: 'bills', endpoint: '/bills', module: 'bills', icon: Receipt,
  title: 'Bills & Invoices', singular: 'Bill', description: 'Client invoices, vendor purchase invoices and contractor bills in one ledger.', formWidth: 'max-w-4xl',
  columns: [
    code,
    { key: 'billDate', label: 'Date', type: 'date' },
    { key: 'billType', label: 'Type', type: 'status' },
    { key: 'party', label: 'Party', render: nameCell((r) => r.client?.name || r.vendor?.name || r.subcontractor?.name || '—', (r) => r.partyInvoiceNo && `Ref ${r.partyInvoiceNo}`), exportValue: (r) => r.client?.name || r.vendor?.name || r.subcontractor?.name },
    { ...projectCol, render: (r) => r.project?.name || '—' },
    { key: 'total', label: 'Total', type: 'currency' },
    { key: 'balance', label: 'Balance', render: (r) => <span className={r.balance > 0 ? 'font-medium text-slate-900 tabular-nums dark:text-white' : 'text-slate-400 tabular-nums'}>{money(r.balance)}</span>, align: 'right' },
    { key: 'dueDate', label: 'Due', render: (r) => <span className={r.balance > 0 && r.dueDate && new Date(r.dueDate) < new Date() ? 'font-medium text-red-600' : ''}>{fmtDate(r.dueDate)}</span> },
    { key: 'status', label: 'Status', type: 'status' },
  ],
  filters: [
    { name: 'billType', label: 'Type', options: C.BILL_TYPES },
    { name: 'status', label: 'Status', options: C.BILL_STATUS },
    { name: 'project', label: 'Project', ref: REF.project },
  ],
  onRowClick: (r, ctx) => ctx.nav(`/finance/bills/${r._id}`),
  canEditRow: (r) => r.paidAmount === 0,
  defaults: () => ({ billDate: new Date().toISOString(), billType: 'Client' }),
  fields: [
    { name: 'billType', label: 'Bill type', type: 'select', options: [{ value: 'Client', label: 'Client invoice (sales)' }, { value: 'Vendor', label: 'Vendor purchase invoice' }, { value: 'Contractor', label: 'Contractor bill' }], required: true },
    projectField({ required: false }),
    { name: 'client', label: 'Client', type: 'ref', ref: REF.client, showIf: (v) => v.billType === 'Client', help: 'Auto-filled from project if blank' },
    { name: 'vendor', label: 'Vendor', type: 'ref', ref: REF.vendor, showIf: (v) => v.billType === 'Vendor', required: true },
    { name: 'subcontractor', label: 'Subcontractor', type: 'ref', ref: REF.subcontractor, showIf: (v) => v.billType === 'Contractor', required: true },
    { name: 'partyInvoiceNo', label: "Party's invoice no.", showIf: (v) => v.billType !== 'Client' },
    { name: 'billDate', label: 'Bill date', type: 'date' },
    { name: 'dueDate', label: 'Due date', type: 'date' },
    { name: 'items', label: 'Bill items', type: 'items', columns: itemsBase(), total: lineTotal },
    { name: 'gstPercent', label: 'GST', type: 'percent', default: 18 },
    { name: 'retentionPercent', label: 'Retention', type: 'percent', default: 0 },
    { name: 'status', label: 'Status', type: 'select', options: ['Draft', 'Issued', 'Cancelled'], default: 'Issued' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
  summary: (v) => gstSummary(v, { retention: true }),
  afterCreate: (b, ctx) => ctx.nav(`/finance/bills/${b._id}`),
};

export const payments = {
  key: 'payments', endpoint: '/payments', module: 'payments', icon: Wallet,
  title: 'Payments', singular: 'Payment', description: 'Client receipts, advances and payouts to vendors, contractors and labour.',
  columns: [
    code,
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'category', label: 'Category', render: (r) => <Badge tone={r.direction === 'In' ? 'green' : 'red'} dot>{r.category}</Badge> },
    { key: 'party', label: 'Party', render: (r) => r.client?.name || r.vendor?.name || r.subcontractor?.name || r.worker?.name || r.employee?.name || '—', exportValue: (r) => r.client?.name || r.vendor?.name || r.subcontractor?.name || r.worker?.name || r.employee?.name },
    { key: 'bill.code', label: 'Against' },
    { ...projectCol, render: (r) => r.project?.name || '—' },
    { key: 'mode', label: 'Mode' },
    { key: 'amount', label: 'Amount', render: (r) => <span className={`font-semibold tabular-nums ${r.direction === 'In' ? 'text-emerald-600' : 'text-red-600'}`}>{r.direction === 'In' ? '+' : '−'} {money(r.amount)}</span>, align: 'right' },
  ],
  filters: [
    { name: 'direction', label: 'Direction', options: [{ value: 'In', label: 'Money in' }, { value: 'Out', label: 'Money out' }] },
    { name: 'category', label: 'Category', options: C.PAYMENT_CATEGORIES },
    { name: 'mode', label: 'Mode', options: C.PAYMENT_MODES },
  ],
  defaults: () => ({ date: new Date().toISOString(), category: 'Client Receipt' }),
  fields: [
    { name: 'category', label: 'Category', type: 'select', options: C.PAYMENT_CATEGORIES, required: true },
    { name: 'date', label: 'Date', type: 'date' },
    {
      name: 'bill', label: 'Against bill', type: 'ref', span: 2,
      ref: {
        endpoint: '/bills', label: (o) => `${o.code} · ${o.client?.name || o.vendor?.name || o.subcontractor?.name || ''} · balance ${money(o.balance)}`,
        params: (v) => ({ outstanding: 'true', billType: v.category?.startsWith('Client') ? 'Client' : v.category === 'Vendor Payment' ? 'Vendor' : v.category === 'Contractor Payment' ? 'Contractor' : undefined }),
      },
      showIf: (v) => ['Client Receipt', 'Client Advance', 'Vendor Payment', 'Contractor Payment'].includes(v.category),
      onSelect: (b, v) => (b ? { amount: v.amount || b.balance, project: b.project?._id || v.project } : {}),
    },
    projectField({ required: false }),
    { name: 'client', label: 'Client', type: 'ref', ref: REF.client, showIf: (v) => ['Client Advance', 'Other Income'].includes(v.category) && !v.bill },
    { name: 'worker', label: 'Worker', type: 'ref', ref: REF.worker, showIf: (v) => v.category === 'Labour Wages' },
    { name: 'employee', label: 'Employee', type: 'ref', ref: REF.employee, showIf: (v) => ['Salary', 'Salary Advance'].includes(v.category), help: 'Salaries are normally paid from Payroll, advances from Salary Advances' },
    { name: 'amount', label: 'Amount', type: 'currency', required: true },
    { name: 'mode', label: 'Mode', type: 'select', options: C.PAYMENT_MODES, default: 'Bank Transfer' },
    { name: 'reference', label: 'Reference / UTR / Cheque no.' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
};

export const expenses = {
  key: 'expenses', endpoint: '/expenses', module: 'expenses', icon: Banknote,
  title: 'Expenses', singular: 'Expense', description: 'Transport, equipment rent and other direct site expenses.',
  columns: [
    code,
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'category', label: 'Category', render: (r) => <Badge tone="slate">{r.category}</Badge> },
    { key: 'description', label: 'Description' },
    { ...projectCol, render: (r) => r.project?.name || '—' },
    { key: 'paidTo', label: 'Paid to' },
    { key: 'mode', label: 'Mode' },
    { key: 'amount', label: 'Amount', type: 'currency' },
  ],
  filters: [{ name: 'project', label: 'Project', ref: REF.project }, { name: 'category', label: 'Category', options: C.EXPENSE_CATEGORIES }],
  defaults: () => ({ date: new Date().toISOString() }),
  fields: [
    projectField({ required: false }),
    { name: 'category', label: 'Category', type: 'select', options: C.EXPENSE_CATEGORIES, default: 'Site Expense' },
    { name: 'description', label: 'Description', required: true, span: 2 },
    { name: 'amount', label: 'Amount', type: 'currency', required: true },
    { name: 'date', label: 'Date', type: 'date' },
    { name: 'paidTo', label: 'Paid to' },
    { name: 'mode', label: 'Mode', type: 'select', options: C.PAYMENT_MODES, default: 'Cash' },
    { name: 'receipt', label: 'Receipt', type: 'file', span: 2 },
  ],
};

/* =====================================================================
 * HR & PAYROLL
 * ===================================================================== */
const SAL = 'Salary (monthly)';
export const employees = {
  key: 'employees', endpoint: '/employees', module: 'employees', icon: IdCard,
  title: 'Employees', singular: 'Employee', description: 'Staff master — job, reporting line, salary structure and statutory details.', formWidth: 'max-w-3xl', pageSize: 50,
  columns: [
    code,
    { key: 'name', label: 'Employee', render: nameCell((r) => r.name, (r) => r.phone) },
    { key: 'designation', label: 'Designation', render: nameCell((r) => r.designation || '—', (r) => r.department) },
    { key: 'reportingTo.name', label: 'Reports to' },
    { key: 'joiningDate', label: 'Joined', type: 'date' },
    { key: 'gross', label: 'Gross / month', type: 'currency' },
    { key: 'user', label: 'Login', render: (r) => (r.user ? <Badge tone="blue">{r.user.role}</Badge> : <span className="text-slate-400">—</span>), exportValue: (r) => r.user?.email },
    { key: 'status', label: 'Status', type: 'status' },
  ],
  filters: [{ name: 'department', label: 'Department', options: C.DEPARTMENTS }, { name: 'status', label: 'Status', options: C.EMPLOYEE_STATUS }],
  fields: [
    { name: 'name', label: 'Full name', required: true, section: 'Personal' },
    { name: 'phone', label: 'Phone', type: 'tel', required: true, section: 'Personal' },
    { name: 'email', label: 'Email', type: 'email', section: 'Personal' },
    { name: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'], section: 'Personal' },
    { name: 'dob', label: 'Date of birth', type: 'date', section: 'Personal' },
    { name: 'emergencyContact', label: 'Emergency contact', section: 'Personal' },
    { name: 'address', label: 'Address', type: 'textarea', rows: 2, section: 'Personal' },
    { name: 'department', label: 'Department', type: 'select', options: C.DEPARTMENTS, default: 'Projects', section: 'Job' },
    { name: 'designation', label: 'Designation', section: 'Job' },
    { name: 'joiningDate', label: 'Date of joining', type: 'date', section: 'Job' },
    { name: 'reportingTo', label: 'Reports to', type: 'ref', ref: REF.employee, help: 'Approves this employee’s leave', section: 'Job' },
    { name: 'user', label: 'Linked login', type: 'ref', ref: REF.staff, help: 'Lets the employee apply for leave and see payslips', section: 'Job' },
    { name: 'status', label: 'Status', type: 'select', options: C.EMPLOYEE_STATUS, default: 'Active', section: 'Job' },
    { name: 'exitDate', label: 'Last working day', type: 'date', showIf: (v) => v.status !== 'Active', section: 'Job' },
    { name: 'basic', label: 'Basic', type: 'currency', required: true, section: SAL },
    { name: 'hra', label: 'HRA', type: 'currency', default: 0, section: SAL },
    { name: 'allowances', label: 'Other allowances', type: 'currency', default: 0, section: SAL },
    { name: 'professionalTax', label: 'Professional tax / month', type: 'currency', default: 200, section: SAL },
    { name: 'pfApplicable', label: 'PF', type: 'checkbox', checkboxLabel: '12% of basic (capped at ₹15,000)', default: true, section: SAL },
    { name: 'esiApplicable', label: 'ESI', type: 'checkbox', checkboxLabel: '0.75% (gross up to ₹21,000)', default: false, section: SAL },
    { name: 'pan', label: 'PAN', section: 'Statutory & bank' },
    { name: 'aadhaar', label: 'Aadhaar', section: 'Statutory & bank' },
    { name: 'uan', label: 'UAN (PF)', section: 'Statutory & bank' },
    { name: 'esiNo', label: 'ESI no.', section: 'Statutory & bank' },
    { name: 'bankName', label: 'Bank', section: 'Statutory & bank' },
    { name: 'bankAccount', label: 'Account no.', section: 'Statutory & bank' },
    { name: 'ifsc', label: 'IFSC', section: 'Statutory & bank' },
  ],
  summary: (v) => {
    const gross = (Number(v.basic) || 0) + (Number(v.hra) || 0) + (Number(v.allowances) || 0);
    return [{ label: 'Gross / month', value: money(gross) }, { label: 'Gross / year', value: money(gross * 12), strong: true }];
  },
  rowActions: (r, ctx) => [
    ctx.can('leaves', 'edit') && { label: 'Apply leave', icon: CalendarOff, onClick: () => ctx.nav(`/hr/leaves?create=1&employee=${r._id}`) },
    { label: 'Leave history', icon: Eye, onClick: () => ctx.nav(`/hr/leaves?employee=${r._id}`) },
    ctx.can('advances', 'edit') && { label: 'Give salary advance', icon: HandCoins, onClick: () => ctx.nav(`/hr/advances?create=1&employee=${r._id}`) },
  ],
};

export const leaves = {
  key: 'leaves', endpoint: '/leaves', module: 'leaves', icon: CalendarOff,
  title: 'Leave', singular: 'Leave', createLabel: 'Apply leave',
  description: 'Apply → reporting manager / HR approves → marked on attendance → counted in payroll.',
  columns: [
    code,
    { key: 'employee', label: 'Employee', render: nameCell((r) => r.employee?.name, (r) => r.employee?.designation), exportValue: (r) => r.employee?.name, hideWhenFixed: true },
    { key: 'leaveType', label: 'Type' },
    { key: 'from', label: 'Dates', render: (r) => (r.days > 1 ? `${fmtDate(r.from, 'dd MMM')} – ${fmtDate(r.to)}` : `${fmtDate(r.from)}${r.halfDay ? ' (half)' : ''}`) },
    { key: 'days', label: 'Days', type: 'number' },
    { key: 'reason', label: 'Reason', render: (r) => <span className="line-clamp-1 max-w-xs whitespace-normal">{r.reason}</span> },
    { key: 'approvedBy.name', label: 'Approved by' },
    { key: 'status', label: 'Status', type: 'status' },
  ],
  filters: [
    { name: 'status', label: 'Status', options: C.LEAVE_STATUS },
    { name: 'leaveType', label: 'Type', options: C.LEAVE_TYPES },
    { name: 'employee', label: 'Employee', ref: REF.employee },
  ],
  canEditRow: (r) => r.status === 'Pending',
  fields: [
    { name: 'employee', label: 'Employee', type: 'ref', ref: REF.employee, span: 2, help: 'Leave blank to apply for yourself', hrOnly: true },
    { name: 'leaveType', label: 'Leave type', type: 'select', options: C.LEAVE_TYPES, default: 'Casual Leave', required: true },
    { name: 'halfDay', label: 'Duration', type: 'checkbox', checkboxLabel: 'Half day', default: false },
    { name: 'from', label: 'From', type: 'date', required: true },
    { name: 'to', label: 'To', type: 'date', showIf: (v) => !v.halfDay, help: 'Leave blank for a single day' },
    { name: 'reason', label: 'Reason', type: 'textarea' },
  ],
  transform: (p) => ({ ...p, to: p.halfDay || !p.to ? p.from : p.to }),
  // ctx.isHR / ctx.myEmployee come from the Leave page
  rowActions: (r, ctx) => {
    const mine = r.employee?._id === ctx.myEmployee;
    return [
      r.status === 'Pending' && (ctx.isHR || !mine) && { label: 'Approve', icon: CheckCircle2, onClick: () => go(ctx, `/leaves/${r._id}/approve`, null, 'Leave approved · marked on attendance') },
      r.status === 'Pending' && (ctx.isHR || !mine) && { label: 'Reject', icon: XCircle, onClick: () => go(ctx, `/leaves/${r._id}/reject`, null, 'Leave rejected') },
      ['Pending', 'Approved'].includes(r.status) && (ctx.isHR || mine) && { label: 'Cancel leave', icon: Ban, onClick: () => go(ctx, `/leaves/${r._id}/cancel`, null, 'Leave cancelled') },
    ];
  },
};

export const advances = {
  key: 'advances', endpoint: '/advances', module: 'advances', icon: HandCoins,
  title: 'Salary Advances', singular: 'Advance', createLabel: 'Give advance',
  description: 'Paid out now (recorded in Payments), recovered from payroll in monthly instalments.',
  columns: [
    code,
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'employee', label: 'Employee', render: nameCell((r) => r.employee?.name, (r) => r.employee?.designation), exportValue: (r) => r.employee?.name },
    { key: 'amount', label: 'Amount', type: 'currency' },
    { key: 'installment', label: 'Instalment', type: 'currency' },
    { key: 'recovered', label: 'Recovered', type: 'currency' },
    { key: 'balance', label: 'Balance', type: 'currency' },
    { key: 'payment.code', label: 'Payment' },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'Open' ? 'amber' : 'green'} dot>{r.status === 'Open' ? 'Recovering' : 'Recovered'}</Badge> },
  ],
  filters: [{ name: 'status', label: 'Status', options: [{ value: 'Open', label: 'Recovering' }, { value: 'Closed', label: 'Recovered' }] }, { name: 'employee', label: 'Employee', ref: REF.employee }],
  defaults: () => ({ date: new Date().toISOString() }),
  canEditRow: (r) => r.recovered === 0,
  fields: [
    { name: 'employee', label: 'Employee', type: 'ref', ref: REF.employee, required: true, span: 2 },
    { name: 'amount', label: 'Amount', type: 'currency', required: true },
    { name: 'installment', label: 'Monthly recovery', type: 'currency', required: true },
    { name: 'date', label: 'Date', type: 'date' },
    { name: 'mode', label: 'Paid by', type: 'select', options: C.PAYMENT_MODES, default: 'Bank Transfer' },
    { name: 'reason', label: 'Reason', type: 'textarea' },
  ],
  summary: (v) => (Number(v.amount) > 0 && Number(v.installment) > 0 ? [{ label: 'Recovered over', value: `${Math.ceil(v.amount / v.installment)} month(s)`, strong: true }] : []),
};

export const monthLabel = (m) => fmtDate(m ? `${m}-01T00:00:00` : null, 'MMMM yyyy');
export const payroll = {
  key: 'payroll', endpoint: '/payroll', module: 'payroll', icon: FileSpreadsheet,
  title: 'Payroll', singular: 'Payroll', createLabel: 'Run payroll',
  description: 'Salary from attendance + approved leave → approve → pay (salary payments, advance recovery).',
  formDescription: 'Includes every employee on the rolls that month with their attendance, leave and advance recoveries.',
  columns: [
    code,
    { key: 'month', label: 'Month', render: (r) => <span className="font-medium">{monthLabel(r.month)}</span>, exportValue: (r) => r.month },
    { key: 'lines', label: 'Employees', render: (r) => r.lines?.length ?? 0, exportValue: (r) => r.lines?.length },
    { key: 'gross', label: 'Gross', type: 'currency' },
    { key: 'deductions', label: 'Deductions', type: 'currency' },
    { key: 'net', label: 'Net pay', type: 'currency' },
    { key: 'paidAt', label: 'Paid on', type: 'date' },
    { key: 'status', label: 'Status', type: 'status' },
  ],
  filters: [{ name: 'status', label: 'Status', options: C.PAYROLL_STATUS }],
  onRowClick: (r, ctx) => ctx.nav(`/hr/payroll/${r._id}`),
  canEditRow: (r) => r.status === 'Draft',
  defaults: () => ({ month: fmtDate(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), 'yyyy-MM') }),
  fields: [
    { name: 'month', label: 'Month', type: 'month', required: true },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
  afterCreate: (p, ctx) => ctx.nav(`/hr/payroll/${p._id}`),
};

/* =====================================================================
 * ADMIN
 * ===================================================================== */
export const users = {
  key: 'users', endpoint: '/users', module: 'users', icon: Users,
  title: 'Users & Roles', singular: 'User', description: 'Staff accounts and portal access for clients, contractors and workers.',
  columns: [
    { key: 'name', label: 'User', render: nameCell((r) => r.name, (r) => r.email) },
    { key: 'role', label: 'Role', render: (r) => <Badge tone={['Client', 'Contractor', 'Worker'].includes(r.role) ? 'violet' : r.role.includes('Admin') ? 'brand' : 'blue'}>{r.role}</Badge> },
    { key: 'designation', label: 'Designation' },
    { key: 'phone', label: 'Phone' },
    { key: 'lastLogin', label: 'Last login', type: 'date' },
    { key: 'active', label: 'Status', render: (r) => (r.active ? <Badge tone="green" dot>Active</Badge> : <Badge tone="slate" dot>Disabled</Badge>) },
  ],
  filters: [{ name: 'role', label: 'Role', options: C.ROLES }],
  fields: [
    { name: 'name', label: 'Full name', required: true },
    { name: 'email', label: 'Email (login)', type: 'email', required: true },
    { name: 'role', label: 'Role', type: 'select', options: C.ROLES, required: true, default: 'Site Engineer' },
    { name: 'designation', label: 'Designation' },
    { name: 'phone', label: 'Phone', type: 'tel' },
    { name: 'password', label: 'Password', type: 'password', help: 'Leave blank to keep current password (min 6 chars)' },
    { name: 'client', label: 'Linked client (portal)', type: 'ref', ref: REF.client, showIf: (v) => v.role === 'Client' },
    { name: 'subcontractor', label: 'Linked subcontractor', type: 'ref', ref: REF.subcontractor, showIf: (v) => v.role === 'Contractor' },
    { name: 'worker', label: 'Linked worker', type: 'ref', ref: REF.worker, showIf: (v) => v.role === 'Worker' },
    { name: 'active', label: 'Account active', type: 'checkbox', default: true },
  ],
};

export const ICONS = { Building2, Truck, PackageCheck, CreditCard, Copy, Ban, ArrowRightCircle };
