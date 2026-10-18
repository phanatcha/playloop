import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as controller from './notification.controller.js';

export const notificationRoutes = Router();

notificationRoutes.use(requireAuth);
notificationRoutes.get('/', controller.listNotifications);
notificationRoutes.get('/unread-count', controller.getUnreadCount);
notificationRoutes.post('/read-all', controller.markAllRead);
notificationRoutes.post('/:notificationId/read', controller.markRead);
