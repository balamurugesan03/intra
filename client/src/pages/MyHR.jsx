import { Link } from 'react-router-dom';
import { CalendarOff, FileText, UserRound } from 'lucide-react';
import { useApi } from '../lib/hooks';
import { Button, Card, CardHeader, PageHeader, PageLoader, EmptyState, KeyValue, StatusBadge } from '../components/ui';
import { MyLeaveBalance } from './Leaves';
import { monthLabel } from '../config/resources';
import { fmtDate, money } from '../lib/format';

/** Employee self-service: profile, leave balance and payslips */
export default function MyHR() {
  const { data, isLoading } = useApi('/payslips');
  if (isLoading) return <PageLoader />;
  const e = data?.employee;

  return (
    <div>
      <PageHeader title="My HR" description="Your leave balance and payslips."
        actions={e && <Button icon={CalendarOff} to="/hr/leaves?create=1">Apply leave</Button>} />
      {!e ? (
        <Card><EmptyState icon={UserRound} title="No employee profile linked" description="Ask HR to link your login to your employee record to apply for leave and see payslips." /></Card>
      ) : (
        <>
          <MyLeaveBalance />
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader title={e.name} subtitle={`${e.code} · ${e.designation || ''}`} icon={UserRound} />
              <div className="p-5">
                <KeyValue cols={1} items={[
                  { label: 'Department', value: e.department }, { label: 'Joined', value: fmtDate(e.joiningDate) },
                  { label: 'Phone', value: e.phone }, { label: 'Email', value: e.email || '—' },
                ]} />
              </div>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader title="Payslips" icon={FileText} />
              {data.items.length ? (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.items.map((s) => (
                    <li key={s.payroll}>
                      <Link to={`/hr/payslips/${s.payroll}/${e._id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <div><p className="font-medium">{monthLabel(s.month)}</p><p className="text-xs text-slate-500">{s.line.payableDays} paid day(s) · gross {money(s.line.gross)}</p></div>
                        <div className="flex items-center gap-3"><b className="tabular-nums">{money(s.line.net)}</b><StatusBadge value={s.status} /></div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState title="No payslips yet" className="py-8" />}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
