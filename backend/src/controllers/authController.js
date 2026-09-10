const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// El token lleva la versión de sesión del usuario: al cambiar la contraseña la
// versión sube y todos los tokens anteriores dejan de coincidir.
const generateToken = (user) =>
  jwt.sign({ id: user._id, v: user.tokenVersion || 0 }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

exports.login = async (req, res) => {
  const { username, password } = req.body;
  // El tipo se valida antes de usarlo: un objeto aquí llegaba a la consulta como
  // operador de Mongo y, además, rompía .trim() tumbando el proceso.
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password)
    return res.status(400).json({ message: 'Usuario y contraseña requeridos.' });

  const user = await User.findOne({ username: username.trim().toLowerCase() });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ message: 'Credenciales incorrectas.' });
  if (user.active === false)
    return res.status(403).json({ message: 'Tu cuenta está desactivada. Contacta al tesorero.' });

  res.json({
    token: generateToken(user),
    user: { id: user._id, username: user.username, name: user.name, role: user.role },
  });
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword)
    return res.status(400).json({ message: 'Datos incompletos.' });
  if (newPassword.length < 6)
    return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres.' });

  const user = await User.findById(req.user._id);
  // La cuenta pudo eliminarse entre protect y esta consulta.
  if (!user) return res.status(401).json({ message: 'Tu cuenta ya no existe.' });

  if (!(await bcrypt.compare(currentPassword, user.password)))
    return res.status(401).json({ message: 'Contraseña actual incorrecta.' });

  user.password = await bcrypt.hash(newPassword, 12);
  user.passwordChangedAt = new Date();
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  res.json({
    message: 'Contraseña actualizada. Las sesiones abiertas con la contraseña anterior quedaron cerradas.',
    reautenticar: true,
  });
};

exports.me = async (req, res) => {
  res.json({ user: req.user });
};
