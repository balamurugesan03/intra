import { useState } from 'react';
import { LayoutGrid, List, CalendarDays, Phone } from 'lucide-react';
import ResourcePage from '../components/data/ResourcePage';
import { leads } from '../config/resources';
import { Segmented, Badge, Avatar } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useLocalStorage } from '../lib/hooks';
import { put, toastError } from '../lib/api';
import { LEAD_STATUS, STATUS_TONE } from '../lib/constants';
import { fmtDate, moneyShort, cn } from '../lib/format';

/** Sales pipeline: drag a lead to move it through the funnel. */
function Pipeline({ rows, loading, ctx, edit }) {
  const { can } = useAuth();
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const canEdit = can('leads', 'edit');

  const move = async (lead, status) => {
    if (lead.status === status) return;
    try {
      await put(`/leads/${lead._id}`, { status });
      ctx.refresh();
    } catch (e) {
      toastError(e);
    }
  };

  if (loading) return <div className="grid gap-3 p-4 md:grid-cols-4 xl:grid-cols-7">{LEAD_STATUS.map((s) => <div key={s} className="h-80 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}</div>;
  return (
    <div className="grid gap-3 overflow-x-auto p-4 md:grid-cols-4 xl:grid-cols-7">
      {LEAD_STATUS.map((status) => {
        const items = rows.filter((l) => l.status === status);
        const value = items.reduce((s, l) => s + (l.budget || 0), 0);
        return (
          <div key={status}
            onDragOver={(e) => { if (canEdit) { e.preventDefault(); setOver(status); } }}
            onDragLeave={() => setOver(null)}
            onDrop={() => { setOver(null); if (drag) move(drag, status); setDrag(null); }}
            className={cn('flex min-h-64 flex-col rounded-xl bg-slate-50 p-2 transition dark:bg-slate-800/30', over === status && 'ring-2 ring-brand-400')}>
            <div className="px-2 py-2">
              <div className="flex items-center gap-2">
                <Badge tone={STATUS_TONE[status]} dot>{status}</Badge>
                <span className="ml-auto rounded-full bg-white px-2 text-xs text-slate-500 dark:bg-slate-900">{items.length}</span>
              </div>
              {value > 0 && <p className="mt-1 text-xs text-slate-500">{moneyShort(value)} budget</p>}
            </div>
            <div className="flex-1 space-y-2">
              {items.map((l) => {
                const late = l.followUpDate && new Date(l.followUpDate) < new Date(new Date().toDateString()) && !['Won', 'Lost'].includes(l.status);
                return (
                  <div key={l._id} draggable={canEdit} onDragStart={() => setDrag(l)} onClick={() => canEdit && edit(l)}
                    className={cn('cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:shadow dark:border-slate-700 dark:bg-slate-900', drag?._id === l._id && 'opacity-50')}>
                    <p className="text-sm leading-snug font-medium">{l.name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{l.code} · {l.projectType}{l.location ? ` · ${l.location}` : ''}</p>
                    {l.budget > 0 && <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">{moneyShort(l.budget)}</p>}
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      {l.followUpDate && !['Won', 'Lost'].includes(l.status)
                        ? <span className={cn('flex items-center gap-1', late && 'font-medium text-red-600')}><CalendarDays className="size-3.5" />{fmtDate(l.followUpDate, 'dd MMM')}</span>
                        : <a href={`tel:${l.phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 hover:text-brand-600"><Phone className="size-3.5" />{l.phone}</a>}
                      {l.assignedTo && <Avatar name={l.assignedTo.name} className="size-5 text-[9px]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Leads() {
  const [view, setView] = useLocalStorage('leads-view', 'list');
  const config = { ...leads, pageSize: view === 'board' ? 300 : 25, renderList: view === 'board' ? (p) => <Pipeline {...p} /> : undefined };
  return (
    <ResourcePage key={view} config={config}
      extraActions={<Segmented value={view} onChange={setView} options={[{ value: 'list', label: 'List', icon: List }, { value: 'board', label: 'Pipeline', icon: LayoutGrid }]} />} />
  );
}
