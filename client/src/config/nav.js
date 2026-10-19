import {
  LayoutDashboard, Workflow, Target, Contact, MapPin, Calculator, FileText, FolderKanban, ListChecks, ClipboardList,
  Sofa, Images, Package, Boxes, ClipboardPlus, Store, Send, ShoppingCart, HardHat, CalendarCheck, Briefcase, Ruler,
  Receipt, Wallet, Banknote, BarChart3, Bell, Users, Settings, MessageSquare, LifeBuoy, IdCard, CalendarClock, CalendarOff,
  FileSpreadsheet, HandCoins, UserRound,
} from 'lucide-react';

export const NAV = [
  {
    group: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard', end: true },
      { to: '/workflow', label: 'Business Flow', icon: Workflow, module: 'pipeline' },
    ],
  },
  {
    group: 'Sales & CRM',
    items: [
      { to: '/leads', label: 'Leads', icon: Target, module: 'leads' },
      { to: '/crm/activities', label: 'Follow-ups', icon: MessageSquare, module: 'activities' },
      { to: '/clients', label: 'Clients', icon: Contact, module: 'clients' },
      { to: '/site-visits', label: 'Site Visits', icon: MapPin, module: 'siteVisits' },
      { to: '/boq', label: 'BOQ / Estimation', icon: Calculator, module: 'boq' },
      { to: '/quotations', label: 'Quotations', icon: FileText, module: 'quotations' },
    ],
  },
  {
    group: 'Projects',
    items: [
      { to: '/projects', label: 'Projects', icon: FolderKanban, module: 'projects' },
      { to: '/tasks', label: 'Tasks & Work Plan', icon: ListChecks, module: 'tasks' },
      { to: '/site-reports', label: 'Daily Site Reports', icon: ClipboardList, module: 'dailyReports' },
      { to: '/interior', label: 'Interior Design', icon: Sofa, module: 'rooms' },
      { to: '/documents', label: 'Documents & Photos', icon: Images, module: 'documents' },
      { to: '/crm/tickets', label: 'Service & Complaints', icon: LifeBuoy, module: 'tickets' },
    ],
  },
  {
    group: 'Materials & Purchase',
    items: [
      { to: '/inventory/stock', label: 'Stock', icon: Boxes, module: 'stock' },
      { to: '/inventory/requests', label: 'Material Requests', icon: ClipboardPlus, module: 'materialRequests' },
      { to: '/purchase/orders', label: 'Purchase Orders', icon: ShoppingCart, module: 'purchaseOrders' },
      { to: '/purchase/rfqs', label: 'RFQ', icon: Send, module: 'rfqs' },
      { to: '/purchase/vendors', label: 'Vendors', icon: Store, module: 'vendors' },
      { to: '/inventory/materials', label: 'Material Master', icon: Package, module: 'materials' },
    ],
  },
  {
    group: 'Workforce',
    items: [
      { to: '/workforce/attendance', label: 'Attendance', icon: CalendarCheck, module: 'attendance' },
      { to: '/workforce/workers', label: 'Workers', icon: HardHat, module: 'workers' },
      { to: '/workforce/subcontractors', label: 'Subcontractors', icon: Briefcase, module: 'subcontractors' },
      { to: '/workforce/work-orders', label: 'Work Orders', icon: Briefcase, module: 'workOrders' },
      { to: '/measurements', label: 'Measurement Book', icon: Ruler, module: 'measurements' },
    ],
  },
  {
    group: 'Finance',
    items: [
      { to: '/finance/bills', label: 'Bills & Invoices', icon: Receipt, module: 'bills' },
      { to: '/finance/payments', label: 'Payments', icon: Wallet, module: 'payments' },
      { to: '/finance/expenses', label: 'Expenses', icon: Banknote, module: 'expenses' },
    ],
  },
  {
    group: 'HR & Payroll',
    items: [
      { to: '/hr/me', label: 'My HR', icon: UserRound, module: 'leaves' },
      { to: '/hr/employees', label: 'Employees', icon: IdCard, module: 'employees' },
      { to: '/hr/attendance', label: 'Staff Attendance', icon: CalendarClock, module: 'staffAttendance' },
      { to: '/hr/leaves', label: 'Leave', icon: CalendarOff, module: 'leaves' },
      { to: '/hr/payroll', label: 'Payroll', icon: FileSpreadsheet, module: 'payroll' },
      { to: '/hr/advances', label: 'Salary Advances', icon: HandCoins, module: 'advances' },
    ],
  },
  {
    group: 'Insights',
    items: [
      { to: '/reports', label: 'Reports', icon: BarChart3, module: 'reports' },
      { to: '/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    group: 'Administration',
    items: [
      { to: '/users', label: 'Users & Roles', icon: Users, module: 'users' },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];
