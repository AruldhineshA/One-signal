import express from 'express';
import cors from 'cors';
import { env } from './src/config/env.js';
import configRoutes from './src/routes/config.routes.js';
import taskRoutes from './src/routes/task.routes.js';

const app = express();

app.use(cors({ origin: env.frontend_origin, credentials: true }));
app.use(express.json({ limit: '100kb' }));

app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/push', configRoutes);
app.use('/api/tasks', taskRoutes);

app.use((_req, res) => {
    res.status(404).json({ success: false, errors: ['route_not_found'] });
});

app.use((err, _req, res, _next) => {
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({ success: false, errors: ['internal_server_error'] });
});

app.listen(env.port, () => {
    console.log(`[Server] OneSignal demo backend listening on http://localhost:${env.port}`);
    console.log(`[Server] OneSignal app_id: ${env.onesignal.app_id}`);
    console.log(`[Server] OneSignal enabled: ${env.onesignal.enabled}`);
    console.log(`[Server] Frontend origin allowed: ${env.frontend_origin}`);
});
