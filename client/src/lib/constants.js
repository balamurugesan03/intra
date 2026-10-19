export const PROJECT_TYPES = ['Construction', 'Interior', 'Renovation'];
export const LEAD_SOURCES = ['Walk-in', 'Referral', 'Website', 'Social Media', 'Advertisement', 'Other'];
export const LEAD_STATUS = ['New', 'Contacted', 'Site Visit', 'Estimation', 'Quoted', 'Won', 'Lost'];
export const SITE_VISIT_STATUS = ['Scheduled', 'Completed', 'Cancelled'];
export const BOQ_STATUS = ['Draft', 'Final'];
export const QUOTATION_STATUS = ['Draft', 'Sent', 'Approved', 'Rejected', 'Revised', 'Converted'];
export const PROJECT_STATUS = ['Planning', 'Ongoing', 'On Hold', 'Completed', 'Cancelled'];
export const TASK_STATUS = ['To Do', 'In Progress', 'On Hold', 'Done'];
export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
export const MATERIAL_CATEGORIES = [
  'Cement', 'Steel', 'Sand & Aggregates', 'Bricks & Blocks', 'Tiles', 'Paint', 'Plywood', 'MDF',
  'Laminates', 'Hardware', 'Electrical', 'Plumbing', 'Furniture Materials', 'Lighting', 'Glass', 'Other',
];
export const UNITS = ['Nos', 'Bag', 'Kg', 'Ton', 'Sqft', 'Sqm', 'Rft', 'Cft', 'Cum', 'Ltr', 'Sheet', 'Box', 'Set', 'Load', 'LS'];
export const STOCK_TXN_TYPES = ['Receipt', 'Consumption', 'Transfer', 'Wastage', 'Return'];
export const MR_STATUS = ['Pending', 'Approved', 'Rejected', 'Ordered'];
export const RFQ_STATUS = ['Draft', 'Sent', 'Closed'];
export const PO_STATUS = ['Draft', 'Approved', 'Partially Received', 'Received', 'Cancelled'];
export const SKILL_TYPES = ['Skilled', 'Semi-Skilled', 'Unskilled'];
export const TRADES = ['Mason', 'Carpenter', 'Electrician', 'Plumber', 'Painter', 'Tile Layer', 'Bar Bender', 'Welder', 'Fabricator', 'Helper', 'Supervisor', 'Other'];
export const ATTENDANCE_STATUS = ['Present', 'Half Day', 'Absent'];
export const WORK_ORDER_STATUS = ['Draft', 'Active', 'Completed', 'Terminated'];
export const MEASUREMENT_STATUS = ['Draft', 'Verified', 'Billed'];
export const BILL_TYPES = ['Client', 'Vendor', 'Contractor'];
export const BILL_STATUS = ['Draft', 'Issued', 'Partially Paid', 'Paid', 'Cancelled'];
export const PAYMENT_CATEGORIES = ['Client Receipt', 'Client Advance', 'Vendor Payment', 'Contractor Payment', 'Labour Wages', 'Salary', 'Salary Advance', 'Other Income', 'Other Payment'];
export const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card'];
export const EXPENSE_CATEGORIES = ['Transport', 'Equipment Rent', 'Site Expense', 'Food & Accommodation', 'Utilities', 'Permits & Fees', 'Miscellaneous'];
export const ROOM_TYPES = ['Living Room', 'Master Bedroom', 'Bedroom', 'Kids Bedroom', 'Kitchen', 'Dining', 'Bathroom', 'Pooja Room', 'Office', 'Balcony', 'Foyer', 'Other'];
export const DESIGN_STATUS = ['Concept', 'In Design', 'Pending Approval', 'Approved', 'Changes Requested'];
export const DOCUMENT_CATEGORIES = ['Site Photo', 'Before', 'After', 'Drawing', 'Floor Plan', '3D Design', 'Agreement', 'Invoice', 'Receipt', 'Approval', 'Other'];
export const ACTIVITY_TYPES = ['Call', 'Meeting', 'WhatsApp', 'Email', 'Site Visit', 'Note'];
export const TICKET_CATEGORIES = ['Complaint', 'Snag / Rework', 'Warranty', 'Service Request', 'Feedback'];
export const TICKET_STATUS = ['Open', 'In Progress', 'Resolved', 'Closed'];
export const DEPARTMENTS = ['Management', 'Projects', 'Site Execution', 'Design', 'Estimation', 'Sales', 'Purchase', 'Stores', 'Accounts', 'HR & Admin'];
export const EMPLOYEE_STATUS = ['Active', 'On Notice', 'Exited'];
export const STAFF_ATTENDANCE_STATUS = ['Present', 'Half Day', 'Absent', 'Leave', 'Holiday', 'Week Off'];
export const LEAVE_TYPES = ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Comp Off', 'Loss of Pay'];
export const LEAVE_STATUS = ['Pending', 'Approved', 'Rejected', 'Cancelled'];
export const PAYROLL_STATUS = ['Draft', 'Approved', 'Paid'];
export const ROLES = [
  'Super Admin', 'Admin', 'Project Manager', 'Site Engineer', 'Site Supervisor', 'Estimator', 'Purchase Manager',
  'Accountant', 'Designer', 'Store Manager', 'HR Manager', 'Contractor', 'Worker', 'Client',
];

/** Tone for every status value used across modules */
export const STATUS_TONE = {
  // generic
  New: 'blue', Draft: 'slate', Pending: 'amber', Approved: 'green', Rejected: 'red', Cancelled: 'slate', Closed: 'slate',
  // leads
  Contacted: 'indigo', 'Site Visit': 'violet', Estimation: 'cyan', Quoted: 'amber', Won: 'green', Lost: 'red',
  Scheduled: 'blue', Completed: 'green', Final: 'green',
  // quotations
  Sent: 'blue', Revised: 'slate', Converted: 'violet',
  // projects
  Planning: 'indigo', Ongoing: 'blue', 'On Hold': 'amber',
  // tasks
  'To Do': 'slate', 'In Progress': 'blue', Done: 'green',
  Low: 'slate', Medium: 'blue', High: 'amber', Critical: 'red',
  // procurement
  Ordered: 'violet', 'Partially Received': 'amber', Received: 'green',
  Receipt: 'green', Consumption: 'blue', Transfer: 'violet', Wastage: 'red', Return: 'cyan',
  // workforce
  Present: 'green', 'Half Day': 'amber', Absent: 'red', Active: 'blue', Terminated: 'red',
  Verified: 'cyan', Billed: 'violet', Skilled: 'green', 'Semi-Skilled': 'blue', Unskilled: 'slate',
  // finance
  Issued: 'blue', 'Partially Paid': 'amber', Paid: 'green', In: 'green', Out: 'red',
  Client: 'blue', Vendor: 'violet', Contractor: 'amber',
  // interior
  Concept: 'slate', 'In Design': 'indigo', 'Pending Approval': 'amber', 'Changes Requested': 'red',
  Submitted: 'blue', Reviewed: 'green',
  // crm
  Open: 'amber', Resolved: 'green', Call: 'blue', Meeting: 'violet', WhatsApp: 'green', Email: 'cyan', Note: 'slate',
  Complaint: 'red', 'Snag / Rework': 'amber', Warranty: 'violet', 'Service Request': 'blue', Feedback: 'cyan',
  // hr
  Leave: 'violet', Holiday: 'cyan', 'Week Off': 'slate', 'On Notice': 'amber', Exited: 'slate',
  Construction: 'amber', Interior: 'violet', Renovation: 'cyan',
};
