import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo (`npm run dev`) sirve /api/chat con la misma función que usa Vercel,
// leyendo GEMINI_API_KEY desde .env.local. En producción Vercel lo hace solo.
function apiLocal() {
  return {
    name: 'api-local',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        try { req.body = JSON.parse(raw || '{}'); } catch { req.body = {}; }
        res.status = (c) => { res.statusCode = c; return res; };
        res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
        const { default: handler } = await server.ssrLoadModule('/api/chat.js');
        await handler(req, res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return { plugins: [react(), apiLocal()] };
});
