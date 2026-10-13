import { Link, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import {
  FolderKanban, Activity, CheckCircle2, PauseCircle, IndianRupee, Wallet, Hourglass, Package, HardHat, TrendingUp,
  TrendingDown, AlertTriangle, CalendarClock, ClipboardList, ArrowRight, Boxes, Briefcase,
} from 'lucide-react';
import { useApi } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, PageHeader, StatCard, Progress, StatusBadge, PageLoader, EmptyState, Avatar, Button } from '../components/ui';
import { money, moneyShort, fmtDate, ago, cn } from '../lib/format';

const STATUS_COLORS = { Planning: '#6366f1', Ongoing: '#3b82f6', 'On Hold': '#f59e0b', Completed: '#10b981', Cancelled: '#94a3b8' };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: p.color }} />{p.name}: <b>{money(p.value)}</b></p>
      ))}
    </div>
  );
}

function TaskList({ tasks, overdue }) {
  if (!tasks?.length) return <EmptyState icon={overdue ? CheckCircle2 : CalendarClock} title={overdue ? 'No overdue tasks 🎉' : 'Nothing due this week'} className="py-8" />;
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {tasks.map((t) => (
        <li key={t._id}>
          <Link to={`/projects/${t.project?._id}?tab=tasks`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
            <div className={cn('size-2 shrink-0 rounded-full', overdue ? 'bg-red-500' : t.priority === 'Critical' ? 'bg-red-400' : t.priority === 'High' ? 'bg-amber-400' : 'bg-blue-400')} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{t.title}</p>
              <p className="truncate text-xs text-slate-500">{t.project?.code} · {t.area || 'General'} · {t.assignedTo?.name || 'Unassigned'}</p>
            </div>
            <div className="text-right">
              <p className={cn('text-xs font-medium', overdue ? 'text-red-600' : 'text-slate-600 dark:text-slate-400')}>{fmtDate(t.dueDate, 'dd MMM')}</p>
              <p className="text-[11px] text-slate-400">{t.progress}%</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { user, isExternal, can } = useAuth();
  const nav = useNavigate();
  const { data, isLoading } = useApi('/dashboard');
  if (isLoading || !data) return <PageLoader />;
  const k = data.kpis;
  const profitUp = k.profit >= 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${user.name.split(' ')[0]} 👋`}
        description={isExternal ? 'Here is the latest on your projects.' : "Here's what's happening across your projects today."}
        actions={!isExternal && can('leads', 'edit') && <><Button variant="secondary" to="/workflow">View business flow</Button><Button to="/leads?create=1">New lead</Button></>}
      />

      {/* KPI row 1: projects */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Projects" value={k.totalProjects} icon={FolderKanban} tone="slate" to="/projects" />
        <StatCard label="Ongoing" value={k.Ongoing} icon={Activity} tone="blue" to="/projects?status=Ongoing" />
        <StatCard label="Completed" value={k.Completed} icon={CheckCircle2} tone="green" to="/projects?status=Completed" />
        <StatCard label="On Hold" value={k['On Hold']} icon={PauseCircle} tone="amber" to="/projects?status=On Hold" />
        <StatCard label="Avg. Progress" value={`${k.avgProgress}%`} icon={TrendingUp} tone="violet" />
        <StatCard label="Total Project Value" value={moneyShort(k.contractValue)} icon={IndianRupee} tone="brand" hint={money(k.contractValue)} />
      </div>

      {/* KPI row 2: money */}
      <div className={cn('grid grid-cols-2 gap-3 md:grid-cols-3', isExternal ? 'xl:grid-cols-3' : 'xl:grid-cols-6')}>
        <StatCard label="Payment Received" value={moneyShort(k.received)} icon={Wallet} tone="green" hint={`${k.contractValue ? Math.round((k.received / k.contractValue) * 100) : 0}% of value`} />
        <StatCard label="Pending Payment" value={moneyShort(k.pending)} icon={Hourglass} tone="amber" hint={`Billed ${moneyShort(k.billed)}`} />
        {!isExternal && (
          <>
            <StatCard label="Material Purchase" value={moneyShort(k.material)} icon={Package} tone="blue" to={can('reports') ? '/reports?r=material-consumption' : undefined} />
            <StatCard label="Labour Cost" value={moneyShort(k.labour)} icon={HardHat} tone="cyan" hint={`+ Subcontract ${moneyShort(k.subcontract)}`} />
            <StatCard label="Profit / Loss" value={moneyShort(k.profit)} icon={profitUp ? TrendingUp : TrendingDown} tone={profitUp ? 'green' : 'red'} hint={`Billed − cost (${moneyShort(k.totalCost)})`} />
            <StatCard label="Low-stock Items" value={k.lowStock} icon={Boxes} tone={k.lowStock ? 'red' : 'slate'} to="/inventory/stock" />
          </>
        )}
        {isExternal && <StatCard label="Billed to date" value={moneyShort(k.billed)} icon={Briefcase} tone="blue" />}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Cash flow" subtitle="Money in vs money out · last 6 months" icon={IndianRupee} />
          <div className="h-72 p-4">
            <ResponsiveContainer>
              <BarChart data={data.cashflow} margin={{ left: 8, right: 8, top: 8 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={moneyShort} width={64} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,.12)' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="inflow" name="Received" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={28} />
                {!isExternal && <Bar dataKey="outflow" name="Spent" fill="#c99a1e" radius={[6, 6, 0, 0]} maxBarSize={28} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Project status" subtitle={`${k.totalProjects} projects`} icon={FolderKanban} />
          <div className="relative h-52">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data.projectStatus.filter((s) => s.value)} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={3} stroke="none">
                  {data.projectStatus.filter((s) => s.value).map((s) => <Cell key={s.name} fill={STATUS_COLORS[s.name]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold">{k.avgProgress}%</span>
              <span className="text-xs text-slate-500">avg progress</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 px-5 pb-5">
            {data.projectStatus.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <span className="size-2.5 rounded-sm" style={{ background: STATUS_COLORS[s.name] }} />
                <span className="text-slate-600 dark:text-slate-400">{s.name}</span>
                <span className="ml-auto font-semibold">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Site-wise summary */}
      <Card className="overflow-hidden">
        <CardHeader title="Site-wise summary" subtitle="Progress, value and spend per project" icon={Activity} action={<Button variant="ghost" size="sm" to="/projects">All projects <ArrowRight className="size-3.5" /></Button>} />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/70 dark:bg-slate-800/30">
              <tr>
                <th className="th">Project</th><th className="th">Status</th><th className="th">Progress</th>
                <th className="th text-right">Value</th>
                {!isExternal && <th className="th text-right">Cost</th>}
                {!isExternal && <th className="th">Budget used</th>}
                <th className="th text-right">Received</th><th className="th">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.sites.map((s) => {
                const used = s.budget ? Math.round((s.cost / s.budget) * 100) : 0;
                return (
                  <tr key={s._id} onClick={() => nav(`/projects/${s._id}`)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="td"><p className="font-medium text-slate-900 dark:text-white">{s.name}</p><p className="text-xs text-slate-500">{s.code} · {s.client}</p></td>
                    <td className="td"><StatusBadge value={s.status} /></td>
                    <td className="td"><Progress value={s.progress} className="w-32" size="sm" /></td>
                    <td className="td text-right tabular-nums">{moneyShort(s.contractValue)}</td>
                    {!isExternal && <td className="td text-right tabular-nums">{moneyShort(s.cost)}</td>}
                    {!isExternal && <td className="td"><Progress value={used} className="w-28" size="sm" tone={used > 100 ? 'bg-red-500' : used > 85 ? 'bg-amber-500' : 'bg-emerald-500'} /></td>}
                    <td className="td text-right tabular-nums">{moneyShort(s.received)}</td>
                    <td className="td text-slate-500">{fmtDate(s.endDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!data.sites.length && <EmptyState title="No projects yet" />}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Overdue tasks" subtitle={`${data.overdueTasks.length} need attention`} icon={AlertTriangle} />
          <TaskList tasks={data.overdueTasks} overdue />
        </Card>
        <Card>
          <CardHeader title="Upcoming tasks" subtitle="Due in the next 7 days" icon={CalendarClock} />
          <TaskList tasks={data.upcomingTasks} />
        </Card>
        <Card>
          <CardHeader title="Latest site reports" icon={ClipboardList} />
          {data.recentReports.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.recentReports.map((r) => (
                <li key={r._id} className="flex gap-3 px-5 py-3">
                  <Avatar name={r.submittedBy?.name} className="size-7 text-[10px]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm"><span className="font-medium">{r.project?.code}</span> <span className="text-slate-500">· {fmtDate(r.date, 'dd MMM')}</span></p>
                    <p className="line-clamp-2 text-xs text-slate-500">{r.workDone}</p>
                    {r.issues && <p className="mt-1 line-clamp-1 text-xs text-red-600">⚠ {r.issues}</p>}
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400">{ago(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No reports yet" className="py-8" />}
        </Card>
      </div>
    </div>
  );
}
