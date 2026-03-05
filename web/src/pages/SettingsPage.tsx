import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { getErrorMessage } from '../lib/errors';

export function SettingsPage() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const [confirmText, setConfirmText] = useState('');
  const [includeUsers, setIncludeUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canWipe = useMemo(() => confirmText.trim().toUpperCase() === 'DELETE ALL', [confirmText]);

  async function wipeAll() {
    if (user?.role !== 'owner') return;
    if (!canWipe) {
      alert('Type DELETE ALL to confirm');
      return;
    }
    const ok = confirm(
      includeUsers
        ? 'This will DELETE ALL DATA including users. You will be logged out. Continue?'
        : 'This will DELETE ALL business data from MongoDB (sales, expenses, products, customers). Continue?'
    );
    if (!ok) return;

    setSubmitting(true);
    try {
      const res = await api.post<{ ok: true; deleted: Record<string, number> }>('/api/admin/wipe', {
        confirm: confirmText,
        includeUsers
      });
      alert(`Deleted:\n${Object.entries(res.deleted)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')}`);

      if (includeUsers) {
        logout();
        nav('/login', { replace: true });
      } else {
        nav('/dashboard', { replace: true });
      }
    } catch (e: unknown) {
      alert(getErrorMessage(e, 'Wipe failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className='mb-6'>
        <div className='text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100'>Settings</div>
        <div className='mt-1 text-slate-500 dark:text-slate-400'>Danger zone</div>
      </div>

      <Card className='border-rose-200 p-6 dark:border-rose-900/60'>
        <div className='text-lg font-extrabold text-slate-900 dark:text-slate-100'>Delete all data</div>
        <div className='mt-2 text-sm text-slate-600 dark:text-slate-300'>
          This permanently deletes data from your MongoDB Atlas database and cannot be undone.
        </div>

        <div className='mt-5 grid grid-cols-1 gap-4 md:grid-cols-12'>
          <div className='md:col-span-7'>
            <div className='text-sm font-semibold text-slate-700 dark:text-slate-200'>Type DELETE ALL to confirm</div>
            <input
              className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-rose-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100'
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder='DELETE ALL'
            />
          </div>

          <div className='md:col-span-5'>
            <div className='text-sm font-semibold text-slate-700 dark:text-slate-200'>Options</div>
            <label className='mt-3 flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200'>
              <input
                type='checkbox'
                checked={includeUsers}
                onChange={(e) => setIncludeUsers(e.target.checked)}
                className='h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 dark:border-slate-700'
              />
              Also delete users (you will be logged out)
            </label>
          </div>
        </div>

        <div className='mt-6 flex items-center justify-end gap-3'>
          <button
            type='button'
            className='rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:bg-slate-900'
            onClick={() => nav(-1)}
          >
            Back
          </button>
          <button
            type='button'
            disabled={!canWipe || submitting}
            className='rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50'
            onClick={wipeAll}
          >
            {submitting ? 'Deleting…' : 'Delete all data'}
          </button>
        </div>
      </Card>
    </div>
  );
}

