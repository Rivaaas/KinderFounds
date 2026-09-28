import axios from 'axios';
import { attachSlowRequestTracking } from './slowRequest';

const baseURL = import.meta.env.VITE_API_URL || '/api';

// Tope por petición. El arranque en frío de Render tarda hasta ~60 s, así que se
// deja margen amplio; pero sin tope, una conexión estancada quedaba pendiente
// para siempre y la pantalla nunca salía del estado de espera.
const REQUEST_TIMEOUT_MS = 90000;

const api = axios.create({
  baseURL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

// Cliente separado para la consulta pública: no envía el token. Así un token
// vencido guardado en el navegador no puede afectar una consulta que no
// requiere sesión.
export const publicApi = axios.create({
  baseURL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('kc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('kc_token');
      localStorage.removeItem('kc_user');
      // Solo se redirige si el visitante estaba en una pantalla de administración.
      // La portada es pública: un token vencido no debe sacar de ahí a un apoderado.
      const ruta = window.location.pathname;
      if (ruta !== '/' && ruta !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Detección de peticiones lentas para avisar del arranque en frío de Render.
// Se aplica a ambos clientes: el arranque afecta igual al panel y a la consulta pública.
attachSlowRequestTracking(api);
attachSlowRequestTracking(publicApi);

export default api;
