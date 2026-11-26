import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo (`npm run dev`) sirve /api/* con las mismas funciones que usa Vercel,
// leyendo las variables desde .env.local. En producción Vercel lo hace solo.
const RUTAS = ['chat', 'leer', 'costos'];

function apiLocal() {
  return {
    name: 'api-local',
    configureServer(server) {
      for (const ruta of RUTAS) {
        server.middlewares.use(`/api/${ruta}`, async (req, res) => {
          let raw = '';
          for await (const chunk of req) raw += chunk;
          try { req.body = JSON.parse(raw || '{}'); } catch { req.body = {}; }
          req.query = Object.fromEntries(new URL(req.originalUrl, 'http://x').searchParams);
          res.status = (c) => { res.statusCode = c; return res; };
          res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
          const { default: handler } = await server.ssrLoadModule(`/api/${ruta}.js`);
          await handler(req, res);
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return { plugins: [react(), apiLocal()] };
});
