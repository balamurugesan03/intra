import { Link } from 'react-router-dom';
import {
  Target, Contact, MapPin, Calculator, FileText, BadgeCheck, FolderKanban, ListChecks, Boxes, HardHat, ClipboardList,
  Ruler, Receipt, Wallet, Flag, TrendingUp, ArrowDown, ArrowRight, MessageSquare, LifeBuoy, IdCard, CalendarClock, CalendarOff,
  FileSpreadsheet, HandCoins, CalendarCheck,
} from 'lucide-react';
import { useApi } from '../lib/hooks';
import { Card, CardHeader, PageHeader, PageLoader, StatCard } from '../components/ui';
import { moneyShort, cn } from '../lib/format';

const STEPS = [
  { key: 'leads', title: 'Lead', icon: Target, to: '/leads', how: 'Capture enquiry with requirement, budget & follow-up date.' },
  { key: 'followups', title: 'Follow-ups', icon: MessageSquare, to: '/crm/activities?status=Open', how: 'Lead ⋯ → “Log call / follow-up”. Next date drives reminders.' },
  { key: 'clients', title: 'Client', icon: Contact, to: '/clients', how: 'Lead ⋯ → “Convert to client”. Client 360° shows the whole relationship.' },
  { key: 'visits', title: 'Site Visit', icon: MapPin, to: '/site-visits', how: 'Lead ⋯ → “Schedule site visit”. Record measurements & photos.' },
  { key: 'boq', title: 'Estimation / BOQ', icon: Calculator, to: '/boq', how: 'Site visit ⋯ → “Prepare BOQ”. Material + labour rates + margin.' },
  { key: 'quotes', title: 'Quotation', icon: FileText, to: '/quotations', how: 'BOQ ⋯ → “Create quotation”. Discount, GST, versions.' },
  { key: 'approved', title: 'Client Approval', icon: BadgeCheck, to: '/quotations?status=Approved', how: 'Send → client approves (portal) or record approval.' },
  { key: 'projects', title: 'Project Creation', icon: FolderKanban, to: '/projects', how: 'Approved quotation → “Convert to project”. Budget & value auto-filled.' },
  { key: null, title: 'Work Plan', icon: ListChecks, to: '/tasks', how: 'Area-wise tasks, assignees, priorities & dependencies.' },
  { key: null, title: 'Material + Labour', icon: Boxes, to: '/inventory/requests', how: 'Material request → PO → GRN to site. Attendance & work orders.' },
  { key: 'execution', title: 'Site Execution', icon: HardHat, to: '/projects?status=Ongoing', how: 'Track stock consumption, wastage, labour on site.' },
  { key: null, title: 'Daily Progress', icon: ClipboardList, to: '/site-reports', how: 'Daily site report: work done, pending, issues, photos.' },
  { key: 'measurement', title: 'Measurement', icon: Ruler, to: '/measurements', how: 'Measure executed work (L×B×H) → verify.' },
  { key: 'billing', title: 'Client Billing', icon: Receipt, to: '/finance/bills?billType=Client', how: 'Verified measurement ⋯ → “Generate client invoice”.' },
  { key: 'payment', title: 'Payment', icon: Wallet, to: '/finance/payments', how: 'Record receipt against invoice. Balance auto-updates.' },
  { key: 'completed', title: 'Project Completion', icon: Flag, to: '/projects?status=Completed', how: 'Mark project Completed after handover.' },
  { key: 'tickets', title: 'After-sales Service', icon: LifeBuoy, to: '/crm/tickets', how: 'Snag / complaint ticket → “Create rework task” → task done resolves it.' },
  { key: 'pl', title: 'Profit / Loss', icon: TrendingUp, to: '/reports?r=profit-loss', how: 'Billed revenue vs material + labour + subcontract + expenses.' },
];

// People flows that feed the project cost (labour) and company cash flow (salaries)
const PEOPLE_FLOWS = [
  {
    title: 'Site labour',
    steps: [
      { title: 'Workers', icon: HardHat, to: '/workforce/workers', how: 'Trade, daily wage & OT rate' },
      { title: 'Daily muster', icon: CalendarCheck, to: '/workforce/attendance', how: 'Wages → project labour cost' },
      { title: 'Wage settlement', icon: Wallet, to: '/workforce/attendance', how: 'Unpaid days → Labour Wages payment', count: (hr) => moneyShort(hr.unpaidWages) },
    ],
  },
  {
    title: 'Staff HR & payroll',
    steps: [
      { title: 'Employees', icon: IdCard, to: '/hr/employees', how: 'Salary structure, reporting line, login', count: (hr) => hr.employees },
      { title: 'Staff attendance', icon: CalendarClock, to: '/hr/attendance', how: 'Daily muster for office & site staff' },
      { title: 'Leave', icon: CalendarOff, to: '/hr/leaves?status=Pending', how: 'Apply → manager / HR approves → on muster', count: (hr) => hr.pendingLeaves },
      { title: 'Advances', icon: HandCoins, to: '/hr/advances', how: 'Paid now, recovered in payroll' },
      { title: 'Payroll', icon: FileSpreadsheet, to: '/hr/payroll', how: 'Run → approve → pay: Salary payments + payslips', count: (hr) => hr.payrolls },
    ],
  },
];

