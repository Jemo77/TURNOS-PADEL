import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: true, // permite el host del túnel de Cloudflare (cambia en cada tunnel)
    // En dev las llamadas /api salen por esta misma origin y Vite las reenvía
    // al backend local (4000). Así el frontend servido por el túnel de
    // Cloudflare llega al backend sin CORS cross-origin ni "localhost".
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
});
