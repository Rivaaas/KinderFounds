const crypto = require('crypto');
const mongoose = require('mongoose');
const { MAX_AMOUNT, DUPLICATE_WINDOW_MS } = require('./constants');

// Valida un monto de dinero. Devuelve el número o un mensaje de error.
// Se rechaza el 0 porque un movimiento de $0 nunca es intencional y ensucia
// los listados sin alterar los totales, que es la peor combinación.
const parseAmount = (value, campo = 'monto') => {
  if (value === undefined || value === null || value === '')
    return { error: `El ${campo} es requerido.` };

  const n = typeof value === 'number' ? value : Number(value);
  if (typeof value === 'object' || Number.isNaN(n) || !Number.isFinite(n))
    return { error: `El ${campo} debe ser un número válido.` };
  if (n <= 0)
    return { error: `El ${campo} debe ser mayor a 0.` };
  if (n > MAX_AMOUNT)
    return { error: `El ${campo} no puede superar $${MAX_AMOUNT.toLocaleString('es-CL')}.` };

  return { value: Math.round(n) };
};

// Valida una fecha opcional. Una fecha inválida silenciosa desordena todos los
// reportes por rango, así que se rechaza en vez de guardarse como Invalid Date.
const parseDate = (value, campo = 'fecha') => {
  if (value === undefined || value === null || value === '') return { value: undefined };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { error: `La ${campo} enviada no es válida.` };

  const año = d.getFullYear();
  if (año < 2000 || año > 2100)
    return { error: `La ${campo} debe estar entre los años 2000 y 2100.` };

  return { value: d };
};

// Solo acepta texto plano: bloquea el paso de objetos ({ $ne: ... }) a las consultas.
const parseText = (value, campo, { required = false, max = 300 } = {}) => {
  if (value === undefined || value === null || value === '') {
    return required ? { error: `El campo ${campo} es requerido.` } : { value: undefined };
  }
  if (typeof value !== 'string') return { error: `El campo ${campo} debe ser texto.` };
  const t = value.trim();
  if (required && !t) return { error: `El campo ${campo} es requerido.` };
  if (t.length > max) return { error: `El campo ${campo} no puede superar ${max} caracteres.` };
  return { value: t };
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);

// Comprueba que una referencia exista antes de guardarla: sin esto quedan
// registros apuntando a alumnos o actividades que no existen.
const referenceExists = async (Model, id, campo) => {
  if (id === undefined || id === null || id === '') return { value: undefined };
  if (!isValidId(id)) return { error: `El ${campo} seleccionado no es válido.` };
  const existe = await Model.exists({ _id: id });
  if (!existe) return { error: `El ${campo} seleccionado no existe.` };
  return { value: id };
};

// Detecta un envío repetido del mismo formulario (doble click o reintento de red).
// Se limita a una ventana corta para no bloquear registros legítimamente iguales.
const isDuplicateSubmission = async (Model, criterio) => {
  const desde = new Date(Date.now() - DUPLICATE_WINDOW_MS);
  return Model.exists({ ...criterio, createdAt: { $gte: desde } });
};

// Huella de un envío: identifica el mismo formulario enviado dos veces dentro de
// una misma franja de tiempo. Consultar antes de insertar no basta, porque dos
// peticiones simultáneas hacen la consulta antes de que ninguna haya escrito;
// solo un índice único convierte la detección en atómica.
const buildDedupeKey = (modelo, partes) => {
  const franja = Math.floor(Date.now() / DUPLICATE_WINDOW_MS);
  const texto = [modelo, franja, ...partes.map((p) => (p === undefined || p === null ? '' : String(p)))].join('|');
  return crypto.createHash('sha1').update(texto).digest('hex');
};

// Crea un documento rechazando el envío duplicado con un mensaje claro.
// Combina las dos defensas: la consulta previa cubre el reenvío secuencial y el
// índice único cubre el simultáneo.
const createDeduplicated = async (Model, doc, { criterio, huella, mensaje }) => {
  if (criterio && await isDuplicateSubmission(Model, criterio)) {
    return { duplicate: true, message: mensaje };
  }
  try {
    return { doc: await Model.create({ ...doc, dedupeKey: buildDedupeKey(Model.modelName, huella) }) };
  } catch (err) {
    if (err.code === 11000 && err.keyPattern && err.keyPattern.dedupeKey) {
      return { duplicate: true, message: mensaje };
    }
    throw err;
  }
};

module.exports = {
  parseAmount, parseDate, parseText, isValidId, referenceExists,
  isDuplicateSubmission, buildDedupeKey, createDeduplicated,
};
