import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout/Layout';
import Consulta    from '../pages/Consulta';
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
import Users       from '../pages/Users';
import Fines       from '../pages/Fines';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400 dark:text-slate-500">Cargando...</div>;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// La gestión de perfiles solo existe para admin; un viewer que escriba la URL
// a mano vuelve al dashboard.
const AdminRoute = ({ children }) => {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/dashboard" replace />;
};

// Quien ya tiene sesión no necesita ver el formulario otra vez.
const LoginRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400 dark:text-slate-500">Cargando...</div>;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />;
};

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Portada pública: consulta de estado de cuenta sin iniciar sesión. */}
        <Route path="/" element={<Consulta />} />
        <Route path="/login" element={<LoginRoute />} />

        {/* Administración: ruta sin path propio que envuelve todo lo protegido. */}
        <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route path="/dashboard"   element={<Dashboard />} />
          <Route path="/students"    element={<Students />} />
          <Route path="/payments"    element={<Payments />} />
          <Route path="/expenses"    element={<Expenses />} />
          <Route path="/discounts"   element={<Discounts />} />
          <Route path="/activities"  element={<Activities />} />
          <Route path="/fines"       element={<Fines />} />
          <Route path="/petty-cash"  element={<PettyCash />} />
          <Route path="/reports"     element={<Reports />} />
          <Route path="/statistics"  element={<Statistics />} />
          <Route path="/users"       element={<AdminRoute><Users /></AdminRoute>} />
        </Route>

        {/* Cualquier otra dirección vuelve a la portada pública. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
