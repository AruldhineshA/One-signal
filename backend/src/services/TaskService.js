import crypto from 'node:crypto';

/**
 * TaskService
 *
 * In-memory task store (singleton). Demo-only — no database.
 * Data is lost on server restart, which is intentional for a throwaway project.
 */
class TaskService {
    static _instance = null;

    static get Instance() {
        if (!this._instance) {
            this._instance = new TaskService();
        }
        return this._instance;
    }

    constructor() {
        this.tasks = new Map();
    }

    createTask({ title, user_id }) {
        const id = crypto.randomUUID();
        const task = {
            id,
            title,
            user_id,
            created_at: new Date().toISOString(),
            last_notified_at: null,
        };
        this.tasks.set(id, task);
        return task;
    }

    listTasks(user_id) {
        const all = Array.from(this.tasks.values());
        const filtered = user_id ? all.filter((t) => t.user_id === user_id) : all;
        return filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }

    getTask(id) {
        return this.tasks.get(id) || null;
    }

    markNotified(id) {
        const task = this.tasks.get(id);
        if (task) {
            task.last_notified_at = new Date().toISOString();
        }
        return task;
    }

    deleteTask(id) {
        return this.tasks.delete(id);
    }
}

export default TaskService;
