import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { announceOwnerBootstrap, mountOwnerAuthRoutes } from './auth';
import { mountContentRoutes, resolveRedirect } from './content';
import { mountBoardRoutes } from './board';
import { mountGuideRoutes } from './guide';
import { isLocalReview } from './localReview';
import { mountWidgetRoutes } from './widgets';
import { mountScoreRoutes } from './scores';
import { mountContactRoutes } from './contact';
import { mountResumeAccessRoutes } from './resumeAccess';

const root = fileURLToPath(new URL('..', import.meta.url));
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '7mb' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'Mendez 95' }));
app.get('/api/review-session', (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json({ localReview: isLocalReview(req) }); });
mountOwnerAuthRoutes(app);
mountContentRoutes(app);
mountBoardRoutes(app);
mountGuideRoutes(app);
mountWidgetRoutes(app);
mountScoreRoutes(app);
mountContactRoutes(app);
mountResumeAccessRoutes(app);
app.get('/api/resolve-route', async (req, res) => {
  const path = typeof req.query.path === 'string' ? req.query.path : '';
  if (!/^\/[a-z0-9\-/]+$/.test(path)) { res.status(400).json({ error: 'Invalid route.' }); return; }
  const target = await resolveRedirect(path);
  res.json({ target: target ?? null });
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route.' }));
app.use((req, res, next) => {
  if (/^\/(?:content|content-media|server|server-assets|\.local)(?:\/|$)/.test(req.path) || /^\/\.env(?:\.|$)/.test(req.path)) {
    res.status(404).end();
    return;
  }
  next();
});

const dist = join(root, 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*path', async (req, res, next) => {
    try {
      const target = await resolveRedirect(req.path);
      if (target) { res.redirect(308, target); return; }
      res.sendFile(join(dist, 'index.html'));
    } catch (error) { next(error); }
  });
}

const port = Number(process.env.PORT || 3334);
const host = process.env.HOST || '127.0.0.1';
app.listen(port, host, () => {
  console.info(`[Mendez OS] API listening at http://${host}:${port}`);
  announceOwnerBootstrap();
});
