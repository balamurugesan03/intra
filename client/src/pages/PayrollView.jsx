import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RefreshCw, CheckCircle2, RotateCcw, Wallet, Save, Download, FileText, Users, IndianRupee } from 'lucide-react';
import { useApi, useAction } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import { Button, Card, PageHeader, PageLoader, Modal, Field, Input, Select, StatCard, StatusBadge, EmptyState, useConfirm } from '../components/ui';
import { monthLabel } from '../config/resources';
import { PAYMENT_MODES } from '../lib/constants';
import { money, moneyShort, number, today, downloadCSV, fmtDate } from '../lib/format';

export default function PayrollView() {
  const { id } = useParams();
  const { can } = useAuth();
  const confirm = useConfirm();
  const action = useAction();
  const { data: p, isLoading } = useApi(`/payroll/${id}`);
  const [adj, setAdj] = useState({});
  const [paying, setPaying] = useState(false);
  const [pay, setPay] = useState({});

  useEffect(() => {
    if (p) setAdj(Object.fromEntries(p.lines.map((l) => [l._id, { bonus: l.bonus || 0, otherDeduction: l.otherDeduction || 0 }])));
  }, [p]);

  if (isLoading || !p) return <PageLoader />;
  const canEdit = can('payroll', 'edit');
  const draft = p.status === 'Draft' && canEdit;
  const dirty = p.lines.some((l) => adj[l._id] && (Number(adj[l._id].bonus) !== (l.bonus || 0) || Number(adj[l._id].otherDeduction) !== (l.otherDeduction || 0)));
  const setLine = (lineId, patch) => setAdj((a) => ({ ...a, [lineId]: { ...a[lineId], ...patch } }));

  const run = (url, success, body) => action.mutate({ url: `/payroll/${id}/${url}`, body, success });
  const saveAdj = () => action.mutate({ url: `/payroll/${id}/lines`, method: 'put', body: { lines: Object.entries(adj).map(([_id, v]) => ({ _id, ...v })) }, success: 'Adjustments saved' });
  const regenerate = async () => {
    if (await confirm({ title: 'Recalculate payroll?', message: 'Attendance, leave and advances are read again. Bonus and other deductions you entered are kept.', confirmText: 'Recalculate' })) run('regenerate', 'Payroll recalculated');
  };
  const approve = async () => {
    if (dirty) return saveAdj();
    if (await confirm({ title: `Approve payroll for ${monthLabel(p.month)}?`, message: `Net pay ${money(p.net)} for ${p.lines.length} employee(s). Payslips become visible to employees.`, confirmText: 'Approve' })) run('approve', 'Payroll approved');
  };
  const submitPay = () => action.mutate({ url: `/payroll/${id}/pay`, body: pay, success: 'Salaries paid · payments recorded' }, { onSuccess: () => setPaying(false) });

  const exportCsv = () => {
    const cols = ['code', 'name', 'designation', 'monthDays', 'payableDays', 'lopDays', 'basic', 'hra', 'allowances', 'bonus', 'gross', 'pf', 'esi', 'pt', 'advance', 'otherDeduction', 'deductions', 'net']
      .map((k) => ({ key: k, label: k }));
    downloadCSV(`payroll-${p.month}.csv`, cols, p.lines);
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Payroll', to: '/hr/payroll' }, { label: p.code }]}
        title={`Payroll · ${monthLabel(p.month)}`}
        description={p.status === 'Paid' ? `Paid on ${fmtDate(p.paidAt)}` : p.approvedBy ? `Approved by ${p.approvedBy.name}` : 'Review attendance-based pay, add bonus / deductions, then approve.'}
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={exportCsv}>Export</Button>
            {draft && <Button variant="secondary" icon={RefreshCw} onClick={regenerate}>Recalculate</Button>}
            {draft && dirty && <Button variant="secondary" icon={Save} loading={action.isPending} onClick={saveAdj}>Save adjustments</Button>}
            {draft && <Button icon={CheckCircle2} onClick={approve} disabled={dirty}>Approve</Button>}
            {p.status === 'Approved' && canEdit && <Button variant="secondary" icon={RotateCcw} onClick={() => run('reopen', 'Payroll reopened')}>Reopen</Button>}
            {p.status === 'Approved' && can('payroll', 'edit') && <Button icon={Wallet} onClick={() => { setPay({ date: today(), mode: 'Bank Transfer', reference: '' }); setPaying(true); }}>Pay salaries</Button>}
          </>
        }
      >
        <div className="mt-3"><StatusBadge value={p.status} /></div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Employees" value={p.lines.length} icon={Users} tone="brand" />
        <StatCard label="Gross" value={moneyShort(p.gross)} icon={IndianRupee} tone="blue" hint={money(p.gross)} />
        <StatCard label="Deductions" value={moneyShort(p.deductions)} tone="amber" hint="PF · ESI · PT · advance · other" />
        <StatCard label="Net pay" value={moneyShort(p.net)} tone="green" hint={money(p.net)} />
      </div>

      <Card className="overflow-hidden">
        {p.lines.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/70 dark:bg-slate-800/30">
                <tr>
                  <th className="th">Employee</th>
                  <th className="th text-right">Paid days</th>
                  <th className="th text-right">LOP</th>
                  <th className="th text-right">Basic + HRA + Allow.</th>
                  <th className="th text-right">Bonus</th>
                  <th className="th text-right">Gross</th>
                  <th className="th text-right">PF</th>
                  <th className="th text-right">ESI</th>
                  <th className="th text-right">PT</th>
                  <th className="th text-right">Advance</th>
                  <th className="th text-right">Other ded.</th>
                  <th className="th text-right">Net</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {p.lines.map((l) => (
                  <tr key={l._id}>
                    <td className="td"><p className="font-medium">{l.name}</p><p className="text-xs text-slate-500">{l.code} · {l.designation}</p></td>
                    <td className="td text-right tabular-nums">{number(l.payableDays)}<span className="text-xs text-slate-400"> / {l.monthDays}</span>{l.paidLeave > 0 && <p className="text-xs text-violet-600">{number(l.paidLeave)} leave</p>}</td>
                    <td className={`td text-right tabular-nums ${l.lopDays > 0 ? 'font-medium text-red-600' : 'text-slate-400'}`}>{number(l.lopDays)}</td>
                    <td className="td text-right tabular-nums">{money(l.basic + l.hra + l.allowances)}</td>
                    <td className="td text-right">{draft ? <Input type="number" min={0} className="ml-auto h-8 w-24 text-right" value={adj[l._id]?.bonus ?? 0} onChange={(e) => setLine(l._id, { bonus: e.target.value })} /> : money(l.bonus)}</td>
                    <td className="td text-right font-medium tabular-nums">{money(l.gross)}</td>
                    <td className="td text-right tabular-nums">{money(l.pf)}</td>
                    <td className="td text-right tabular-nums">{money(l.esi)}</td>
                    <td className="td text-right tabular-nums">{money(l.pt)}</td>
                    <td className="td text-right tabular-nums">{money(l.advance)}</td>
                    <td className="td text-right">{draft ? <Input type="number" min={0} className="ml-auto h-8 w-24 text-right" value={adj[l._id]?.otherDeduction ?? 0} onChange={(e) => setLine(l._id, { otherDeduction: e.target.value })} /> : money(l.otherDeduction)}</td>
                    <td className="td text-right font-semibold tabular-nums">{money(l.net)}</td>
                    <td className="td"><Link to={`/hr/payslips/${p._id}/${l.employee}`} className="flex items-center gap-1 text-xs text-brand-600 hover:underline"><FileText className="size-3.5" />Payslip</Link></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50/70 font-semibold dark:bg-slate-800/30">
                <tr>
                  <td className="td" colSpan={5}>Total</td>
                  <td className="td text-right tabular-nums">{money(p.gross)}</td>
                  <td className="td text-right tabular-nums" colSpan={5}>{money(p.deductions)}</td>
                  <td className="td text-right tabular-nums">{money(p.net)}</td>
                  <td className="td" />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : <EmptyState title="No employees on this payroll" description="Add employees with a joining date on or before this month, then recalculate." />}
      </Card>
      {p.notes && <p className="mt-4 text-sm whitespace-pre-line text-slate-500">{p.notes}</p>}

      <Modal open={paying} onClose={() => setPaying(false)} title={`Pay salaries · ${monthLabel(p.month)}`} description={`${p.lines.filter((l) => l.net > 0).length} salary payment(s) totalling ${money(p.net, true)} will be recorded, and advance instalments recovered.`}
        footer={<><Button variant="secondary" onClick={() => setPaying(false)}>Cancel</Button><Button loading={action.isPending} onClick={submitPay}>Pay salaries</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Payment date"><Input type="date" value={pay.date || ''} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></Field>
          <Field label="Mode"><Select value={pay.mode} options={PAYMENT_MODES} onChange={(e) => setPay({ ...pay, mode: e.target.value })} /></Field>
          <Field label="Reference / batch no." className="sm:col-span-2"><Input value={pay.reference || ''} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
