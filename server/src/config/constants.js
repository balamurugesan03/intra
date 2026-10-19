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
export const TRADES = [
  'Mason', 'Carpenter', 'Electrician', 'Plumber', 'Painter', 'Tile Layer', 'Bar Bender', 'Welder',
  'Fabricator', 'Helper', 'Supervisor', 'Other',
];
export const ATTENDANCE_STATUS = ['Present', 'Half Day', 'Absent'];
export const WORK_ORDER_STATUS = ['Draft', 'Active', 'Completed', 'Terminated'];
export const MEASUREMENT_STATUS = ['Draft', 'Verified', 'Billed'];
export const BILL_TYPES = ['Client', 'Vendor', 'Contractor'];
export const BILL_STATUS = ['Draft', 'Issued', 'Partially Paid', 'Paid', 'Cancelled'];
export const PAYMENT_CATEGORIES = [
  'Client Receipt', 'Client Advance', 'Vendor Payment', 'Contractor Payment', 'Labour Wages', 'Salary', 'Salary Advance',
  'Other Income', 'Other Payment',
];
export const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card'];
export const EXPENSE_CATEGORIES = [
  'Transport', 'Equipment Rent', 'Site Expense', 'Food & Accommodation', 'Utilities', 'Permits & Fees', 'Miscellaneous',
];
export const ROOM_TYPES = [
  'Living Room', 'Master Bedroom', 'Bedroom', 'Kids Bedroom', 'Kitchen', 'Dining', 'Bathroom', 'Pooja Room',
  'Office', 'Balcony', 'Foyer', 'Other',
];
export const DESIGN_STATUS = ['Concept', 'In Design', 'Pending Approval', 'Approved', 'Changes Requested'];
export const DOCUMENT_CATEGORIES = [
  'Site Photo', 'Before', 'After', 'Drawing', 'Floor Plan', '3D Design', 'Agreement', 'Invoice', 'Receipt', 'Approval', 'Other',
];

export const INCOME_CATEGORIES = ['Client Receipt', 'Client Advance', 'Other Income'];

/* ---------------- CRM ---------------- */
export const ACTIVITY_TYPES = ['Call', 'Meeting', 'WhatsApp', 'Email', 'Site Visit', 'Note'];
export const TICKET_CATEGORIES = ['Complaint', 'Snag / Rework', 'Warranty', 'Service Request', 'Feedback'];
export const TICKET_STATUS = ['Open', 'In Progress', 'Resolved', 'Closed'];

/* ---------------- HRMS ---------------- */
export const DEPARTMENTS = [
  'Management', 'Projects', 'Site Execution', 'Design', 'Estimation', 'Sales', 'Purchase', 'Stores', 'Accounts', 'HR & Admin',
];
export const EMPLOYEE_STATUS = ['Active', 'On Notice', 'Exited'];
export const STAFF_ATTENDANCE_STATUS = ['Present', 'Half Day', 'Absent', 'Leave', 'Holiday', 'Week Off'];
export const LEAVE_TYPES = ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Comp Off', 'Loss of Pay'];
// Yearly quota per leave type. Types not listed here (Comp Off, Loss of Pay) have no limit.
export const LEAVE_QUOTA = { 'Casual Leave': 12, 'Sick Leave': 6, 'Earned Leave': 15 };
export const LEAVE_STATUS = ['Pending', 'Approved', 'Rejected', 'Cancelled'];
export const PAYROLL_STATUS = ['Draft', 'Approved', 'Paid'];
