import axios from 'axios';
import { env } from '../config/env.js';

/**
 * OneSignalPushService
 *
 * Mirrors the production Skillzen SDK service at:
 *   sdk/src/modules/notification-srv/services/classes/OneSignalPushService.ts
 *
 * Responsibilities:
 *   - Build the OneSignal REST API request body (v2 API with external_id targeting)
 *   - POST to https://api.onesignal.com/notifications
 *   - Return a structured result; never throw to the caller
 *
 * This is the single network hop that fails under company VPN. If this request
 * succeeds outside VPN and fails inside, VPN is conclusively the blocker.
 */

const ONESIGNAL_API_URL = 'https://api.onesignal.com/notifications';
const MAX_EXTERNAL_IDS_PER_REQUEST = 2000;

class OneSignalPushService {
    static _instance = null;

    static get Instance() {
        if (!this._instance) {
            this._instance = new OneSignalPushService();
        }
        return this._instance;
    }

    getConfig() {
        if (!env.onesignal.enabled) {
            console.warn('[OneSignal] Push disabled via ONESIGNAL_ENABLED=false');
            return null;
        }
        if (!env.onesignal.app_id || !env.onesignal.rest_api_key) {
            console.warn('[OneSignal] Missing app_id or rest_api_key');
            return null;
        }
        return {
            app_id: env.onesignal.app_id,
            rest_api_key: env.onesignal.rest_api_key,
        };
    }

    async sendPush(payload) {
        const config = this.getConfig();
        if (!config) {
            return { success: false, errors: ['onesignal_not_configured'] };
        }

        const { user_ids } = payload;
        if (!Array.isArray(user_ids) || user_ids.length === 0) {
            return { success: false, errors: ['no_recipients'] };
        }

        if (user_ids.length <= MAX_EXTERNAL_IDS_PER_REQUEST) {
            return this.sendSingleRequest(config, payload);
        }
        return this.sendPushBatched(config, payload);
    }

    async sendSingleRequest(config, payload) {
        const body = {
            app_id: config.app_id,
            include_aliases: { external_id: payload.user_ids },
            target_channel: 'push',
            headings: { en: payload.title },
            contents: { en: payload.message },
        };

        if (payload.action_url) {
            body.url = payload.action_url;
        }
        if (payload.data) {
            body.data = payload.data;
        }

        const started_at = Date.now();
        try {
            const response = await axios.post(ONESIGNAL_API_URL, body, {
                headers: {
                    Authorization: `Key ${config.rest_api_key}`,
                    'Content-Type': 'application/json',
                },
                timeout: 10000,
            });

            const duration_ms = Date.now() - started_at;

            if (response.data?.id) {
                console.log('[OneSignal] Push queued', {
                    onesignal_id: response.data.id,
                    recipients: response.data.recipients ?? payload.user_ids.length,
                    duration_ms,
                });
                return {
                    success: true,
                    onesignal_id: response.data.id,
                    recipients_count: response.data.recipients ?? payload.user_ids.length,
                };
            }

            console.warn('[OneSignal] No notification id in response', response.data);
            return { success: false, errors: ['no_notification_id'] };
        } catch (error) {
            const duration_ms = Date.now() - started_at;
            const err_info = {
                code: error.code,
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                duration_ms,
            };
            console.error('[OneSignal] Push API call failed', err_info);
            return {
                success: false,
                errors: [error.code || error.message || 'unknown_error'],
                details: err_info,
            };
        }
    }

    async sendPushBatched(config, payload) {
        const batches = [];
        for (let i = 0; i < payload.user_ids.length; i += MAX_EXTERNAL_IDS_PER_REQUEST) {
            batches.push(payload.user_ids.slice(i, i + MAX_EXTERNAL_IDS_PER_REQUEST));
        }

        let any_success = false;
        let total_recipients = 0;
        const errors = [];

        for (const batch of batches) {
            const result = await this.sendSingleRequest(config, { ...payload, user_ids: batch });
            if (result.success) {
                any_success = true;
                total_recipients += result.recipients_count ?? 0;
            } else if (result.errors) {
                errors.push(...result.errors);
            }
        }

        return {
            success: any_success,
            recipients_count: total_recipients,
            errors: errors.length > 0 ? errors : undefined,
        };
    }
}

export default OneSignalPushService;
