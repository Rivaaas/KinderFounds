const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'No autorizado, token requerido.' });
  }

  try {
    // Se fija el algoritmo esperado: sin esto, la verificación acepta cualquiera
    // de los que el token declare, y la cabecera del token la controla el cliente.
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ message: 'Usuario no encontrado.' });
    if (req.user.active === false)
      return res.status(401).json({ message: 'Tu cuenta está desactivada.' });
    next();
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado.' });
  }
};

// Los perfiles 'viewer' solo consultan: cualquier operación que modifique datos
// queda reservada a 'admin'. Se aplica en las rutas POST/PUT/DELETE.
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ message: 'Tu perfil es de solo lectura.' });
  next();
};

module.exports = { protect, requireAdmin };
