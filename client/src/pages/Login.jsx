import { useState } from 'react';
import { ArrowRight, CheckCircle2, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Field } from '../components/ui';
import { errMsg } from '../lib/api';
import { cn } from '../lib/format';

const DEMO = [
  ['Super Admin', 'superadmin@buildpro.in'], ['Project Manager', 'pm@buildpro.in'], ['Site Engineer', 'engineer@buildpro.in'],
  ['Estimator', 'estimator@buildpro.in'], ['Purchase Manager', 'purchase@buildpro.in'], ['Accountant', 'accounts@buildpro.in'],
  ['Designer', 'designer@buildpro.in'], ['Store Manager', 'store@buildpro.in'], ['Site Supervisor', 'supervisor@buildpro.in'],
  ['Contractor', 'contractor@buildpro.in'], ['Worker', 'worker@buildpro.in'], ['Client', 'client@buildpro.in'],
];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('superadmin@buildpro.in');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative isolate hidden overflow-hidden bg-black lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(224,178,53,.22),transparent_50%),radial-gradient(circle_at_85%_95%,rgba(166,124,18,.18),transparent_45%)]" />
        <div className="absolute inset-0 opacity-[.05] [background-image:linear-gradient(#e0b235_1px,transparent_1px),linear-gradient(90deg,#e0b235_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="relative flex h-full flex-col items-center justify-between p-12 text-white">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <img src={`${import.meta.env.BASE_URL}logo-512.png`} alt="Intra Interiors" className="size-72 animate-pop mix-blend-lighten xl:size-80" />
            <div className="bg-gold mt-2 h-px w-40 opacity-60" />
            <h1 className="mt-8 max-w-lg text-3xl leading-tight font-bold tracking-tight xl:text-4xl">
              Run every site, every rupee and every room — <span className="text-gold">from one place.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-md text-neutral-400">Construction & interior project management: leads to handover, BOQ to billing, stock to profit.</p>
            <ul className="mt-8 grid grid-cols-2 gap-3 text-left text-sm text-neutral-300">
              {['Lead → Quotation → Project', 'Daily site reports & attendance', 'Measurement-based billing', 'Live profit / loss per project'].map((t) => (
                <li key={t} className="flex items-center gap-2.5 rounded-lg border border-brand-400/15 bg-brand-400/5 px-3 py-2"><CheckCircle2 className="size-4 shrink-0 text-brand-400" />{t}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs tracking-widest text-brand-200/40 uppercase">© {new Date().getFullYear()} Intra Interiors</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden"><img src={`${import.meta.env.BASE_URL}logo-192.png`} alt="Intra Interiors" className="size-28 rounded-2xl shadow-xl shadow-brand-500/20" /></div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in to your workspace</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Email">
              <div className="relative">
                <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                <input className="input h-11 pl-10" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
              </div>
            </Field>
            <Field label="Password">
              <div className="relative">
                <Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                <input className="input h-11 pl-10" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </div>
            </Field>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
            <Button type="submit" size="lg" loading={loading} className="w-full">Sign in <ArrowRight className="size-4" /></Button>
          </form>

          <div className="mt-8">
            <p className="mb-2 text-xs font-medium text-slate-500">Demo accounts · password <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">password123</code></p>
            <div className="flex flex-wrap gap-1.5">
              {DEMO.map(([role, mail]) => (
                <button key={mail} type="button" onClick={() => { setEmail(mail); setPassword('password123'); }}
                  className={cn('rounded-md border px-2 py-1 text-xs transition', email === mail ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400')}>
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
