const crypto = require('crypto');
const { mpTokenEncryptionKey } = require('../config/env');

// Cifrado de credenciales de la cuenta de Mercado Pago del club.
// Regla: access_token y refresh_token se guardan SIEMPRE cifrados en la base de
// datos (nunca en texto plano). Se usa AES-256-GCM y la clave de 32 bytes se
// deriva con scryptSync a partir de MP_TOKEN_ENCRYPTION_KEY, así no importa la
// longitud exacta de la env var.
// Formato de guardado (un solo string): `${iv}.${authTag}.${cifrado}` en base64.

const ALGORITHM = 'aes-256-gcm';
const SALT = 'turnos-padel-token-cifrado';

function derivarClave() {
  return crypto.scryptSync(String(mpTokenEncryptionKey || ''), SALT, 32);
}

function encriptar(texto) {
  const clave = derivarClave();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, clave, iv);
  const cifrado = Buffer.concat([cipher.update(String(texto), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${cifrado.toString('base64')}`;
}

function desencriptar(valor) {
  if (typeof valor !== 'string' || !valor) return valor;

  const partes = valor.split('.');
  if (partes.length !== 3) return valor; // dato viejo guardado sin cifrar: se devuelve tal cual

  const [ivB64, authTagB64, cifradoB64] = partes;
  try {
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const cifrado = Buffer.from(cifradoB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, derivarClave(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString('utf8');
  } catch (error) {
    // Si no se puede desencriptar (clave distinta o dato corrupto), se devuelve
    // el valor original en vez de explotar.
    return valor;
  }
}

module.exports = { encriptar, desencriptar };