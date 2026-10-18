import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import { toUserSummary, USER_SUMMARY_FIELDS } from '../users/user.service.js';
import { toGameRef } from '../games/game.service.js';
import { Notification } from './notification.model.js';

export async function notify({ user, actor, ...fields }) {
  if (actor && String(user) === String(actor)) return;
  try {
    await Notification.create({ user, actor, ...fields });
  } catch (err) {
    logger.error({ err, type: fields.type }, 'Could not create notification');
  }
}

const unread = (userId) => ({ user: userId, readAt: null });

export async function listNotifications(userId, query) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter = query.unreadOnly ? unread(userId) : { user: userId };
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('actor', USER_SUMMARY_FIELDS)
      .populate('game', 'title media deletedAt'),
    Notification.countDocuments(filter),
    Notification.countDocuments(unread(userId)),
  ]);
  return { items, page, limit, total, unreadCount };
}

export const countUnread = (userId) => Notification.countDocuments(unread(userId));

export async function markRead(userId, notificationId) {
  const { matchedCount } = await Notification.updateOne(
    { _id: notificationId, user: userId },
    [{ $set: { readAt: { $ifNull: ['$readAt', '$$NOW'] } } }],
    { updatePipeline: true },
  );
  if (!matchedCount) throw ApiError.notFound('Notification not found');
}

export async function markAllRead(userId) {
  await Notification.updateMany(unread(userId), { readAt: new Date() });
}

export const toNotification = (notification) => ({
  id: notification._id.toString(),
  type: notification.type,
  read: Boolean(notification.readAt),
  message: notification.message,
  link: notification.link,
  ...(notification.actor && { actor: toUserSummary(notification.actor) }),
  ...(notification.game && { game: toGameRef(notification.game) }),
  ...(notification.review && { reviewId: notification.review.toString() }),
  createdAt: notification.createdAt,
});
