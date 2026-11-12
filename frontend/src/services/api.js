import axios from 'axios';

// En desarrollo las llamadas al API van por la MISMA origin a través del proxy
// de Vite (relativo "/api" → http://localhost:4000). Así el frontend funciona
// también accediendo desde un túnel de Cloudflare (trycloudflare.com), sin
// problemas de CORS ni de "localhost" cuando se abre desde otro dispositivo.
// Si algún día apuntás a un backend publicado (no local), seteá VITE_API_URL en
// frontend/.env con la URL pública, ej: VITE_API_URL="https://api.tudominio.com/api".
const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

export default api;