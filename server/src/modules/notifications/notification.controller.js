import * as notifications from './notification.service.js';

export async function listNotifications(req, res) {
  const result = await notifications.listNotifications(req.user.id, req.query);
  res.json({ ...result, items: result.items.map(notifications.toNotification) });
}

export async function getUnreadCount(req, res) {
  res.json({ count: await notifications.countUnread(req.user.id) });
}

export async function markRead(req, res) {
  await notifications.markRead(req.user.id, req.params.notificationId);
  res.status(204).end();
}

export async function markAllRead(req, res) {
  await notifications.markAllRead(req.user.id);
  res.status(204).end();
}
