import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  LayoutDashboard, MessageSquare, FileText, FolderKanban, Receipt, LifeBuoy, Pencil, Phone, Mail, MapPin, Target,
  CalendarPlus, Calculator, Check,
} from 'lucide-react';
import { useApi } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import { put, errMsg } from '../lib/api';
import {
  Card, CardHeader, PageHeader, PageLoader, Tabs, StatusBadge, Progress, Button, Drawer, KeyValue, EmptyState, StatCard, Badge,
} from '../components/ui';
import ResourcePage from '../components/data/ResourcePage';
import ResourceForm from '../components/data/ResourceForm';
import * as R from '../config/resources';
import { ticketsFor } from './Tickets';
import { fmtDate, money, moneyShort, ago, cn } from '../lib/format';

/** Where the client stands in the Lead → Project → After-sales flow */
function Journey({ s }) {
  const lead = s.leads[0];
  const steps = [
    { label: 'Enquiry', done: !!lead, hint: lead ? `${lead.code} · ${lead.status}` : 'Direct client' },
    { label: 'Site visit', done: s.counts.siteVisits > 0, hint: `${s.counts.siteVisits} visit(s)` },
    { label: 'Quotation', done: s.counts.quotations > 0, hint: s.finance.quoted ? moneyShort(s.finance.quoted) : 'None yet' },
    { label: 'Approved', done: s.counts.approvedQuotes > 0, hint: `${s.counts.approvedQuotes} approved` },
    { label: 'Project', done: s.counts.projects > 0, hint: `${s.counts.projects} project(s)` },
    { label: 'Billing', done: s.finance.billed > 0, hint: `${moneyShort(s.finance.received)} of ${moneyShort(s.finance.billed)} received` },
    { label: 'After-sales', done: s.projects.some((p) => p.status === 'Completed'), hint: s.counts.openTickets ? `${s.counts.openTickets} open ticket(s)` : 'No open tickets' },
  ];
  return (
    <Card className="p-5">
      <ol className="grid gap-4 sm:grid-cols-4 lg:grid-cols-7">
        {steps.map((st, i) => (
          <li key={st.label} className="flex gap-3 lg:flex-col lg:gap-2">
            <div className="flex items-center gap-2">
              <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold', st.done ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800')}>
                {st.done ? <Check className="size-4" /> : i + 1}
              </span>
              {i < steps.length - 1 && <span className={cn('hidden h-0.5 flex-1 lg:block', st.done ? 'bg-brand-300' : 'bg-slate-200 dark:bg-slate-700')} />}
            </div>
            <div>
              <p className="text-sm font-medium">{st.label}</p>
              <p className="text-xs text-slate-500">{st.hint}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Overview({ client, s, can }) {
  return (
    <div className="space-y-6">
      <Journey s={s} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Contact" icon={Phone} />
          <div className="p-5">
            <KeyValue cols={1} items={[
              { label: 'Phone', value: client.phone }, { label: 'Email', value: client.email || '—' },
              { label: 'Company', value: client.company || '—' }, { label: 'GSTIN', value: client.gstin || '—' },
              { label: 'Address', value: [client.address, client.city].filter(Boolean).join(', ') || '—' },
              { label: 'Client since', value: fmtDate(client.createdAt) },
            ]} />
            {s.leads.map((l) => (
              <div key={l._id} className="mt-4 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
                <p className="flex items-center justify-between"><span className="text-xs text-slate-500">Lead {l.code} · {l.source}</span><StatusBadge value={l.status} /></p>
                {l.budget > 0 && <p className="mt-1">Budget <b>{money(l.budget)}</b></p>}
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Recent activity" subtitle="Calls, meetings & follow-ups" icon={MessageSquare} />
          {s.activities.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {s.activities.map((a) => (
                <li key={a._id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{a.subject}</span><Badge tone="slate">{a.type}</Badge></div>
                  <p className="text-xs text-slate-500">{fmtDate(a.date)} · {a.by?.name}{a.outcome ? ` · ${a.outcome}` : ''}</p>
                  {a.status === 'Open' && a.nextFollowUp && <p className="mt-1 text-xs font-medium text-amber-600">Next: {fmtDate(a.nextFollowUp)}{a.nextAction ? ` · ${a.nextAction}` : ''}</p>}
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No activity logged" description={can('activities', 'edit') ? 'Log calls and meetings to keep the trail.' : undefined} className="py-8" />}
        </Card>
        <Card>
          <CardHeader title="Projects" icon={FolderKanban} />
          {s.projects.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {s.projects.map((p) => (
                <li key={p._id} className="px-5 py-3">
                  <div className="flex justify-between gap-2 text-sm"><Link to={`/projects/${p._id}`} className="truncate font-medium hover:text-brand-600">{p.name}</Link><StatusBadge value={p.status} /></div>
                  <p className="mb-1.5 text-xs text-slate-500">{p.code} · {moneyShort(p.contractValue)}</p>
                  <Progress value={p.progress} size="sm" />
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No projects yet" description="Approved quotations convert into projects." className="py-8" />}
        </Card>
      </div>
    </div>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'overview';
  const setTab = (t) => setParams({ tab: t }, { replace: true });
  const { can, isExternal } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data: client, isLoading } = useApi(`/clients/${id}`);
  const { data: s } = useApi(`/clients/${id}/summary`);

  if (isLoading || !client) return <PageLoader />;
  const fixed = { client: id };

  const save = async (payload) => {
    setSaving(true);
    try {
      await put(`/clients/${id}`, payload);
      toast.success('Client updated');
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
    can('activities') && { value: 'activities', label: 'Follow-ups', icon: MessageSquare },
    can('quotations') && { value: 'quotations', label: 'Quotations', icon: FileText, count: s?.counts.quotations },
    can('projects') && { value: 'projects', label: 'Projects', icon: FolderKanban, count: s?.counts.projects },
    can('bills') && { value: 'invoices', label: 'Invoices', icon: Receipt },
    can('tickets') && { value: 'tickets', label: 'Service', icon: LifeBuoy, count: s?.counts.openTickets || undefined },
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Clients', to: '/clients' }, { label: client.code }]}
        title={client.name}
        description={client.company}
        actions={
          <>
            {can('activities', 'edit') && <Button variant="secondary" icon={MessageSquare} to={`/crm/activities?create=1&client=${id}`}>Log follow-up</Button>}
            {can('siteVisits', 'edit') && <Button variant="secondary" icon={CalendarPlus} to={`/site-visits?create=1&client=${id}`}>Site visit</Button>}
            {can('boq', 'edit') && <Button variant="secondary" icon={Calculator} to={`/boq?create=1&client=${id}`}>Prepare BOQ</Button>}
            {can('clients', 'edit') && <Button icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>}
          </>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
          <Badge tone="slate">{client.code}</Badge>
          <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 hover:text-brand-600"><Phone className="size-4" />{client.phone}</a>
          {client.email && <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 hover:text-brand-600"><Mail className="size-4" />{client.email}</a>}
          {client.city && <span className="flex items-center gap-1.5"><MapPin className="size-4" />{client.city}</span>}
          {s?.leads[0] && <span className="flex items-center gap-1.5"><Target className="size-4" />Enquiry {ago(s.leads[0].createdAt)}</span>}
        </div>
      </PageHeader>

      {s && !isExternal && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="Quoted" value={moneyShort(s.finance.quoted)} tone="brand" hint={`${s.counts.quotations} quotation(s)`} />
          <StatCard label="Contract value" value={moneyShort(s.finance.contractValue)} tone="blue" hint={`${s.counts.projects} project(s)`} />
          <StatCard label="Billed" value={moneyShort(s.finance.billed)} tone="violet" />
          <StatCard label="Received" value={moneyShort(s.finance.received)} tone="green" />
          <StatCard label="Outstanding" value={moneyShort(s.finance.outstanding)} tone={s.finance.outstanding > 0 ? 'amber' : 'green'} />
        </div>
      )}

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-6" />

      {tab === 'overview' && (s ? <Overview client={client} s={s} can={can} /> : <PageLoader />)}
      {tab === 'activities' && <ResourcePage embedded config={R.activities} fixed={fixed} title="Follow-ups & activities" />}
      {tab === 'quotations' && <ResourcePage embedded config={R.quotations} fixed={fixed} title="Quotations" />}
      {tab === 'projects' && <ResourcePage embedded config={R.projects} fixed={fixed} title="Projects" />}
      {tab === 'invoices' && <ResourcePage embedded config={{ ...R.bills, params: { billType: 'Client' } }} fixed={fixed} title="Invoices" />}
      {tab === 'tickets' && <ResourcePage embedded config={ticketsFor(isExternal)} fixed={fixed} title="Service & complaints" />}

      <Drawer open={editing} onClose={() => setEditing(false)} title={`Edit ${client.code}`}
        footer={<><Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button><Button type="submit" form="resource-form" loading={saving}>Save changes</Button></>}>
        {editing && <ResourceForm fields={R.clients.fields} record={client} onSubmit={save} />}
      </Drawer>
    </div>
  );
}
