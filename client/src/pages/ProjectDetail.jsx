import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  LayoutDashboard, ListChecks, ClipboardList, Boxes, HardHat, Ruler, IndianRupee, Sofa, Images, Pencil, MapPin,
  CalendarDays, User, Users, FileText, ChevronDown, AlertTriangle, Briefcase, LifeBuoy,
} from 'lucide-react';
import { useApi } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import { put, errMsg } from '../lib/api';
import {
  Card, CardHeader, PageHeader, PageLoader, Tabs, StatusBadge, Progress, Button, Drawer, Menu, KeyValue, Avatar, EmptyState, StatCard, Badge,
} from '../components/ui';
import ResourcePage from '../components/data/ResourcePage';
import ResourceForm from '../components/data/ResourceForm';
import * as R from '../config/resources';
import { PROJECT_STATUS } from '../lib/constants';
import { fmtDate, money, moneyShort, number } from '../lib/format';
import InteriorBoard from './Interior';
import DocumentsBoard from './Documents';
import { ticketsFor } from './Tickets';

const attendanceConfig = {
  key: 'attendance', endpoint: '/attendance', module: 'attendance', title: 'Attendance', singular: 'Attendance', creatable: false, editable: false,
  columns: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'worker.name', label: 'Worker' },
    { key: 'worker.trade', label: 'Trade' },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'otHours', label: 'OT hrs', type: 'number' },
    { key: 'wage', label: 'Wage', type: 'currency' },
  ],
  filters: [{ name: 'status', label: 'Status', options: ['Present', 'Half Day', 'Absent'] }],
  fields: [],
};

