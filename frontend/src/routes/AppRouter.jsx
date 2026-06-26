import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout/Layout';
import Login       from '../pages/Login';
import Dashboard   from '../pages/Dashboard';
import Students    from '../pages/Students';
import Payments    from '../pages/Payments';
import Expenses    from '../pages/Expenses';
import Activities  from '../pages/Activities';
import PettyCash   from '../pages/PettyCash';
import Reports     from '../pages/Reports';
import Statistics  from '../pages/Statistics';
import Discounts   from '../pages/Discounts';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-white/50">Cargando...</div>;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"   element={<Dashboard />} />
          <Route path="students"    element={<Students />} />
          <Route path="payments"    element={<Payments />} />
          <Route path="expenses"    element={<Expenses />} />
          <Route path="discounts"   element={<Discounts />} />
          <Route path="activities"  element={<Activities />} />
          <Route path="petty-cash"  element={<PettyCash />} />
          <Route path="reports"     element={<Reports />} />
          <Route path="statistics"  element={<Statistics />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
