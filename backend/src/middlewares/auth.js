const jwt = require('jsonwebtoken');
const { RolUsuario } = require('@prisma/client');
const { jwtSecret } = require('../config/env');
const prisma = require('../config/prisma');

function requireAuth(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

async function requireAdmin(req, res, next) {
  if (!req.user || typeof req.user.id !== 'string') {
    return res.status(401).json({ message: 'No autorizado' });
  }

  try {
    const user = await prisma.usuario.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(403).json({ message: 'Usuario no encontrado' });
    }

    // El rol se re-chequea contra la base (no contra el claim del JWT), así un token
    // ya emitido deja de valer en el momento en que el usuario pierde el rol.
    if (!Object.values(RolUsuario).includes(user.rol)) {
      return res.status(403).json({ message: 'El usuario no tiene permisos de administrador' });
    }

    req.admin = user;
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Error validando admin' });
  }
}

module.exports = { requireAuth, requireAdmin };
