export const ROLES = [
  'Super Admin',
  'Admin',
  'Project Manager',
  'Site Engineer',
  'Site Supervisor',
  'Estimator',
  'Purchase Manager',
  'Accountant',
  'Designer',
  'Store Manager',
  'HR Manager',
  'Contractor',
  'Worker',
  'Client',
];

export const EXTERNAL_ROLES = ['Client', 'Contractor', 'Worker'];

const PM = 'Project Manager';
const SE = 'Site Engineer';
const SS = 'Site Supervisor';
const EST = 'Estimator';
const PUR = 'Purchase Manager';
const ACC = 'Accountant';
const DES = 'Designer';
const STO = 'Store Manager';
const HR = 'HR Manager';
const CON = 'Contractor';
const WRK = 'Worker';
const CLI = 'Client';
const STAFF = [PM, SE, SS, EST, PUR, ACC, DES, STO, HR];

// Super Admin & Admin have full access to every module.
export const PERMISSIONS = {
  dashboard: { view: [...STAFF, CON, WRK, CLI], edit: [] },
  pipeline: { view: [PM, EST, ACC, DES], edit: [] },
  users: { view: [], edit: [] },
  leads: { view: [PM, EST, DES], edit: [PM, EST] },
  activities: { view: [PM, EST, DES, ACC], edit: [PM, EST, DES] },
  clients: { view: [PM, EST, ACC, DES, SE], edit: [PM, EST, ACC] },
  siteVisits: { view: [PM, EST, SE, DES], edit: [PM, EST, SE, DES] },
  boq: { view: [PM, EST, ACC], edit: [PM, EST] },
  quotations: { view: [PM, EST, ACC, CLI], edit: [PM, EST] },
  projects: { view: [...STAFF, CON, CLI], edit: [PM] },
  tasks: { view: [PM, SE, SS, DES, CON, WRK], edit: [PM, SE, SS] },
  dailyReports: { view: [PM, SE, SS, ACC, CLI], edit: [PM, SE, SS] },
  tickets: { view: [PM, SE, SS, DES, CLI], edit: [PM, SE, SS, CLI] },
  rooms: { view: [PM, DES, SE, EST, CLI], edit: [PM, DES] },
  documents: { view: [...STAFF, CLI, CON], edit: [...STAFF] },
  materials: { view: [PM, SE, SS, EST, PUR, STO, ACC], edit: [PUR, STO] },
  materialRequests: { view: [PM, SE, SS, PUR, STO], edit: [PM, SE, SS, PUR, STO] },
  stock: { view: [PM, SE, SS, PUR, STO, ACC], edit: [SE, SS, PUR, STO] },
  vendors: { view: [PUR, ACC, PM, STO], edit: [PUR] },
  rfqs: { view: [PUR, PM, ACC], edit: [PUR] },
  purchaseOrders: { view: [PUR, ACC, PM, STO, SE], edit: [PUR, STO] },
  workers: { view: [PM, SE, SS, ACC], edit: [PM, SE, SS] },
  attendance: { view: [PM, SE, SS, ACC], edit: [PM, SE, SS] },
  subcontractors: { view: [PM, SE, ACC, PUR], edit: [PM] },
  workOrders: { view: [PM, SE, ACC, CON], edit: [PM] },
  measurements: { view: [PM, SE, EST, ACC, CON, CLI], edit: [PM, SE] },
  bills: { view: [ACC, PM, PUR, CLI, CON], edit: [ACC] },
  payments: { view: [ACC, PM], edit: [ACC] },
  expenses: { view: [ACC, PM, SE], edit: [ACC, PM, SE] },
  reports: { view: [PM, ACC, PUR, STO, EST], edit: [] },
  employees: { view: [HR, ACC], edit: [HR] },
  staffAttendance: { view: [HR, ACC], edit: [HR] },
  // Every staff member applies for their own leave; the route scope limits what each one sees.
  leaves: { view: [...STAFF], edit: [...STAFF] },
  payroll: { view: [HR, ACC], edit: [HR, ACC] },
  advances: { view: [HR, ACC], edit: [HR, ACC] },
};

export const isAdmin = (role) => role === 'Super Admin' || role === 'Admin';

/** HR managers (and admins) see every employee's leave and payroll records. */
export const isHR = (role) => isAdmin(role) || role === HR;

export const hasPermission = (role, module, action = 'view') =>
  isAdmin(role) || (PERMISSIONS[module]?.[action] || []).includes(role);
