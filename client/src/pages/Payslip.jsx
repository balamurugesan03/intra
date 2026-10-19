import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { useApi } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import { Button, PageHeader, PageLoader } from '../components/ui';
import PrintDocument, { PartyBlock } from '../components/data/PrintDocument';
import { monthLabel } from '../config/resources';
import { fmtDate, money, number } from '../lib/format';

export default function Payslip() {
  const { payroll, employee } = useParams();
  const { can } = useAuth();
  const { data, isLoading } = useApi(`/payslips/${payroll}/${employee}`);
  if (isLoading || !data) return <PageLoader />;
  const { line: l, employee: e } = data;

  const earnings = [['Basic', l.basic], ['HRA', l.hra], ['Other allowances', l.allowances], l.bonus > 0 && ['Bonus / incentive', l.bonus]].filter(Boolean);
  const deductions = [
    l.pf > 0 && ['Provident fund', l.pf], l.esi > 0 && ['ESI', l.esi], l.pt > 0 && ['Professional tax', l.pt],
    l.advance > 0 && ['Advance recovery', l.advance], l.otherDeduction > 0 && ['Other deductions', l.otherDeduction],
  ].filter(Boolean);
  const rows = Array.from({ length: Math.max(earnings.length, deductions.length) }, (_, i) => ({
    _id: i, earning: earnings[i]?.[0], earningAmt: earnings[i]?.[1], deduction: deductions[i]?.[0], deductionAmt: deductions[i]?.[1],
  }));

  return (
    <div>
      <PageHeader
        breadcrumbs={can('payroll') ? [{ label: 'Payroll', to: '/hr/payroll' }, { label: data.code, to: `/hr/payroll/${payroll}` }, { label: e?.name }] : [{ label: 'My HR', to: '/hr/me' }, { label: 'Payslip' }]}
        title={`Payslip · ${monthLabel(data.month)}`}
        description={e?.name}
        actions={<Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print / PDF</Button>}
      />
      <PrintDocument
        docTitle="Payslip"
        code={monthLabel(data.month)}
        partyLabel="Employee"
        party={<PartyBlock name={e?.name} lines={[[e?.code, e?.designation].filter(Boolean).join(' · '), e?.department, e?.joiningDate && `Joined ${fmtDate(e.joiningDate)}`]} />}
        meta={[
          { label: 'Days in month', value: l.monthDays },
          { label: 'Paid days', value: number(l.payableDays) },
          { label: 'Loss of pay', value: number(l.lopDays) },
          l.paidLeave > 0 && { label: 'Paid leave', value: number(l.paidLeave) },
          e?.pan && { label: 'PAN', value: e.pan },
          e?.uan && { label: 'UAN', value: e.uan },
          e?.bankAccount && { label: 'Bank A/c', value: `${e.bankName || ''} ${e.bankAccount}`.trim() },
        ]}
        columns={[
          { key: 'earning', label: 'Earnings', render: (r) => r.earning || '' },
          { key: 'earningAmt', label: 'Amount', num: true, render: (r) => (r.earning ? money(r.earningAmt, true) : '') },
          { key: 'deduction', label: 'Deductions', render: (r) => r.deduction || '' },
          { key: 'deductionAmt', label: 'Amount', num: true, render: (r) => (r.deduction ? money(r.deductionAmt, true) : '') },
        ]}
        items={rows}
        totals={[
          { label: 'Gross earnings', value: money(l.gross, true) },
          { label: 'Total deductions', value: `− ${money(l.deductions, true)}` },
          { label: 'Net pay', value: money(l.net, true), strong: true },
        ]}
        footer={<p>This is a computer-generated payslip.</p>}
      />
    </div>
  );
}
