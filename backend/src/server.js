const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const apiRoutes = require('./routes');
const { port, frontendUrl, cronInterno } = require('./config/env');
const errorHandler = require('./middlewares/errorHandler');
const { iniciarSchedulerInterno } = require('./jobs/scheduler');

const app = express();

// Normaliza orígenes ignorando una barra final ("/") para que un FRONTEND_URL
// con o sin slash no rompa el chequeo CORS (el navegador compara el origin exacto).
const normalizeOrigin = (value) => String(value || '').replace(/\/+$/, '');
const allowedOrigins = new Set([normalizeOrigin(frontendUrl)]);

// En desarrollo el frontend se prueba a veces a través de túneles de Cloudflare
// (trycloudflare.com), cuyo subdominio cambia en cada tunnel. Se permite
// cualquier *.trycloudflare.com para que CORS no bloquee esas pruebas.
const esTunelCloudflare = (origin) => {
  try {
    return new URL(origin).hostname.endsWith('.trycloudflare.com');
  } catch {
    return false;
  }
};

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(normalizeOrigin(origin)) || esTunelCloudflare(origin)) {
      callback(null, origin || true);
    } else {
      callback(new Error('Origen no permitido por CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use('/api', apiRoutes);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Backend corriendo en http://localhost:${port}`);
  iniciarSchedulerInterno({ habilitado: cronInterno });
});
