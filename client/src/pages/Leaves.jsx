import ResourcePage from '../components/data/ResourcePage';
import { leaves } from '../config/resources';
import { useApi } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui';
import { number } from '../lib/format';

export const useIsHR = () => {
  const { role, isAdmin } = useAuth();
  return isAdmin || role === 'HR Manager';
};

/** Remaining / taken days per leave type for the current year (own profile) */
export function MyLeaveBalance() {
  const { data, error } = useApi('/leaves/balance', undefined, { retry: false });
  if (error) return <Card className="mb-6 p-4 text-sm text-slate-500">{error.response?.data?.message || 'Leave balance unavailable'}</Card>;
  if (!data) return null;
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
      {data.balance.map((b) => (
        <Card key={b.type} className="p-4">
          <p className="text-xs font-medium text-slate-500">{b.type}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {number(b.quota == null ? b.taken : b.balance)}
            <span className="ml-1 text-xs font-normal text-slate-400">{b.quota == null ? 'taken' : `of ${b.quota} left`}</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {b.quota == null ? 'No yearly limit' : `${number(b.taken)} taken`}{b.pending ? ` · ${number(b.pending)} pending` : ''}
          </p>
        </Card>
      ))}
    </div>
  );
}

export default function Leaves() {
  const { can } = useAuth();
  const isHR = useIsHR();
  const { data: mine } = useApi('/leaves/balance', undefined, { retry: false });
  const config = {
    ...leaves,
    // Only HR can pick another employee; everyone else applies for themselves
    fields: can('employees') ? leaves.fields : leaves.fields.filter((f) => !f.hrOnly),
    banner: () => <MyLeaveBalance />,
  };
  return <ResourcePage config={config} ctxExtra={{ isHR, myEmployee: mine?.employee?._id }} />;
}
