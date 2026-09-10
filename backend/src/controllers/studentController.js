const Student = require('../models/Student');
const Payment = require('../models/Payment');
const PettyCash = require('../models/PettyCash');
const { parseText } = require('../utils/validation');

// Escapa el texto para usarlo en una búsqueda exacta sin distinguir mayúsculas.
const exacto = (texto) => new RegExp(`^${texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

exports.getAll = async (req, res) => {
  const filter = {};
  if (typeof req.query.status === 'string' && req.query.status) filter.status = req.query.status;
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
  const nombre = parseText(req.body.name, 'nombre', { required: true, max: 120 });
  if (nombre.error) return res.status(400).json({ message: nombre.error });

  // Dos alumnos con el mismo nombre en un curso de 20 casi siempre es un registro
  // repetido, y duplicar al alumno duplica también sus cuotas y su deuda.
  if (await Student.findOne({ name: exacto(nombre.value) }))
    return res.status(409).json({ message: `Ya existe un alumno llamado "${nombre.value}".` });

  const student = await Student.create({ name: nombre.value, status: req.body.status });
  res.status(201).json(student);
};

exports.update = async (req, res) => {
  const cambios = {};

  if (req.body.name !== undefined) {
    const nombre = parseText(req.body.name, 'nombre', { required: true, max: 120 });
    if (nombre.error) return res.status(400).json({ message: nombre.error });

    const otro = await Student.findOne({ name: exacto(nombre.value), _id: { $ne: req.params.id } });
    if (otro) return res.status(409).json({ message: `Ya existe otro alumno llamado "${nombre.value}".` });
    cambios.name = nombre.value;
  }
  if (req.body.status !== undefined) cambios.status = req.body.status;

  const student = await Student.findByIdAndUpdate(req.params.id, cambios, { new: true, runValidators: true });
  if (!student) return res.status(404).json({ message: 'Estudiante no encontrado.' });
  res.json(student);
};

// Baja lógica cuando el alumno tiene historial financiero.
//
// Borrarlo dejaba sus pagos apuntando a un alumno inexistente: el dinero seguía
// sumando en los totales pero ya no se podía saber de quién era. Con historial se
// marca inactivo (deja de recibir cuotas nuevas y conserva su historial);
// sin historial se elimina de verdad, que es el caso de un alta equivocada.
exports.remove = async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ message: 'Estudiante no encontrado.' });

  const [pagos, movimientos] = await Promise.all([
    Payment.countDocuments({ student: student._id }),
    PettyCash.countDocuments({ student: student._id }),
  ]);

  if (pagos > 0 || movimientos > 0) {
    if (student.status === 'inactive')
      return res.status(409).json({
        message: `${student.name} ya está inactivo y tiene ${pagos + movimientos} movimientos asociados. ` +
                 'No se puede eliminar sin borrar antes su historial financiero.',
      });

    student.status = 'inactive';
    await student.save();
    return res.json({
      message: `${student.name} tiene ${pagos + movimientos} movimientos registrados, así que se marcó como inactivo ` +
               'en lugar de eliminarlo. Deja de recibir cuotas nuevas y conserva su historial.',
      student,
      softDeleted: true,
    });
  }

  await student.deleteOne();
  res.json({ message: 'Estudiante eliminado.', softDeleted: false });
};
