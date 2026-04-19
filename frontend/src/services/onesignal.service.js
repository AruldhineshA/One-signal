import OneSignal from 'react-onesignal';

/**
 * OneSignal Web SDK wrapper.
 *
 * Ports the production Skillzen frontend service at:
 *   admin-dashboard-v2/src/services/onesignal.service.ts
 *
 * Differences from production:
 *   - No ONESIGNAL_ALLOWED_HOSTS guard (demo runs on localhost / any hostname)
 *   - Plain JavaScript instead of TypeScript
 *
 * Flow:
 *   1. init(app_id)                       -> registers service worker, boots SDK
 *   2. login(user_id)                     -> links this browser to the Skillzen user_id
 *                                            via OneSignal external_id
 *   3. requestPermission()                -> triggers native browser permission prompt
 *   4. Backend POSTs to api.onesignal.com with include_aliases.external_id = [user_id]
 *   5. OneSignal pushes to every device where login(user_id) was called and permission granted
 */
class OneSignalService {
    constructor() {
        this.is_initialized = false;
        this.is_initializing = false;
    }

    async init(app_id) {
        if (this.is_initialized || this.is_initializing) {
            return this.is_initialized;
        }
        if (!app_id) {
            console.warn('[OneSignal] No app_id provided, skipping init');
            return false;
        }

        this.is_initializing = true;
        try {
            await OneSignal.init({
                appId: app_id,
                allowLocalhostAsSecureOrigin: true,
                serviceWorkerParam: { scope: '/' },
                serviceWorkerPath: '/OneSignalSDKWorker.js',
                notifyButton: { enable: false },
            });
            this.is_initialized = true;
            console.log('[OneSignal] Initialized successfully');
            return true;
        } catch (error) {
            if (error?.message?.includes('already initialized')) {
                this.is_initialized = true;
                return true;
            }
            console.error('[OneSignal] Init failed:', error);
            return false;
        } finally {
            this.is_initializing = false;
        }
    }

    async login(user_id) {
        if (!this.is_initialized) {
            console.warn('[OneSignal] Not initialized, skipping login');
            return false;
        }
        if (!user_id) {
            console.warn('[OneSignal] No user_id provided, skipping login');
            return false;
        }
        try {
            await OneSignal.login(user_id);
            console.log('[OneSignal] User logged in:', user_id);
            this.logSubscriptionState();
            return true;
        } catch (error) {
            console.error('[OneSignal] Login failed:', error);
            return false;
        }
    }

    async logout() {
        if (!this.is_initialized) return;
        try {
            await OneSignal.logout();
            console.log('[OneSignal] User logged out');
        } catch (error) {
            console.error('[OneSignal] Logout failed:', error);
        }
    }

    async requestPermission() {
        if (!this.is_initialized) {
            console.warn('[OneSignal] Not initialized, cannot request permission');
            return false;
        }
        try {
            await OneSignal.Notifications.requestPermission();
            const granted = OneSignal.Notifications.permission;
            console.log('[OneSignal] Permission result:', granted);
            if (granted) {
                await this.ensureSubscription();
            }
            return granted;
        } catch (error) {
            console.error('[OneSignal] Permission request failed:', error);
            return false;
        }
    }

    async ensureSubscription() {
        try {
            const opted_in = OneSignal.User.PushSubscription.optedIn;
            console.log('[OneSignal] Push subscription optedIn:', opted_in);
            if (!opted_in) {
                console.log('[OneSignal] Re-opting in to push subscription...');
                await OneSignal.User.PushSubscription.optIn();
            }
            this.logSubscriptionState();
        } catch (error) {
            console.error('[OneSignal] ensureSubscription failed:', error);
        }
    }

    logSubscriptionState() {
        try {
            const sub_id = OneSignal.User.PushSubscription.id;
            const token = OneSignal.User.PushSubscription.token;
            const opted_in = OneSignal.User.PushSubscription.optedIn;
            const external_id = OneSignal.User.externalId;
            const onesignal_id = OneSignal.User.onesignalId;
            const permission = OneSignal.Notifications.permission;

            console.log('[OneSignal] Subscription state:', {
                subscription_id: sub_id || 'none',
                token: token ? `${token.substring(0, 20)}...` : 'none',
                opted_in,
                external_id: external_id || 'none',
                onesignal_id: onesignal_id || 'none',
                permission,
            });
        } catch (error) {
            console.warn('[OneSignal] Could not read subscription state:', error);
        }
    }

    getPermissionStatus() {
        if (!this.is_initialized) return false;
        return OneSignal.Notifications.permission;
    }

    isReady() {
        return this.is_initialized;
    }

    onForegroundWillDisplay(handler) {
        console.log("#####3333",handler)
        if (!this.is_initialized) return;
        console.log("this.is_initialized",this.is_initialized)
        OneSignal.Notifications.addEventListener('foregroundWillDisplay', handler);
    }

    onNotificationClick(handler) {
        if (!this.is_initialized) return;
        OneSignal.Notifications.addEventListener('click', handler);
    }
}

export const oneSignalService = new OneSignalService();
