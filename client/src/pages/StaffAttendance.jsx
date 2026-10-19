import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Save, UserCheck, UserX, Users, CalendarOff } from 'lucide-react';
import { useApi, useAction } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import ResourcePage from '../components/data/ResourcePage';
import { REF } from '../config/resources';
import { Button, Card, PageHeader, Input, EmptyState, PageLoader, StatCard, Tabs, Badge } from '../components/ui';
import { STAFF_ATTENDANCE_STATUS } from '../lib/constants';
import { today, cn } from '../lib/format';

const OPTIONS = [
  { v: 'Present', short: 'P', cls: 'bg-emerald-600 text-white border-emerald-600' },
  { v: 'Half Day', short: 'H', cls: 'bg-amber-500 text-white border-amber-500' },
  { v: 'Absent', short: 'A', cls: 'bg-red-500 text-white border-red-500' },
  { v: 'Week Off', short: 'W', cls: 'bg-slate-500 text-white border-slate-500' },
  { v: 'Holiday', short: 'HD', cls: 'bg-cyan-600 text-white border-cyan-600' },
];

function DailyMuster() {
  const { can } = useAuth();
  const [date, setDate] = useState(today());
  const [marks, setMarks] = useState({});
  const action = useAction();
  const { data, isLoading } = useApi('/staff-attendance/sheet', { date });
  const canEdit = can('staffAttendance', 'edit');

  useEffect(() => {
    if (!data) return;
    setMarks(Object.fromEntries(data.rows.filter((r) => r.attendance && !r.attendance.leave).map((r) => [r.employee._id, {
      status: r.attendance.status, checkIn: r.attendance.checkIn || '', checkOut: r.attendance.checkOut || '',
    }])));
  }, [data]);

  const rows = data?.rows || [];
  const stats = useMemo(() => {
    const vals = Object.values(marks);
    return {
      present: vals.filter((m) => m.status === 'Present').length,
      half: vals.filter((m) => m.status === 'Half Day').length,
      absent: vals.filter((m) => m.status === 'Absent').length,
      leave: rows.filter((r) => r.attendance?.leave).length,
    };
  }, [marks, rows]);

  const set = (id, patch) => setMarks((m) => ({ ...m, [id]: { status: '', checkIn: '', checkOut: '', ...m[id], ...patch } }));
  const markAll = (status) => setMarks((m) => {
    const next = { ...m };
    for (const r of rows) if (!r.attendance?.leave && !next[r.employee._id]?.status) next[r.employee._id] = { checkIn: '', checkOut: '', ...next[r.employee._id], status };
    return next;
  });
  const save = () => action.mutate({
    url: '/staff-attendance/bulk',
    body: { date, entries: Object.entries(marks).filter(([, m]) => m.status).map(([employee, m]) => ({ employee, ...m })) },
    success: 'Attendance saved',
  });

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-end">
        <div className="md:w-48"><label className="label">Date</label><Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></div>
        {canEdit && rows.length > 0 && (
          <div className="flex flex-wrap gap-2 md:ml-auto">
            <Button variant="secondary" size="sm" onClick={() => markAll('Present')}>Unmarked → present</Button>
            <Button variant="secondary" size="sm" onClick={() => markAll('Holiday')}>Mark holiday</Button>
            <Button icon={Save} loading={action.isPending} onClick={save}>Save attendance</Button>
          </div>
        )}
      </Card>

      {isLoading ? <PageLoader /> : !rows.length ? (
        <Card><EmptyState icon={CalendarClock} title="No employees yet" description="Add staff in Employees to start the muster roll." action={<Button to="/hr/employees">Employees</Button>} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Present" value={stats.present} icon={UserCheck} tone="green" />
            <StatCard label="Half day" value={stats.half} icon={Users} tone="amber" />
            <StatCard label="Absent" value={stats.absent} icon={UserX} tone="red" />
            <StatCard label="On leave" value={stats.leave} icon={CalendarOff} tone="violet" />
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50/70 dark:bg-slate-800/30"><tr><th className="th">Employee</th><th className="th">Department</th><th className="th">Attendance</th><th className="th">In</th><th className="th">Out</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map(({ employee: e, attendance: a }) => {
                    const m = marks[e._id] || {};
                    return (
                      <tr key={e._id}>
                        <td className="td"><p className="font-medium">{e.name}</p><p className="text-xs text-slate-500">{e.code} · {e.designation}</p></td>
                        <td className="td text-sm text-slate-500">{e.department}</td>
                        <td className="td">
                          {a?.leave ? <Badge tone="violet" dot>{a.leave.leaveType}{a.leave.halfDay ? ' (half)' : ''} · {a.leave.code}</Badge> : (
                            <div className="flex gap-1">
                              {OPTIONS.map((o) => (
                                <button key={o.v} type="button" disabled={!canEdit} title={o.v} onClick={() => set(e._id, { status: m.status === o.v ? '' : o.v })}
                                  className={cn('h-8 min-w-8 rounded-lg border px-1.5 text-xs font-bold transition', m.status === o.v ? o.cls : 'border-slate-200 text-slate-500 hover:border-slate-400 dark:border-slate-700')}>
                                  {o.short}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="td"><Input type="time" className="h-8 w-28" disabled={!canEdit || !!a?.leave || !['Present', 'Half Day'].includes(m.status)} value={m.checkIn || ''} onChange={(ev) => set(e._id, { checkIn: ev.target.value })} /></td>
                        <td className="td"><Input type="time" className="h-8 w-28" disabled={!canEdit || !!a?.leave || !['Present', 'Half Day'].includes(m.status)} value={m.checkOut || ''} onChange={(ev) => set(e._id, { checkOut: ev.target.value })} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="text-xs text-slate-500">Leave days come from approved leave applications. Unmarked days are treated as working days in payroll; only Absent, half of a Half Day and Loss-of-Pay leave reduce salary.</p>
        </>
      )}
    </div>
  );
}

function MonthlyRegister() {
  const [month, setMonth] = useState(today().slice(0, 7));
  const { data, isLoading } = useApi('/staff-attendance/summary', { month });
  const cols = STAFF_ATTENDANCE_STATUS;
  return (
    <div className="space-y-4">
      <Card className="p-4"><div className="md:w-48"><label className="label">Month</label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div></Card>
      {isLoading ? <PageLoader /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/70 dark:bg-slate-800/30">
                <tr><th className="th">Employee</th>{cols.map((c) => <th key={c} className="th text-right">{c}</th>)}<th className="th text-right">Unmarked</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(data?.rows || []).map((r) => (
                  <tr key={r.employee._id}>
                    <td className="td"><p className="font-medium">{r.employee.name}</p><p className="text-xs text-slate-500">{r.employee.code} · {r.employee.designation}</p></td>
                    {cols.map((c) => <td key={c} className={cn('td text-right tabular-nums', !r.counts[c] && 'text-slate-300 dark:text-slate-600', c === 'Absent' && r.counts[c] > 0 && 'font-semibold text-red-600')}>{r.counts[c]}</td>)}
                    <td className="td text-right text-slate-500 tabular-nums">{data.days - r.marked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

const registerConfig = {
  key: 'staff-attendance-register', endpoint: '/staff-attendance', module: 'staffAttendance', title: 'Attendance records', singular: 'Attendance', creatable: false,
  columns: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'employee', label: 'Employee', render: (r) => <><p className="font-medium">{r.employee?.name}</p><p className="text-xs text-slate-500">{r.employee?.designation}</p></> },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'checkIn', label: 'In' },
    { key: 'checkOut', label: 'Out' },
    { key: 'leave.code', label: 'Leave' },
    { key: 'remarks', label: 'Remarks' },
  ],
  filters: [{ name: 'employee', label: 'Employee', ref: REF.employee }, { name: 'status', label: 'Status', options: STAFF_ATTENDANCE_STATUS }],
  canEditRow: (r) => !r.leave,
  fields: [
    { name: 'status', label: 'Status', type: 'select', options: STAFF_ATTENDANCE_STATUS.filter((s) => s !== 'Leave') },
    { name: 'checkIn', label: 'Check in', type: 'time' },
    { name: 'checkOut', label: 'Check out', type: 'time' },
    { name: 'remarks', label: 'Remarks', type: 'textarea' },
  ],
};

export default function StaffAttendance() {
  const [tab, setTab] = useState('daily');
  return (
    <div>
      <PageHeader title="Staff Attendance" description="Office & site staff muster. Approved leave appears automatically and everything flows into payroll." />
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'daily', label: 'Daily muster' }, { value: 'month', label: 'Monthly register' }, { value: 'records', label: 'Records' }]} />
      {tab === 'daily' && <DailyMuster />}
      {tab === 'month' && <MonthlyRegister />}
      {tab === 'records' && <ResourcePage embedded config={registerConfig} />}
    </div>
  );
}
