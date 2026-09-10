import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(() => JSON.parse(localStorage.getItem('kc_user') || 'null'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('kc_token');
    if (!token) { setLoading(false); return; }
    api.get('/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('kc_token', data.token);
    localStorage.setItem('kc_user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('kc_token');
    localStorage.removeItem('kc_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user, login, logout, loading,
      isAuthenticated: !!user,
      // Los perfiles 'viewer' solo consultan; el backend rechaza sus escrituras
      // y la UI oculta las acciones para no ofrecer lo que va a fallar.
      isAdmin: user?.role === 'admin',
      canWrite: user?.role === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
