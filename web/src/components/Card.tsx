import { clsx } from 'clsx';

export function Card(props: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900/70',
        props.className
      )}
    >
      {props.children}
    </div>
  );
}