function Overview({ project, s }) {
  const f = s.finance;
  const costData = [
    { name: 'Material', value: f.material, color: '#3b82f6' },
    { name: 'Labour', value: f.labour, color: '#06b6d4' },
    { name: 'Subcontract', value: f.subcontract, color: '#8b5cf6' },
    { name: 'Expenses', value: f.expenses, color: '#f59e0b' },
  ];
  const used = project.budget ? Math.round((f.totalCost / project.budget) * 100) : 0;
  const start = project.startDate ? new Date(project.startDate).getTime() : Date.now();
  const end = project.endDate ? new Date(project.endDate).getTime() : Date.now();
  const planned = end > start ? Math.min(100, Math.max(0, Math.round(((Date.now() - start) / (end - start)) * 100))) : 0;
  const profit = f.billed - f.totalCost;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Contract value" value={moneyShort(project.contractValue)} tone="brand" hint={money(project.contractValue)} />
        <StatCard label="Billed" value={moneyShort(f.billed)} tone="blue" hint={`${project.contractValue ? Math.round((f.billed / project.contractValue) * 100) : 0}% of value`} />
        <StatCard label="Received" value={moneyShort(f.received)} tone="green" hint={`Outstanding ${moneyShort(f.outstanding)}`} />
        <StatCard label="Total cost" value={moneyShort(f.totalCost)} tone="amber" hint={`Budget ${moneyShort(project.budget)}`} />
        <StatCard label="Profit / Loss" value={moneyShort(profit)} tone={profit >= 0 ? 'green' : 'red'} hint="Billed − cost to date" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Cost breakdown" subtitle={`Budget utilisation ${used}%`} icon={IndianRupee} />
          <div className="grid gap-6 p-5 md:grid-cols-2">
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={costData} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} width={80} />
                  <Tooltip formatter={(v) => money(v)} cursor={{ fill: 'rgba(148,163,184,.1)' }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>{costData.map((c) => <Cell key={c.name} fill={c.color} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex justify-between text-sm"><span className="text-slate-500">Budget used</span><b>{money(f.totalCost)} / {money(project.budget)}</b></div>
                <Progress value={used} tone={used > 100 ? 'bg-red-500' : used > 85 ? 'bg-amber-500' : 'bg-emerald-500'} />
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-sm"><span className="text-slate-500">Actual progress</span></div>
                <Progress value={project.progress} />
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-sm"><span className="text-slate-500">Planned (time elapsed)</span></div>
                <Progress value={planned} tone="bg-slate-400" />
              </div>
              {s.boq && (
                <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500">BOQ estimate ({s.boq.code})</p>
                  <p className="mt-0.5 flex justify-between"><span>Estimated cost</span><b>{money(s.boq.costTotal)}</b></p>
                  <p className="flex justify-between"><span>Actual vs BOQ</span><b className={f.totalCost > s.boq.costTotal ? 'text-red-600' : 'text-emerald-600'}>{s.boq.costTotal ? Math.round((f.totalCost / s.boq.costTotal) * 100) : 0}%</b></p>
                </div>
              )}
              {project.progress < planned - 10 && (
                <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"><AlertTriangle className="size-4" /> Behind schedule by {planned - project.progress}%</p>
              )}
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Tasks" subtitle={`${s.tasks.total} total · ${s.tasks.overdue} overdue`} icon={ListChecks} />
          <div className="space-y-3 p-5">
            {['To Do', 'In Progress', 'On Hold', 'Done'].map((st) => (
              <div key={st} className="flex items-center justify-between text-sm">
                <StatusBadge value={st} />
                <span className="font-semibold tabular-nums">{s.tasks[st] || 0}</span>
              </div>
            ))}
            <div className="border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
              <div className="flex justify-between"><span className="text-slate-500">Labour man-days</span><b>{number(s.labourDays)}</b></div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Project details" icon={FileText} />
          <div className="p-5">
            <KeyValue items={[
              { label: 'Client', value: project.client?.name }, { label: 'Phone', value: project.client?.phone },
              { label: 'Type', value: project.projectType }, { label: 'City', value: project.city },
              { label: 'Start', value: fmtDate(project.startDate) }, { label: 'Expected end', value: fmtDate(project.endDate) },
              { label: 'Quotation', value: project.quotation ? `${project.quotation.code} v${project.quotation.version}` : '—' },
              { label: 'Completed', value: project.completedAt ? fmtDate(project.completedAt) : '—' },
            ]} />
            {project.description && <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">{project.description}</p>}
          </div>
        </Card>
        <Card>
          <CardHeader title="Team" icon={Users} />
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {[project.manager && { ...project.manager, role: 'Project Manager' }, ...(project.team || [])].filter(Boolean).map((m) => (
              <li key={m._id + m.role} className="flex items-center gap-3 px-5 py-2.5">
                <Avatar name={m.name} className="size-7 text-[10px]" />
                <div><p className="text-sm font-medium">{m.name}</p><p className="text-xs text-slate-500">{m.role}</p></div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Subcontract work orders" icon={Briefcase} />
          {s.workOrders.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {s.workOrders.map((w) => (
                <li key={w._id} className="px-5 py-3">
                  <div className="flex justify-between gap-2 text-sm"><span className="truncate font-medium">{w.title}</span><b className="tabular-nums">{moneyShort(w.contractAmount)}</b></div>
                  <p className="mb-1.5 text-xs text-slate-500">{w.code} · {w.subcontractor?.name}</p>
                  <Progress value={w.progress} size="sm" />
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No work orders" className="py-8" />}
        </Card>
      </div>
    </div>
  );
}

function SiteStock({ s }) {
  return (
    <Card className="mb-6 overflow-hidden">
      <CardHeader title="Stock at this site" subtitle="Received + transferred − consumed − wasted" icon={Boxes} />
      {s.stock.length ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/70 dark:bg-slate-800/30"><tr><th className="th">Material</th><th className="th">Category</th><th className="th text-right">Available</th><th className="th text-right">Value</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {s.stock.map((x) => (
                <tr key={x.material?._id}>
                  <td className="td font-medium">{x.material?.name}</td>
                  <td className="td text-slate-500">{x.material?.category}</td>
                  <td className="td text-right tabular-nums">{number(x.quantity)} {x.material?.unit}</td>
                  <td className="td text-right tabular-nums">{money(x.quantity * (x.material?.rate || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState title="No stock at site" description="Receive a PO or transfer from warehouse." className="py-8" />}
    </Card>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'overview';
  const setTab = (t) => setParams({ tab: t }, { replace: true });
  const { can, isExternal } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data: project, isLoading } = useApi(`/projects/${id}`);
  const { data: summary } = useApi(`/projects/${id}/summary`);

  if (isLoading || !project) return <PageLoader />;
  const fixed = { project: id };
  const canEdit = can('projects', 'edit');

  const setStatus = async (status) => {
    try {
      await put(`/projects/${id}`, { status });
      toast.success(`Project marked ${status}`);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const save = async (payload) => {
    setSaving(true);
    try {
      await put(`/projects/${id}`, payload);
      toast.success('Project updated');
      setEditing(false);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { value: 'overview', label: 'Overview', icon: LayoutDashboard },
    can('tasks') && { value: 'tasks', label: 'Tasks', icon: ListChecks, count: summary?.tasks.total },
    can('dailyReports') && { value: 'reports', label: 'Site Reports', icon: ClipboardList },
    can('stock') && { value: 'materials', label: 'Materials', icon: Boxes },
    can('attendance') && { value: 'labour', label: 'Labour', icon: HardHat },
    can('measurements') && { value: 'measurements', label: 'Measurements', icon: Ruler },
    (can('bills') || can('payments')) && { value: 'finance', label: 'Finance', icon: IndianRupee },
    can('rooms') && { value: 'interior', label: 'Interior', icon: Sofa },
    can('documents') && { value: 'documents', label: 'Documents', icon: Images },
    can('tickets') && { value: 'service', label: 'Service', icon: LifeBuoy },
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Projects', to: '/projects' }, { label: project.code }]}
        title={project.name}
        actions={canEdit && (
          <>
            <Menu items={PROJECT_STATUS.filter((s) => s !== project.status).map((s) => ({ label: `Mark ${s}`, onClick: () => setStatus(s) }))}
              trigger={<Button variant="secondary">Status: {project.status} <ChevronDown className="size-4" /></Button>} />
            <Button icon={Pencil} onClick={() => setEditing(true)}>Edit project</Button>
          </>
        )}
      >
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
          <StatusBadge value={project.status} />
          <Badge tone="slate">{project.projectType}</Badge>
          <span className="flex items-center gap-1.5"><User className="size-4" />{project.client?.name}</span>
          {project.siteAddress && <span className="flex items-center gap-1.5"><MapPin className="size-4" />{project.siteAddress}</span>}
          <span className="flex items-center gap-1.5"><CalendarDays className="size-4" />{fmtDate(project.startDate)} → {fmtDate(project.endDate)}</span>
          <Progress value={project.progress} className="w-48" />
        </div>
      </PageHeader>

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-6" />

      {tab === 'overview' && (summary ? <Overview project={project} s={summary} /> : <PageLoader />)}
      {tab === 'tasks' && <ResourcePage embedded config={R.tasks} fixed={fixed} title="Work plan" />}
      {tab === 'reports' && <ResourcePage embedded config={R.dailyReports} fixed={fixed} title="Daily site reports" />}
      {tab === 'materials' && (
        <>
          {summary && <SiteStock s={summary} />}
          <div className="space-y-6">
            {can('materialRequests') && <ResourcePage embedded config={R.materialRequests} fixed={fixed} title="Material requests" />}
            <ResourcePage embedded title="Stock movements" fixed={fixed}
              config={{ ...R.stockTxns, defaults: () => ({ date: new Date().toISOString(), type: 'Consumption', fromProject: id, toProject: id }) }} />
          </div>
        </>
      )}
      {tab === 'labour' && (
        <div className="space-y-6">
          <div className="flex justify-end"><Button variant="secondary" icon={HardHat} to={`/workforce/attendance?project=${id}`}>Mark today's attendance</Button></div>
          <ResourcePage embedded config={attendanceConfig} fixed={fixed} title="Attendance & wages" />
          {can('workOrders') && <ResourcePage embedded config={R.workOrders} fixed={fixed} title="Subcontract work orders" />}
        </div>
      )}
      {tab === 'measurements' && <ResourcePage embedded config={R.measurements} fixed={fixed} title="Measurement book" />}
      {tab === 'finance' && (
        <div className="space-y-6">
          {summary && !isExternal && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Material" value={moneyShort(summary.finance.material)} tone="blue" />
              <StatCard label="Labour" value={moneyShort(summary.finance.labour)} tone="cyan" />
              <StatCard label="Subcontract" value={moneyShort(summary.finance.subcontract)} tone="violet" />
              <StatCard label="Expenses" value={moneyShort(summary.finance.expenses)} tone="amber" />
            </div>
          )}
          {can('bills') && <ResourcePage embedded config={R.bills} fixed={fixed} title="Bills & invoices" />}
          {can('payments') && <ResourcePage embedded config={R.payments} fixed={fixed} title="Payments" />}
          {can('expenses') && <ResourcePage embedded config={R.expenses} fixed={fixed} title="Expenses" />}
        </div>
      )}
      {tab === 'interior' && <InteriorBoard projectId={id} embedded />}
      {tab === 'documents' && <DocumentsBoard projectId={id} embedded />}
      {tab === 'service' && <ResourcePage embedded config={ticketsFor(isExternal)} fixed={fixed} title="Service & complaints" />}

      <Drawer open={editing} onClose={() => setEditing(false)} title={`Edit ${project.code}`}
        footer={<><Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button><Button type="submit" form="resource-form" loading={saving}>Save changes</Button></>}>
        {editing && <ResourceForm fields={R.projects.fields} record={project} onSubmit={save} />}
      </Drawer>
    </div>
  );
}

