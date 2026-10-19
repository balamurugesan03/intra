import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import ResourcePage from './components/data/ResourcePage';
import { PageLoader, EmptyState, Button } from './components/ui';
import * as R from './config/resources';
import Login from './pages/Login';
import { ShieldOff } from 'lucide-react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Workflow = lazy(() => import('./pages/Workflow'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const QuotationView = lazy(() => import('./pages/QuotationView'));
const BillView = lazy(() => import('./pages/BillView'));
const PurchaseOrderView = lazy(() => import('./pages/PurchaseOrderView'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Stock = lazy(() => import('./pages/Stock'));
const MaterialRequests = lazy(() => import('./pages/MaterialRequests'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Interior = lazy(() => import('./pages/Interior'));
const Documents = lazy(() => import('./pages/Documents'));
const Reports = lazy(() => import('./pages/Reports'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Settings = lazy(() => import('./pages/Settings'));
const Leads = lazy(() => import('./pages/Leads'));
const ClientDetail = lazy(() => import('./pages/ClientDetail'));
const Tickets = lazy(() => import('./pages/Tickets'));
const StaffAttendance = lazy(() => import('./pages/StaffAttendance'));
const Leaves = lazy(() => import('./pages/Leaves'));
const PayrollView = lazy(() => import('./pages/PayrollView'));
const Payslip = lazy(() => import('./pages/Payslip'));
const MyHR = lazy(() => import('./pages/MyHR'));

function Guard({ module, children }) {
  const { can } = useAuth();
  if (module && !can(module)) {
    return <EmptyState icon={ShieldOff} title="No access" description="Your role does not have permission to view this module." action={<Button to="/">Go to dashboard</Button>} />;
  }
  return children;
}

const res = (config) => <Guard module={config.module}><ResourcePage key={config.key} config={config} /></Guard>;

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center"><PageLoader /></div>;
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="workflow" element={<Guard module="pipeline"><Workflow /></Guard>} />

          <Route path="leads" element={<Guard module="leads"><Leads /></Guard>} />
          <Route path="crm/activities" element={res(R.activities)} />
          <Route path="clients" element={res(R.clients)} />
          <Route path="clients/:id" element={<Guard module="clients"><ClientDetail /></Guard>} />
          <Route path="site-visits" element={res(R.siteVisits)} />
          <Route path="boq" element={res(R.boq)} />
          <Route path="quotations" element={res(R.quotations)} />
          <Route path="quotations/:id" element={<Guard module="quotations"><QuotationView /></Guard>} />

          <Route path="projects" element={<Guard module="projects"><Projects /></Guard>} />
          <Route path="projects/:id" element={<Guard module="projects"><ProjectDetail /></Guard>} />
          <Route path="tasks" element={<Guard module="tasks"><Tasks /></Guard>} />
          <Route path="site-reports" element={res(R.dailyReports)} />
          <Route path="interior" element={<Guard module="rooms"><Interior /></Guard>} />
          <Route path="documents" element={<Guard module="documents"><Documents /></Guard>} />
          <Route path="crm/tickets" element={<Guard module="tickets"><Tickets /></Guard>} />

          <Route path="inventory/materials" element={res(R.materials)} />
          <Route path="inventory/stock" element={<Guard module="stock"><Stock /></Guard>} />
          <Route path="inventory/requests" element={<Guard module="materialRequests"><MaterialRequests /></Guard>} />
          <Route path="purchase/vendors" element={res(R.vendors)} />
          <Route path="purchase/rfqs" element={res(R.rfqs)} />
          <Route path="purchase/orders" element={res(R.purchaseOrders)} />
          <Route path="purchase/orders/:id" element={<Guard module="purchaseOrders"><PurchaseOrderView /></Guard>} />

          <Route path="workforce/workers" element={res(R.workers)} />
          <Route path="workforce/attendance" element={<Guard module="attendance"><Attendance /></Guard>} />
          <Route path="workforce/subcontractors" element={res(R.subcontractors)} />
          <Route path="workforce/work-orders" element={res(R.workOrders)} />
          <Route path="measurements" element={res(R.measurements)} />

          <Route path="finance/bills" element={res(R.bills)} />
          <Route path="finance/bills/:id" element={<Guard module="bills"><BillView /></Guard>} />
          <Route path="finance/payments" element={res(R.payments)} />
          <Route path="finance/expenses" element={res(R.expenses)} />

          <Route path="hr/me" element={<Guard module="leaves"><MyHR /></Guard>} />
          <Route path="hr/employees" element={res(R.employees)} />
          <Route path="hr/attendance" element={<Guard module="staffAttendance"><StaffAttendance /></Guard>} />
          <Route path="hr/leaves" element={<Guard module="leaves"><Leaves /></Guard>} />
          <Route path="hr/advances" element={res(R.advances)} />
          <Route path="hr/payroll" element={res(R.payroll)} />
          <Route path="hr/payroll/:id" element={<Guard module="payroll"><PayrollView /></Guard>} />
          <Route path="hr/payslips/:payroll/:employee" element={<Payslip />} />

          <Route path="reports" element={<Guard module="reports"><Reports /></Guard>} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="users" element={res(R.users)} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
