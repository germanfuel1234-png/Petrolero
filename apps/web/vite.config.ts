import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // @petrolero/shared emite CommonJS (lo necesita NestJS) y es un paquete enlazado del
    // workspace, así que Vite no lo pre-empaqueta por defecto y los named exports quedan
    // invisibles para el navegador. Forzando su inclusión, esbuild lo convierte a ESM.
    include: ['@petrolero/shared'],
  },
  build: {
    commonjsOptions: {
      // Mismo motivo que arriba, para el build de producción.
      include: [/packages\/shared/, /node_modules/],
    },
  },
  server: {
    port: 5173,
    proxy: {
      // El frontend llama a /api y Vite lo redirige a NestJS: así no hay CORS en desarrollo
      // y la URL de la API es la misma en dev y en producción.
      // El puerto de la API se toma de VITE_API_URL para poder moverlo sin tocar código:
      // el 3000 suele estar ocupado por otros proyectos.
      '/api': {
        target: process.env.VITE_API_URL ?? 'http://localhost:3100',
        changeOrigin: true,
      },
    },
  },
});
