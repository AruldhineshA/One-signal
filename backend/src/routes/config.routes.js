import { Router } from 'express';
import { env } from '../config/env.js';

const router = Router();

/**
 * GET /api/push/config
 * Mirrors Skillzen's GET /notifications/push/config endpoint.
 * Returns only the public app_id (never the REST API key).
 */
router.get('/config', (_req, res) => {
    res.json({
        app_id: env.onesignal.app_id,
        enabled: env.onesignal.enabled,
    });
});

export default router;
