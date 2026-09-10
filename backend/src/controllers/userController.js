const bcrypt = require('bcryptjs');
const User = require('../models/User');

const MIN_PASSWORD = 6;

// Evita que el tesorero se deje a sí mismo fuera de la app: siempre debe quedar
// al menos un admin activo capaz de entrar.
const otherActiveAdmins = (id) =>
  User.countDocuments({ _id: { $ne: id }, role: 'admin', active: true });

exports.getAll = async (req, res) => {
  const users = await User.find().select('-password').sort({ createdAt: 1 });
  res.json(users);
};

exports.create = async (req, res) => {
  const { username, password, name, role } = req.body;

  if (!username || !password || !name)
    return res.status(400).json({ message: 'Usuario, contraseña y nombre son requeridos.' });
  if (password.length < MIN_PASSWORD)
    return res.status(400).json({ message: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` });

  const normalized = username.trim().toLowerCase();
  if (await User.findOne({ username: normalized }))
    return res.status(409).json({ message: 'Ya existe un usuario con ese nombre.' });

  const user = await User.create({
    username: normalized,
    password: await bcrypt.hash(password, 12),
    name: name.trim(),
    role: role === 'admin' ? 'admin' : 'viewer',
  });

  res.status(201).json({ id: user._id, username: user.username, name: user.name, role: user.role, active: user.active });
};

exports.update = async (req, res) => {
  const { name, role, active } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

  const losesAdmin = (role && role !== 'admin') || active === false;
  if (user.role === 'admin' && losesAdmin && !(await otherActiveAdmins(user._id)))
    return res.status(400).json({ message: 'Debe quedar al menos un administrador activo.' });

  if (name !== undefined)   user.name   = name.trim();
  if (role !== undefined)   user.role   = role === 'admin' ? 'admin' : 'viewer';
  if (active !== undefined) user.active = !!active;
  await user.save();

  res.json({ id: user._id, username: user.username, name: user.name, role: user.role, active: user.active });
};

// Reseteo por el administrador: no pide la contraseña actual, a diferencia de
// authController.changePassword, que es para la cuenta propia.
exports.resetPassword = async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < MIN_PASSWORD)
    return res.status(400).json({ message: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` });

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

  user.password = await bcrypt.hash(password, 12);
  // Resetear la clave debe cerrar de verdad las sesiones de esa cuenta: sin
  // esto, quien tuviera el token seguía entrando hasta que expirara.
  user.passwordChangedAt = new Date();
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  res.json({
    message: `Contraseña de '${user.username}' actualizada. Sus sesiones abiertas quedaron cerradas.`,
  });
};

exports.remove = async (req, res) => {
  if (req.params.id === String(req.user._id))
    return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta.' });

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

  if (user.role === 'admin' && !(await otherActiveAdmins(user._id)))
    return res.status(400).json({ message: 'Debe quedar al menos un administrador activo.' });

  await user.deleteOne();
  res.json({ message: 'Usuario eliminado.' });
};
