const Student = require('../models/Student');
const Payment = require('../models/Payment');

exports.getAll = async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const students = await Student.find(filter).sort({ name: 1 });
  res.json(students);
};

exports.getOne = async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ message: 'Estudiante no encontrado.' });

  const payments = await Payment.find({ student: student._id }).sort({ date: -1 });
  res.json({ student, payments });
};

exports.create = async (req, res) => {
  const { name, status } = req.body;
  if (!name) return res.status(400).json({ message: 'El nombre del estudiante es requerido.' });

  const student = await Student.create({ name, status });
  res.status(201).json(student);
};

exports.update = async (req, res) => {
  const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!student) return res.status(404).json({ message: 'Estudiante no encontrado.' });
  res.json(student);
};

exports.remove = async (req, res) => {
  const student = await Student.findByIdAndDelete(req.params.id);
  if (!student) return res.status(404).json({ message: 'Estudiante no encontrado.' });
  res.json({ message: 'Estudiante eliminado.' });
};
