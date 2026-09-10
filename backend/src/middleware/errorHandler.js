const errorHandler = (err, req, res, next) => {
  // Se registra siempre el error real; al cliente solo se le devuelve lo necesario.
  console.error(`[${req.method} ${req.originalUrl}]`, err.message);
  if (process.env.NODE_ENV !== 'production') console.error(err.stack);

  // Validaciones de esquema (campo requerido, valor fuera del enum, tipo incorrecto).
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(', ') });
  }

  // ID con formato inválido o monto no numérico: es un error del cliente, no del servidor.
  if (err.name === 'CastError') {
    const campo = err.path === '_id' ? 'identificador' : err.path;
    return res.status(400).json({ message: `El valor enviado en '${campo}' no es válido.` });
  }

  // Índice único violado.
  if (err.code === 11000) {
    const campo = Object.keys(err.keyPattern || {}).join(', ');
    return res.status(409).json({
      message: campo ? `Ya existe un registro con ese ${campo}.` : 'El registro ya existe.',
    });
  }

  // JSON malformado en el body (lo lanza express.json()).
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ message: 'El contenido enviado no es JSON válido.' });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'El contenido enviado es demasiado grande.' });
  }

  const status = err.statusCode || 500;
  res.status(status).json({
    // Un 500 no debe filtrar detalles internos al cliente.
    message: status === 500 ? 'Error interno del servidor.' : err.message,
  });
};

module.exports = errorHandler;