export default function Workflow() {
  const { data, isLoading } = useApi('/dashboard/pipeline');
  if (isLoading) return <PageLoader />;
  const counts = Object.fromEntries((data?.stages || []).map((s) => [s.key, s.count]));
  const f = data?.finance || {};

  return (
    <div>
      <PageHeader title="Business Flow" description="The complete Lead → Profit/Loss lifecycle. Every step links to where the work happens." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Billed revenue" value={moneyShort(f.billed)} tone="blue" />
        <StatCard label="Received" value={moneyShort(f.received)} tone="green" />
        <StatCard label="Total cost" value={moneyShort(f.totalCost)} tone="amber" />
        <StatCard label="Profit / Loss" value={moneyShort(f.profit)} tone={f.profit >= 0 ? 'green' : 'red'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => {
            const count = s.key === 'pl' ? moneyShort(f.profit) : s.key ? counts[s.key] : null;
            return (
              <div key={s.title} className="relative">
                <Link to={s.to} className="group block h-full">
                  <Card className="h-full p-4 transition group-hover:-translate-y-0.5 group-hover:border-brand-300 group-hover:shadow-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10"><s.icon className="size-4.5" /></div>
                      <span className="text-[11px] font-semibold text-slate-400">STEP {i + 1}</span>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white">{s.title}</h3>
                      {count != null && <span className="text-lg font-bold text-brand-600 tabular-nums">{count}</span>}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{s.how}</p>
                  </Card>
                </Link>
                {i < STEPS.length - 1 && (
                  <div className={cn('absolute z-10 hidden text-slate-300 dark:text-slate-700 lg:block', (i + 1) % 4 === 0 ? 'hidden' : 'top-1/2 -right-3 -translate-y-1/2')}>
                    <ArrowRight className="size-4" />
                  </div>
                )}
                {i < STEPS.length - 1 && <div className="flex justify-center py-1 text-slate-300 sm:hidden"><ArrowDown className="size-4" /></div>}
              </div>
            );
          })}
        </div>

        <Card className="h-fit">
          <CardHeader title="Lead funnel" subtitle="Leads by status" />
          <div className="space-y-3 p-5">
            {['New', 'Contacted', 'Site Visit', 'Estimation', 'Quoted', 'Won', 'Lost'].map((st) => {
              const v = data.leadStatus.find((x) => x.name === st)?.value || 0;
              const max = Math.max(1, ...data.leadStatus.map((x) => x.value));
              return (
                <Link key={st} to={`/leads?status=${st}`} className="block">
                  <div className="mb-1 flex justify-between text-xs"><span className="text-slate-600 dark:text-slate-400">{st}</span><b>{v}</b></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className={cn('h-full rounded-full', st === 'Won' ? 'bg-emerald-500' : st === 'Lost' ? 'bg-red-400' : 'bg-brand-500')} style={{ width: `${(v / max) * 100}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[3fr_5fr]">
        {PEOPLE_FLOWS.map((flow) => (
          <Card key={flow.title}>
            <CardHeader title={flow.title} />
            <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-stretch">
              {flow.steps.map((s, i) => (
                <div key={s.title} className="flex flex-1 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                  <Link to={s.to} className="block flex-1 rounded-lg border border-slate-200 p-3 transition hover:border-brand-300 hover:shadow dark:border-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      <s.icon className="size-4 text-brand-600" />
                      {s.count && data?.hr && <span className="text-sm font-bold text-brand-600 tabular-nums">{s.count(data.hr)}</span>}
                    </div>
                    <p className="mt-2 text-sm font-semibold">{s.title}</p>
                    <p className="text-xs leading-relaxed text-slate-500">{s.how}</p>
                  </Link>
                  {i < flow.steps.length - 1 && <ArrowRight className="mx-auto size-4 shrink-0 rotate-90 text-slate-300 sm:rotate-0 dark:text-slate-700" />}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
