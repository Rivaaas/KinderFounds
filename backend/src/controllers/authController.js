const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

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
    token: generateToken(user._id),
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
  if (!(await bcrypt.compare(currentPassword, user.password)))
    return res.status(401).json({ message: 'Contraseña actual incorrecta.' });

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();
  res.json({ message: 'Contraseña actualizada correctamente.' });
};

exports.me = async (req, res) => {
  res.json({ user: req.user });
};
