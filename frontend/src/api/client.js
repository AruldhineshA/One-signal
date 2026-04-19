const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request(path, { method = 'GET', body, query } = {}) {
    const url = new URL(`${API_URL}${path}`);
    if (query) {
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, value);
            }
        });
    }

    const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.errors?.[0] || `HTTP ${response.status}`);
        error.status = response.status;
        error.body = data;
        throw error;
    }
    return data;
}

export const api = {
    getPushConfig: () => request('/api/push/config'),
    createTask: (title, user_id) => request('/api/tasks', { method: 'POST', body: { title, user_id } }),
    listTasks: (user_id) => request('/api/tasks', { query: { user_id } }),
    deleteTask: (id) => request(`/api/tasks/${id}`, { method: 'DELETE' }),
    notifyTask: (id) => request(`/api/tasks/${id}/notify`, { method: 'POST', body: {} }),
};
