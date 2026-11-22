import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [{
    name: 'deny-private-project-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        let path = (req.url || '/').split('?')[0] || '/';
        try {
          for (let pass = 0; pass < 4; pass++) {
            const decoded = decodeURIComponent(path);
            if (decoded === path) break;
            path = decoded;
          }
          path = new URL(path, 'http://localhost').pathname;
        } catch { res.statusCode = 400; res.end('Bad path'); return; }
        // Vite also serves paths containing dot segments and /@fs. Normalize
        // before checking every segment, while allowing API endpoints such as
        // /api/content to reach the authenticated Express boundary.
        const apiPath = path.startsWith('/api/');
        const privateRoot = /^\/(?:content|content-media|\.local|server|server-assets)(?:\/|$)/.test(path)
          || /^\/@fs\/.*\/mendez-os\/(?:content|content-media|\.local|server|server-assets)(?:\/|$)/.test(path);
        const environmentRoot = /^\/\.env(?:\.|$)/.test(path)
          || /^\/@fs\/.*\/mendez-os\/\.env(?:\.|$)/.test(path);
        const privatePath = !apiPath && privateRoot;
        const environmentPath = !apiPath && environmentRoot;
        if (privatePath || environmentPath) {
          res.statusCode = 403;
          res.end('Private project file');
          return;
        }
        next();
      });
    },
  }, react()],
  server: { proxy: { '/api': 'http://127.0.0.1:3334', '/media': 'http://127.0.0.1:3334' } },
  build: { outDir: 'dist' },
});
