import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import { Lock, User, Eye, EyeOff, Sun, Moon, ArrowLeft } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const { login }  = useAuth();
  const { dark, toggle } = useTheme();
  const navigate   = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Completa todos los campos.');
      return;
    }
    setLoading(true);
    try {
      await login(username, password);
      toast.success('¡Bienvenido!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Credenciales incorrectas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-kinder-sky dark:bg-kinder-dark flex items-center justify-center p-4 relative overflow-hidden">

      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-kinder-blue/10 dark:bg-kinder-blue/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-kinder-lavender/10 dark:bg-kinder-lavender/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-40 h-40 bg-kinder-yellow/10 rounded-full blur-2xl" />
        <div className="absolute text-8xl opacity-5 select-none top-10 left-10 rotate-12">🎒</div>
        <div className="absolute text-6xl opacity-5 select-none bottom-20 right-10 -rotate-12">⭐</div>
        <div className="absolute text-5xl opacity-5 select-none top-1/2 left-8">🎨</div>
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggle}
        className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-gray-400 dark:text-yellow-400 hover:scale-110 transition-all"
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="relative w-full max-w-sm animate-fadeIn">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4 animate-bounce">🎒</div>
          <h1 className="text-4xl font-extrabold text-kinder-blue tracking-tight">
            KINDER<span className="text-kinder-yellow">FUNDS</span>
          </h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-2 font-medium">
            Finanzas del Curso ✨
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-kinder-card rounded-3xl shadow-xl dark:shadow-card-dark border border-gray-100 dark:border-kinder-border p-8">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-6 text-center">
            Iniciar sesión
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-slate-400 mb-1.5">
                Usuario
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="input-field pl-10"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-slate-400 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-10 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full py-3 mt-2 text-base shadow-glow-yellow"
              disabled={loading}
            >
              {loading ? '⏳ Ingresando...' : '🚀 Ingresar'}
            </button>
          </form>

        </div>

        {/* El login ya no es la portada: hay que poder volver a la consulta pública. */}
        <Link
          to="/"
          className="mt-6 flex items-center justify-center gap-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-kinder-blue transition-colors"
        >
          <ArrowLeft size={14} /> Volver a la consulta de estudiantes
        </Link>

        <p className="text-center text-xs text-gray-400 dark:text-slate-600 mt-4">
          KINDERFOUNDS © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
