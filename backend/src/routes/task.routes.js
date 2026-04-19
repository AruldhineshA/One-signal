import { Router } from 'express';
import TaskService from '../services/TaskService.js';
import OneSignalPushService from '../services/OneSignalPushService.js';

const router = Router();

function validateCreateTaskDto(body) {
    const errors = [];
    if (!body || typeof body !== 'object') {
        errors.push('body_required');
        return errors;
    }
    if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
        errors.push('title_required');
    }
    if (!body.user_id || typeof body.user_id !== 'string' || body.user_id.trim().length === 0) {
        errors.push('user_id_required');
    }
    return errors;
}

/**
 * POST /api/tasks
 * Body: { title: string, user_id: string }
 */
router.post('/', (req, res) => {
    const errors = validateCreateTaskDto(req.body);
    if (errors.length > 0) {
        return res.status(400).json({ success: false, errors });
    }
    const task = TaskService.Instance.createTask({
        title: req.body.title.trim(),
        user_id: req.body.user_id.trim(),
    });
    res.status(201).json({ success: true, data: task });
});

/**
 * GET /api/tasks?user_id=xxx
 */
router.get('/', (req, res) => {
    const { user_id } = req.query;
    const tasks = TaskService.Instance.listTasks(user_id);
    res.json({ success: true, data: tasks });
});

/**
 * DELETE /api/tasks/:id
 */
router.delete('/:id', (req, res) => {
    const deleted = TaskService.Instance.deleteTask(req.params.id);
    if (!deleted) {
        return res.status(404).json({ success: false, errors: ['not_found'] });
    }
    res.json({ success: true });
});

/**
 * POST /api/tasks/:id/notify
 * Sends a OneSignal push reminder for the task to its owner (user_id).
 */
router.post('/:id/notify', async (req, res) => {
    const task = TaskService.Instance.getTask(req.params.id);
    if (!task) {
        return res.status(404).json({ success: false, errors: ['task_not_found'] });
    }

    const result = await OneSignalPushService.Instance.sendPush({
        user_ids: [task.user_id],
        title: 'Task Reminder',
        message: task.title,
        action_url: req.body?.action_url,
        data: { task_id: task.id, type: 'task_reminder' },
    });

    if (result.success) {
        TaskService.Instance.markNotified(task.id);
    }

    res.status(result.success ? 200 : 502).json({
        success: result.success,
        onesignal_id: result.onesignal_id,
        recipients_count: result.recipients_count,
        errors: result.errors,
        details: result.details,
    });
});

export default router;
