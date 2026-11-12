const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../config/prisma');
const { jwtSecret, jwtExpiresIn } = require('../config/env');

const loginSchema = z.object({
  email: z.string().trim().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')
});

// Nunca devolver la fila completa del usuario: la que viene de la base (req.admin)
// incluye el hash de contraseña, que no tiene por qué viajar al navegador.
function usuarioPublico(user) {
  if (!user) return null;
  return { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol };
}

async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0]?.message || 'Datos de login inválidos'
      });
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const user = await prisma.usuario.findUnique({ where: { email: normalizedEmail } });
    if (!user) return res.status(401).json({ message: 'Credenciales inválidas' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Credenciales inválidas' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.rol }, jwtSecret, {
      expiresIn: jwtExpiresIn
    });

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 8 * 60 * 60 * 1000
    });

    return res.json({ token, user: usuarioPublico(user) });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res) {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
  return res.json({ success: true });
}

async function me(req, res) {
  return res.json({ user: usuarioPublico(req.admin || req.user) });
}

module.exports = { login, logout, me };
