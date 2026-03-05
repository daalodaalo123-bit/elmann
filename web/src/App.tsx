import { Navigate, Route, Routes } from 'react-router-dom';
import { TopNav } from './components/TopNav';
import { RequireAuth } from './components/RequireAuth';
import { DashboardPage } from './pages/DashboardPage';
import { PosPage } from './pages/PosPage';
import { InventoryPage } from './pages/InventoryPage';
import { InventoryValuePage } from './pages/InventoryValuePage';
import { ReportsPage } from './pages/ReportsPage';
import { HistoryPage } from './pages/HistoryPage';
import { CustomersPage } from './pages/CustomersPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <div className='min-h-full'>
      <TopNav />
      <main className='mx-auto w-full max-w-[1200px] px-4 py-8'>
        <Routes>
          <Route path='/login' element={<LoginPage />} />

          <Route
            path='/dashboard'
            element={
              <RequireAuth roles={['owner']}>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path='/'
            element={
              <RequireAuth roles={['owner', 'cashier']}>
                <PosPage />
              </RequireAuth>
            }
          />
          <Route
            path='/inventory'
            element={
              <RequireAuth roles={['owner']}>
                <InventoryPage />
              </RequireAuth>
            }
          />
          <Route
            path='/inventory/value'
            element={
              <RequireAuth roles={['owner']}>
                <InventoryValuePage />
              </RequireAuth>
            }
          />
          <Route
            path='/reports'
            element={
              <RequireAuth roles={['owner']}>
                <ReportsPage />
              </RequireAuth>
            }
          />
          <Route
            path='/history'
            element={
              <RequireAuth roles={['owner', 'cashier']}>
                <HistoryPage />
              </RequireAuth>
            }
          />
          <Route
            path='/customers'
            element={
              <RequireAuth roles={['owner']}>
                <CustomersPage />
              </RequireAuth>
            }
          />
          <Route
            path='/expenses'
            element={
              <RequireAuth roles={['owner']}>
                <ExpensesPage />
              </RequireAuth>
            }
          />
          <Route
            path='/settings'
            element={
              <RequireAuth roles={['owner']}>
                <SettingsPage />
              </RequireAuth>
            }
          />
          <Route path='*' element={<Navigate to='/' replace />} />
        </Routes>
      </main>
    </div>
  );
}