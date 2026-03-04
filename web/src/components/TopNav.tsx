import { NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Boxes,
  History,
  LayoutDashboard,
  LogOut,
  Moon,
  PiggyBank,
  Receipt,
  ShoppingCart,
  Sun,
  Users
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../lib/authContext';
import { useEffect, useState } from 'react';

function applyTheme(next: 'light' | 'dark') {
  const root = document.documentElement;
  if (next === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
  localStorage.setItem('theme', next);
}

function NavItem(props: {
  to: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <NavLink
      to={props.to}
      className={({ isActive }) =>
        clsx(
          'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition',
          isActive
            ? 'bg-brand-50 text-brand-700 dark:bg-slate-900 dark:text-brand-200'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100'
        )
      }
    >
      <span className='text-slate-500 dark:text-slate-400'>{props.icon}</span>
      <span>{props.label}</span>
    </NavLink>
  );
}

function NavItemMobile(props: { to: string; label: string; icon: React.ReactNode }) {
  return (
    <NavLink
      to={props.to}
      className={({ isActive }) =>
        clsx(
          'flex w-20 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold',
          isActive
            ? 'bg-brand-50 text-brand-700 dark:bg-slate-900 dark:text-brand-200'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100'
        )
      }
    >
      <span className='text-slate-500 dark:text-slate-400'>{props.icon}</span>
      <span className='truncate'>{props.label}</span>
    </NavLink>
  );
}

export function TopNav() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <header className='sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70'>
      <div className='mx-auto w-full max-w-[1200px] px-4'>
        <div className='flex h-16 items-center justify-between'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-brand-100 shadow-soft ring-1 ring-brand-200 dark:bg-slate-900 dark:ring-slate-800'>
              <img src='/logo.png' alt='ELMAN logo' className='h-full w-full object-cover' />
            </div>
            <div className='text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100'>
              <span className='text-brand-700'>EL</span>
              <span>MAN</span>
            </div>
          </div>

          <nav className='hidden items-center gap-2 md:flex'>
            {user?.role === 'owner' ? (
              <NavItem to='/dashboard' label='Dashboard' icon={<LayoutDashboard size={18} />} />
            ) : null}
            {user ? <NavItem to='/' label='POS' icon={<ShoppingCart size={18} />} /> : null}
            {user?.role === 'owner' ? (
              <NavItem to='/inventory' label='Inventory' icon={<Boxes size={18} />} />
            ) : null}
            {user?.role === 'owner' ? (
              <NavItem to='/inventory/value' label='Value' icon={<PiggyBank size={18} />} />
            ) : null}
            {user?.role === 'owner' ? (
              <NavItem to='/reports' label='Reports' icon={<BarChart3 size={18} />} />
            ) : null}
            {user ? <NavItem to='/history' label='History' icon={<History size={18} />} /> : null}
            {user?.role === 'owner' ? (
              <NavItem to='/customers' label='Customers' icon={<Users size={18} />} />
            ) : null}
            {user?.role === 'owner' ? (
              <NavItem to='/expenses' label='Expenses' icon={<Receipt size={18} />} />
            ) : null}
          </nav>

          <div className='flex items-center gap-3'>
            <button
              type='button'
              className='rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100'
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {user ? (
              <div className='hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200 sm:flex'>
                <span className='inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-bold dark:bg-slate-800'>
                  {user.username.slice(0, 1).toUpperCase()}
                </span>
                <span className='font-medium'>{user.username}</span>
                <span className='text-xs font-semibold text-slate-500 dark:text-slate-400'>({user.role})</span>
              </div>
            ) : null}

            {user ? (
              <button
                className='rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                title='Logout'
                type='button'
                onClick={() => {
                  logout();
                  nav('/login');
                }}
              >
                <LogOut size={18} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Mobile nav */}
        {user ? (
          <nav className='flex gap-2 overflow-x-auto pb-3 md:hidden'>
            {user?.role === 'owner' ? (
              <NavItemMobile to='/dashboard' label='Dashboard' icon={<LayoutDashboard size={18} />} />
            ) : null}
            <NavItemMobile to='/' label='POS' icon={<ShoppingCart size={18} />} />
            {user?.role === 'owner' ? (
              <NavItemMobile to='/inventory' label='Inventory' icon={<Boxes size={18} />} />
            ) : null}
            {user?.role === 'owner' ? (
              <NavItemMobile to='/inventory/value' label='Value' icon={<PiggyBank size={18} />} />
            ) : null}
            {user?.role === 'owner' ? (
              <NavItemMobile to='/reports' label='Reports' icon={<BarChart3 size={18} />} />
            ) : null}
            <NavItemMobile to='/history' label='History' icon={<History size={18} />} />
            {user?.role === 'owner' ? (
              <NavItemMobile to='/customers' label='Customers' icon={<Users size={18} />} />
            ) : null}
            {user?.role === 'owner' ? (
              <NavItemMobile to='/expenses' label='Expenses' icon={<Receipt size={18} />} />
            ) : null}
          </nav>
        ) : null}
      </div>
    </header>
  );
}



