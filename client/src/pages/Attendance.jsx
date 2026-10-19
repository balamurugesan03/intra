import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarCheck, Save, Users, UserCheck, UserX, IndianRupee } from 'lucide-react';
import { useApi, useAction } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import RefSelect from '../components/data/RefSelect';
import ResourcePage from '../components/data/ResourcePage';
import { REF } from '../config/resources';
import { Button, Card, PageHeader, Input, EmptyState, PageLoader, StatCard, Tabs, Badge, Modal, Field, Select } from '../components/ui';
import { PAYMENT_MODES } from '../lib/constants';
import { money, today, cn, fmtDate } from '../lib/format';

const OPTIONS = [
  { v: 'Present', short: 'P', cls: 'bg-emerald-600 text-white border-emerald-600' },
  { v: 'Half Day', short: 'H', cls: 'bg-amber-500 text-white border-amber-500' },
  { v: 'Absent', short: 'A', cls: 'bg-red-500 text-white border-red-500' },
];

function MusterSheet() {
  const [params] = useSearchParams();
  const { can } = useAuth();
  const [project, setProject] = useState(params.get('project') || '');
  const [date, setDate] = useState(today());
  const [marks, setMarks] = useState({});
  const action = useAction();
  const { data, isLoading } = useApi(project ? '/attendance/sheet' : null, { project, date });
  const canEdit = can('attendance', 'edit');

  useEffect(() => {
    if (!data) return;
    const m = {};
    for (const r of data.rows) {
      const a = r.attendance;
      if (a && String(a.project) !== project) continue;
      if (a || String(r.worker.currentProject?._id) === project) m[r.worker._id] = { status: a?.status || '', otHours: a?.otHours || 0 };
    }
    setMarks(m);
  }, [data, project]);

  const rows = data?.rows || [];
  const stats = useMemo(() => {
    const vals = Object.entries(marks).filter(([, m]) => m.status);
    const wage = vals.reduce((s, [id, m]) => {
      const w = rows.find((r) => r.worker._id === id)?.worker;
      if (!w) return s;
      const d = m.status === 'Present' ? 1 : m.status === 'Half Day' ? 0.5 : 0;
      return s + d * w.dailyWage + (m.status === 'Absent' ? 0 : (Number(m.otHours) || 0) * (w.otRate || 0));
    }, 0);
    return { present: vals.filter(([, m]) => m.status === 'Present').length, half: vals.filter(([, m]) => m.status === 'Half Day').length, absent: vals.filter(([, m]) => m.status === 'Absent').length, wage };
  }, [marks, rows]);

  const set = (id, patch) => setMarks((m) => ({ ...m, [id]: { status: '', otHours: 0, ...m[id], ...patch } }));
  const markAll = (status) => {
    const m = { ...marks };
    for (const r of rows) {
      const elsewhere = r.attendance && String(r.attendance.project) !== project;
      if (!elsewhere && (String(r.worker.currentProject?._id) === project || m[r.worker._id])) m[r.worker._id] = { otHours: 0, ...m[r.worker._id], status };
    }
    setMarks(m);
  };
  const save = () => action.mutate({
    url: '/attendance/bulk',
    body: { project, date, entries: Object.entries(marks).filter(([, m]) => m.status).map(([worker, m]) => ({ worker, ...m })) },
    success: 'Attendance saved',
  });

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-end">
        <div className="md:w-80"><label className="label">Site / project</label><RefSelect {...REF.project} labelOf={REF.project.label} params={{ status: 'Ongoing,Planning' }} value={project} onChange={(v) => setProject(v || '')} placeholder="Select site" /></div>
        <div className="md:w-48"><label className="label">Date</label><Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></div>
        {project && canEdit && (
          <div className="flex gap-2 md:ml-auto">
            <Button variant="secondary" size="sm" onClick={() => markAll('Present')}>All present</Button>
            <Button icon={Save} loading={action.isPending} onClick={save}>Save attendance</Button>
          </div>
        )}
      </Card>

      {!project ? <Card><EmptyState icon={CalendarCheck} title="Select a site to mark attendance" description="Workers assigned to the site are listed first. You can also mark workers from other sites." /></Card> : isLoading ? <PageLoader /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Present" value={stats.present} icon={UserCheck} tone="green" />
            <StatCard label="Half day" value={stats.half} icon={Users} tone="amber" />
            <StatCard label="Absent" value={stats.absent} icon={UserX} tone="red" />
            <StatCard label="Wages for the day" value={money(stats.wage)} icon={IndianRupee} tone="brand" />
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50/70 dark:bg-slate-800/30"><tr><th className="th">Worker</th><th className="th">Trade</th><th className="th text-right">Wage</th><th className="th">Attendance</th><th className="th">OT hrs</th><th className="th">Assigned site</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map(({ worker: w, attendance: a }) => {
                    const elsewhere = a && String(a.project) !== project;
                    const m = marks[w._id] || {};
                    const here = String(w.currentProject?._id) === project;
                    return (
                      <tr key={w._id} className={cn(!here && !m.status && 'opacity-60')}>
                        <td className="td"><p className="font-medium">{w.name}</p><p className="text-xs text-slate-500">{w.code}</p></td>
                        <td className="td"><span className="text-sm">{w.trade}</span> <Badge tone="slate" className="ml-1">{w.skillType}</Badge></td>
                        <td className="td text-right tabular-nums">{money(w.dailyWage)}</td>
                        <td className="td">
                          {elsewhere ? <span className="text-xs text-slate-500">Marked at another site</span> : (
                            <div className="flex gap-1">
                              {OPTIONS.map((o) => (
                                <button key={o.v} type="button" disabled={!canEdit} title={o.v} onClick={() => set(w._id, { status: m.status === o.v ? '' : o.v })}
                                  className={cn('size-8 rounded-lg border text-xs font-bold transition', m.status === o.v ? o.cls : 'border-slate-200 text-slate-500 hover:border-slate-400 dark:border-slate-700')}>
                                  {o.short}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="td"><Input type="number" min={0} className="h-8 w-20" disabled={elsewhere || !canEdit || !m.status || m.status === 'Absent'} value={m.otHours ?? 0} onChange={(e) => set(w._id, { otHours: e.target.value })} /></td>
                        <td className="td text-xs text-slate-500">{w.currentProject ? w.currentProject.name : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

const registerConfig = {
  key: 'attendance-register', endpoint: '/attendance', module: 'attendance', title: 'Attendance register', singular: 'Attendance', creatable: false,
  columns: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'worker', label: 'Worker', render: (r) => <><p className="font-medium">{r.worker?.name}</p><p className="text-xs text-slate-500">{r.worker?.trade}</p></> },
    { key: 'project.name', label: 'Site' },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'otHours', label: 'OT hrs', type: 'number' },
    { key: 'wage', label: 'Wage', type: 'currency' },
    { key: 'payment', label: 'Paid', render: (r) => (r.payment ? <Badge tone="green" dot>Paid</Badge> : <span className="text-slate-400">Unpaid</span>), exportValue: (r) => (r.payment ? 'Paid' : 'Unpaid') },
  ],
  canEditRow: (r) => !r.payment,
  filters: [{ name: 'project', label: 'Site', ref: REF.project }, { name: 'worker', label: 'Worker', ref: REF.worker }, { name: 'status', label: 'Status', options: ['Present', 'Half Day', 'Absent'] }],
  fields: [
    { name: 'status', label: 'Status', type: 'select', options: ['Present', 'Half Day', 'Absent'] },
    { name: 'otHours', label: 'OT hours', type: 'number' },
    { name: 'remarks', label: 'Remarks', type: 'textarea' },
  ],
};

/** Muster → unpaid wages per worker → one Labour Wages payment each (days get locked to it) */
function WageSettlement() {
  const [params] = useSearchParams();
  const { can } = useAuth();
  const action = useAction();
  const [f, setF] = useState({ project: params.get('project') || '', from: '', to: today() });
  const [paying, setPaying] = useState(false);
  const [pay, setPay] = useState({});
  const { data, isLoading } = useApi('/attendance/wages', { project: f.project || undefined, from: f.from || undefined, to: f.to || undefined });
  const items = data?.items || [];
  const canPay = can('payments', 'edit') && !!f.project && items.length > 0;

  const submit = () => action.mutate(
    { url: '/attendance/settle', body: { ...f, ...pay }, success: 'Wages paid · payments recorded' },
    { onSuccess: () => setPaying(false) },
  );

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-end">
        <div className="md:w-80"><label className="label">Site / project</label><RefSelect {...REF.project} labelOf={REF.project.label} value={f.project} onChange={(v) => setF({ ...f, project: v || '' })} placeholder="All sites" /></div>
        <div className="md:w-44"><label className="label">From</label><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
        <div className="md:w-44"><label className="label">Up to</label><Input type="date" value={f.to} max={today()} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
        {can('payments', 'edit') && (
          <Button className="md:ml-auto" icon={IndianRupee} disabled={!canPay} title={f.project ? undefined : 'Select a site to pay wages'}
            onClick={() => { setPay({ date: today(), mode: 'Cash', reference: '' }); setPaying(true); }}>
            Pay {money(data?.total || 0)}
          </Button>
        )}
      </Card>
      <Card className="overflow-hidden">
        {isLoading ? <PageLoader /> : items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/70 dark:bg-slate-800/30"><tr><th className="th">Worker</th><th className="th">Site</th><th className="th">Period</th><th className="th text-right">Days</th><th className="th text-right">OT hrs</th><th className="th text-right">Wages due</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((g) => (
                  <tr key={`${g.worker._id}-${g.project._id}`}>
                    <td className="td"><p className="font-medium">{g.worker.name}</p><p className="text-xs text-slate-500">{g.worker.code} · {g.worker.trade}</p></td>
                    <td className="td text-sm">{g.project.code} · {g.project.name}</td>
                    <td className="td text-sm text-slate-500">{fmtDate(g.from, 'dd MMM')} – {fmtDate(g.to, 'dd MMM')}</td>
                    <td className="td text-right tabular-nums">{g.days}</td>
                    <td className="td text-right tabular-nums">{g.otHours}</td>
                    <td className="td text-right font-semibold tabular-nums">{money(g.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={IndianRupee} title="No unpaid wages" description="Wages from the daily muster appear here until they are paid." />}
      </Card>

      <Modal open={paying} onClose={() => setPaying(false)} title="Pay wages" description={`${items.length} worker payment(s) · ${money(data?.total || 0, true)}. These attendance days are then locked.`}
        footer={<><Button variant="secondary" onClick={() => setPaying(false)}>Cancel</Button><Button loading={action.isPending} onClick={submit}>Pay wages</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Payment date"><Input type="date" value={pay.date || ''} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></Field>
          <Field label="Mode"><Select value={pay.mode} options={PAYMENT_MODES} onChange={(e) => setPay({ ...pay, mode: e.target.value })} /></Field>
          <Field label="Reference" className="sm:col-span-2"><Input value={pay.reference || ''} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}

export default function Attendance() {
  const [tab, setTab] = useState('sheet');
  const { can } = useAuth();
  return (
    <div>
      <PageHeader title="Attendance" description="Daily muster roll per site. Wages and overtime are calculated automatically, then settled as payments." />
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[
        { value: 'sheet', label: 'Daily muster' },
        { value: 'register', label: 'Register & wages' },
        can('attendance') && { value: 'wages', label: 'Wage settlement' },
      ].filter(Boolean)} />
      {tab === 'sheet' && <MusterSheet />}
      {tab === 'register' && <ResourcePage embedded config={registerConfig} />}
      {tab === 'wages' && <WageSettlement />}
    </div>
  );
}
