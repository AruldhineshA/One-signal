import { useEffect, useState } from 'react';
import { oneSignalService } from './services/onesignal.service.js';
import { api } from './api/client.js';

const LOCAL_STORAGE_USER_KEY = 'onesignal_demo_user_id';

export default function App() {
    const [sdk_ready, setSdkReady] = useState(false);
    const [user_id, setUserId] = useState(() => localStorage.getItem(LOCAL_STORAGE_USER_KEY) || '');
    const [user_input, setUserInput] = useState('');
    const [permission_granted, setPermissionGranted] = useState(false);
    const [tasks, setTasks] = useState([]);
    const [task_input, setTaskInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [log, setLog] = useState('');

    function appendLog(line) {
        const stamp = new Date().toLocaleTimeString();
        setLog((prev) => `${prev}[${stamp}] ${line}\n`);
    }

    useEffect(() => {
        (async () => {
            try {
                const config = await api.getPushConfig();
                console.log("config",config)
                appendLog(`Fetched push config: app_id=${config.app_id}`);
                const ok = await oneSignalService.init(config.app_id);
                console.log("ok",ok)
                  console.log("sdk_ready",sdk_ready)
                setSdkReady(ok);
                appendLog(ok ? 'OneSignal SDK initialized' : 'OneSignal SDK init failed');
                if (ok) {
                    setPermissionGranted(oneSignalService.getPermissionStatus());
                    console.log("setPermissionGranted",permission_granted)
                    oneSignalService.onForegroundWillDisplay((event) => {
                        console.log("******",event)
                        const title = event.notification?.title || '(no title)';
                        console.log("title",title)
                        const body = event.notification?.body || '(no body)';
                        appendLog(`[FG] Notification received: "${title}" - "${body}"`);
                        event.notification.display();
                    });

                    oneSignalService.onNotificationClick((event) => {
                        console.log("event",event)
                        const title = event.notification?.title || '(no title)';
                        console.log("title",title)
                        appendLog(`[CLICK] User clicked notification: "${title}"`);
                    });
                }
            } catch (error) {
                appendLog(`Init error: ${error.message}`);
            }
        })();
    }, []);

    useEffect(() => {
        console.log("======================")
         console.log("user_id",user_id)
        if (!sdk_ready || !user_id) return;
        (async () => {
            const ok = await oneSignalService.login(user_id);
            appendLog(ok ? `Logged in as external_id=${user_id}` : 'Login failed');
            await refreshTasks(user_id);
        })();
    }, [sdk_ready, user_id]);

    async function refreshTasks(uid) {
        const res = await api.listTasks(uid);
        setTasks(res.data || []);
    }

    async function handleLogin() {
        const trimmed = user_input.trim();
        if (!trimmed) return;
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, trimmed);
        setUserId(trimmed);
        setUserInput('');
    }

    async function handleLogout() {
        await oneSignalService.logout();
        localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
        setUserId('');
        setTasks([]);
        appendLog('Logged out');
    }

    async function handleRequestPermission() {
        setBusy(true);
        try {
            const granted = await oneSignalService.requestPermission();
            setPermissionGranted(granted);
            appendLog(granted ? 'Push permission granted' : 'Push permission NOT granted');
        } finally {
            setBusy(false);
        }
    }

    async function handleCreateTask(e) {
        e.preventDefault();
        const title = task_input.trim();
        if (!title || !user_id) return;
        setBusy(true);
        try {
            await api.createTask(title, user_id);
            setTaskInput('');
            await refreshTasks(user_id);
            appendLog(`Task created: "${title}"`);
        } catch (error) {
            appendLog(`Create task failed: ${error.message}`);
        } finally {
            setBusy(false);
        }
    }

    async function handleNotify(task_id, title) {
        setBusy(true);
        try {
            const res = await api.notifyTask(task_id);
            if (res.success) {
                appendLog(`Push queued for "${title}" -> onesignal_id=${res.onesignal_id}`);
            } else {
                appendLog(`Push FAILED for "${title}": ${JSON.stringify(res.errors)}`);
            }
            await refreshTasks(user_id);
        } catch (error) {
            if (error.status === 404) {
                appendLog(`Task not found on backend (stale state - backend likely restarted). Refresh browser.`);
            } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
                appendLog(`Network error (possibly VPN blocking): ${error.message}`);
            } else {
                appendLog(`Notify error: ${error.message}`);
            }
        } finally {
            setBusy(false);
        }
    }

    async function handleDelete(task_id) {
        await api.deleteTask(task_id);
        await refreshTasks(user_id);
    }

    return (
        <div className="app">
            <h1>OneSignal Task Reminder Demo</h1>
            <p className="subtitle">
                Minimal reproduction of Skillzen&apos;s push flow. Use this to validate whether company VPN
                blocks <code>api.onesignal.com</code>.
            </p>

            <section className="card">
                <h2>1. User</h2>
                {user_id ? (
                    <>
                        <div className="status ok">Logged in as external_id: {user_id}</div>
                        <div className="row">
                            <button className="secondary" onClick={handleLogout} disabled={busy}>
                                Logout
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="status warn">
                            Not logged in. Enter a unique test user id (e.g. <code>demo_test_arul</code>).
                        </div>
                        <div className="row">
                            <input
                                type="text"
                                placeholder="Enter user id / external_id"
                                value={user_input}
                                onChange={(e) => setUserInput(e.target.value)}
                                disabled={!sdk_ready}
                            />
                            <button onClick={handleLogin} disabled={!sdk_ready || !user_input.trim()}>
                                Login
                            </button>
                        </div>
                    </>
                )}
            </section>

            <section className="card">
                <h2>2. Browser Push Permission</h2>
                <div className={`status ${permission_granted ? 'ok' : 'warn'}`}>
                    {permission_granted ? 'Permission granted' : 'Permission NOT granted yet'}
                </div>
                <div className="row">
                    <button
                        onClick={handleRequestPermission}
                        disabled={!sdk_ready || !user_id || busy || permission_granted}
                    >
                        Enable Push
                    </button>
                </div>
            </section>

            <section className="card">
                <h2>3. Tasks</h2>
                <form className="row" onSubmit={handleCreateTask} style={{ marginBottom: 12 }}>
                    <input
                        type="text"
                        placeholder="Task title (e.g. Buy groceries at 6PM)"
                        value={task_input}
                        onChange={(e) => setTaskInput(e.target.value)}
                        disabled={!user_id || busy}
                    />
                    <button type="submit" disabled={!user_id || !task_input.trim() || busy}>
                        Add Task
                    </button>
                </form>

                {tasks.length === 0 ? (
                    <div className="status">No tasks yet.</div>
                ) : (
                    <ul className="task-list">
                        {tasks.map((t) => (
                            <li className="task-item" key={t.id}>
                                <div style={{ flex: 1 }}>
                                    <div className="task-title">{t.title}</div>
                                    <div className="task-meta">
                                        Created {new Date(t.created_at).toLocaleString()}
                                        {t.last_notified_at
                                            ? ` - Last notified ${new Date(t.last_notified_at).toLocaleString()}`
                                            : ''}
                                    </div>
                                </div>
                                <button onClick={() => handleNotify(t.id, t.title)} disabled={busy}>
                                    Send Reminder
                                </button>
                                <button className="danger" onClick={() => handleDelete(t.id)} disabled={busy}>
                                    Delete
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="card">
                <h2>Activity Log</h2>
                <div className="log">{log || 'Waiting for actions...'}</div>
            </section>
        </div>
    );
}
