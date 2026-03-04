import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';

export function RequireAuth(props: {
  children: React.ReactNode;
  roles?: Array<'owner' | 'cashier'>;
}) {
  const { user, loading } = useAuth();
  if (loading) return <div className='py-10 text-center text-slate-500'>Loading...</div>;
  if (!user) return <Navigate to='/login' replace />;
  if (props.roles && !props.roles.includes(user.role)) return <Navigate to='/' replace />;
  return <>{props.children}</>;
}


