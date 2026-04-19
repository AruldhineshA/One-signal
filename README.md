# OneSignal Push Notification Demo

A minimal Task Reminder app built to **validate** whether OneSignal push notification
failures in the Skillzen production environment are caused by **company VPN/network
restrictions** or by an implementation defect.

## Purpose

The production Skillzen stack integrates OneSignal for web push notifications
(see `OneSignal_Push_Notification_Integration_Report.md`). During development, push
notifications were not reaching users. The suspected cause is that the company VPN
blocks outbound HTTPS traffic to `api.onesignal.com`.

This standalone project replicates the **exact same push flow** as production
(frontend `OneSignal.login` + backend REST call to `api.onesignal.com/notifications`)
using the **same OneSignal application ID**, so the only variable is the network
environment.

## Architecture

```
Browser (frontend, React + Vite)
  |
  |  react-onesignal SDK
  |    - OneSignal.init(app_id)
  |    - OneSignal.login(user_id)   <-- links device to external_id
  |    - OneSignal.Notifications.requestPermission()
  |
  |  POST /api/tasks/:id/notify
  v
Backend (Node.js + Express)
  |
  |  axios.post('https://api.onesignal.com/notifications', {
  |    app_id, include_aliases: { external_id: [user_id] },
  |    target_channel: 'push', headings, contents
  |  })
  v
OneSignal REST API (api.onesignal.com)
  |
  v
Web push delivered to browser
```

## Test Matrix

Run the demo under three network conditions and record results:

| Scenario | Network | Expected | Proves |
|----------|---------|----------|--------|
| A | Mobile hotspot (no VPN)          | Push arrives | Baseline works |
| B | Company WiFi + VPN **off**       | Push arrives | Code is correct |
| C | Company WiFi + VPN **on**        | Backend gets `ETIMEDOUT` | VPN is the blocker |

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env       # fill APP_ID and REST_API_KEY
npm install
npm run dev                # runs on http://localhost:3001
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env       # fill VITE_ONESIGNAL_APP_ID
npm install
npm run dev                # runs on http://localhost:5173
```

### 3. Use the demo

1. Open http://localhost:5173 in Chrome
2. Enter a test user name (e.g. `demo_test_arul`) and click **Login**
3. Click **Enable Push** and grant browser permission
4. Open DevTools Console — verify `[OneSignal] Subscription state` shows `external_id`
   populated and `opted_in: true`
5. Create a task and click **Send Reminder**
6. A browser push notification should arrive within 1-2 seconds

## Important Notes

- **Reuses the production OneSignal app** (`6cbb5375-dae9-42c4-bbc6-21b314dc04f4`) so
  only network changes between this demo and Skillzen production.
- **Use a distinct `external_id`** (e.g. `demo_test_*`) when logging in — avoid
  polluting the production audience or triggering pushes to real users.
- Credentials live in `.env` files and are **gitignored**. Never commit them.

## Expected Evidence to Capture

1. Screenshot of push notification arriving (scenarios A and B).
2. Backend terminal log showing OneSignal `200 OK` response with notification `id`.
3. Backend terminal log showing `ETIMEDOUT` / `ECONNREFUSED` under scenario C.
4. OneSignal dashboard → Delivery tab confirming the notification was accepted.
