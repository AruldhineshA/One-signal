import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key) {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required env var: ${key}`);
    }
    return value;
}

export const env = {
    port: Number(process.env.PORT) || 3001,
    frontend_origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    onesignal: {
        app_id: requireEnv('ONESIGNAL_APP_ID'),
        rest_api_key: requireEnv('ONESIGNAL_REST_API_KEY'),
        enabled: (process.env.ONESIGNAL_ENABLED || 'true').toLowerCase() === 'true',
    },
};
