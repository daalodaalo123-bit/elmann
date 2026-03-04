import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { useAuth } from '../lib/authContext';
import { getErrorMessage } from '../lib/errors';

export function LoginPage() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to='/' replace />;

  async function submit() {
    if (!username.trim() || !password) return;
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      nav('/', { replace: true });
    } catch (e: unknown) {
      alert(getErrorMessage(e, 'Login failed. Please check your username and password.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className='mx-auto w-full max-w-md py-16'>
      <div className='mb-6 text-center'>
        <div className='text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100'>Login</div>
        <div className='mt-2 text-slate-500 dark:text-slate-400'>Sign in to continue</div>
      </div>

      <Card className='p-6'>
        <div className='space-y-4'>
          <div>
            <div className='text-sm font-semibold text-slate-700 dark:text-slate-200'>Username</div>
            <input
              className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500'
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete='username'
            />
          </div>
          <div>
            <div className='text-sm font-semibold text-slate-700 dark:text-slate-200'>Password</div>
            <input
              type='password'
              className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete='current-password'
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
            />
          </div>

          <button
            type='button'
            onClick={submit}
            disabled={submitting || !username.trim() || !password}
            className='mt-2 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-soft hover:bg-brand-700 disabled:opacity-60'
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </div>
      </Card>
    </div>
  );
}


