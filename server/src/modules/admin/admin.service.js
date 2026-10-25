import mongoose from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import { Reply, Reaction } from '../discussions/discussion.model.js';
import { listFeatured, setFeatured } from '../games/discovery.service.js';
import { Game } from '../games/game.model.js';
import { notify } from '../notifications/notification.service.js';
import { getConfig, toConfig, updateConfig } from '../meta/config.service.js';
import { reverseReviewReputation } from '../reputation/reputation.service.js';
import { Report } from '../reports/report.model.js';
import { listReports, resolveReport } from '../reports/report.service.js';
import { Review } from '../reviews/review.model.js';
import { Vote } from '../votes/vote.model.js';
import { toUserSummary, USER_SUMMARY_FIELDS } from '../users/user.service.js';
import { User } from '../users/user.model.js';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

export async function stats(days = 30) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const [
    users,
    suspendedUsers,
    games,
    publishedGames,
    submittedReviews,
    inProgressReviews,
    replies,
    openReports,
    newUsers,
    newGames,
    newReviews,
    newReports,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ status: { $in: ['suspended', 'banned'] } }),
    Game.countDocuments({ deletedAt: null, removedAt: null }),
    Game.countDocuments({ status: 'published', deletedAt: null, removedAt: null }),
    Review.countDocuments({ status: 'submitted', removedAt: null }),
    Review.countDocuments({ status: 'in_progress', removedAt: null }),
    Reply.countDocuments({ removedAt: null }),
    Report.countDocuments({ status: 'open' }),
    User.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Game.aggregate([
      { $match: { publishedAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$publishedAt' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Review.aggregate([
      { $match: { status: 'submitted', submittedAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Report.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const tally = (rows) => new Map(rows.map((row) => [row._id, row.count]));
  const usersByDay = tally(newUsers);
  const gamesByDay = tally(newGames);
  const reviewsByDay = tally(newReviews);
  const reportsByDay = tally(newReports);
  const daily = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + offset);
    const key = dayKey(date);
    daily.push({
      date: key,
      newUsers: usersByDay.get(key) ?? 0,
      newGames: gamesByDay.get(key) ?? 0,
      submittedReviews: reviewsByDay.get(key) ?? 0,
      reports: reportsByDay.get(key) ?? 0,
    });
  }

  return {
    totals: {
      users,
      suspendedUsers,
      games,
      publishedGames,
      submittedReviews,
      inProgressReviews,
      replies,
      openReports,
    },
    daily,
  };
}

async function loadModerationTarget(targetType, targetId) {
  const model = { game: Game, review: Review, reply: Reply }[targetType];
  const doc = await model.findById(targetId);
  if (!doc || doc.removedAt) throw ApiError.notFound('Content not found');
  return doc;
}

function ownerId(targetType, doc) {
  if (targetType === 'game') return doc.owner;
  if (targetType === 'review') return doc.reviewer;
  return doc.author;
}

export async function hideContent(targetType, targetId, reason) {
  const doc = await loadModerationTarget(targetType, targetId);
  const alreadyHidden = Boolean(doc.hiddenAt);
  doc.hiddenAt = new Date();
  doc.moderationReason = reason;
  await doc.save();
  if (!alreadyHidden && targetType === 'review' && doc.status === 'submitted') {
    await Game.updateOne({ _id: doc.game }, { $inc: { reviewCount: -1 } });
  }
  if (!alreadyHidden && targetType === 'reply') {
    await Review.updateOne({ _id: doc.review }, { $inc: { replyCount: -1 } });
  }
  if (!alreadyHidden)
    await notify({
      user: ownerId(targetType, doc),
      type: 'content_hidden',
      message: `A moderator hid your ${targetType}: ${reason}`,
      link: targetType === 'game' ? `/games/${doc._id}` : `/users/me`,
      game: targetType === 'game' ? doc._id : doc.game,
    });
  return { targetType, targetId: doc._id.toString(), hidden: true, removed: false };
}

export async function restoreContent(targetType, targetId) {
  const doc = await loadModerationTarget(targetType, targetId);
  if (!doc.hiddenAt) {
    return { targetType, targetId: doc._id.toString(), hidden: false, removed: false };
  }
  doc.hiddenAt = null;
  doc.moderationReason = null;
  await doc.save();
  if (targetType === 'review' && doc.status === 'submitted') {
    await Game.updateOne({ _id: doc.game }, { $inc: { reviewCount: 1 } });
  }
  if (targetType === 'reply') {
    await Review.updateOne({ _id: doc.review }, { $inc: { replyCount: 1 } });
  }
  await notify({
    user: ownerId(targetType, doc),
    type: 'content_restored',
    message: `Your ${targetType} is visible again`,
    link: targetType === 'game' ? `/games/${doc._id}` : `/users/me`,
    game: targetType === 'game' ? doc._id : doc.game,
  });
  return { targetType, targetId: doc._id.toString(), hidden: false, removed: false };
}

export async function removeContent(targetType, targetId) {
  const doc = await loadModerationTarget(targetType, targetId);
  await mongoose.connection.transaction(async (session) => {
    if (targetType === 'review') {
      await reverseReviewReputation(doc._id, session);
      await Vote.deleteMany({ review: doc._id }).session(session);
      const replies = await Reply.find({ review: doc._id }).select('_id').session(session);
      await Reaction.deleteMany({
        $or: [
          { targetType: 'review', targetId: doc._id },
          { targetType: 'reply', targetId: { $in: replies.map((reply) => reply._id) } },
        ],
      }).session(session);
      await Reply.deleteMany({ review: doc._id }).session(session);
      if (doc.status === 'submitted' && !doc.hiddenAt) {
        await Game.updateOne({ _id: doc.game }, { $inc: { reviewCount: -1 } }, { session });
      }
    }
    if (targetType === 'reply' && !doc.hiddenAt) {
      await Review.updateOne({ _id: doc.review }, { $inc: { replyCount: -1 } }, { session });
    }
    if (targetType === 'game') {
      doc.deletedAt = new Date();
      await Review.deleteMany({ game: doc._id, status: 'in_progress' }).session(session);
    }
    doc.removedAt = new Date();
    doc.hiddenAt = null;
    await doc.save({ session });
  });
}

async function userStats(userId) {
  const [reviewsWritten, gamesPublished, helpful] = await Promise.all([
    Review.countDocuments({ reviewer: userId, status: 'submitted', removedAt: null }),
    Game.countDocuments({ owner: userId, status: 'published', deletedAt: null, removedAt: null }),
    Review.aggregate([
      { $match: { reviewer: userId, status: 'submitted', removedAt: null } },
      { $group: { _id: null, total: { $sum: '$helpfulCount' } } },
    ]),
  ]);
  return {
    reviewsWritten,
    gamesPublished,
    helpfulVotes: helpful[0]?.total ?? 0,
  };
}

async function toAdminUser(user) {
  const openReportCount = await Report.countDocuments({
    targetType: 'user',
    targetId: user._id,
    status: 'open',
  });
  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    status: user.status,
    ...(user.status !== 'active' &&
      user.suspension?.reason && {
        suspension: {
          reason: user.suspension.reason,
          until: user.suspension.until ?? null,
          at: user.suspension.at,
          ...(user.suspension.by && { by: toUserSummary(user.suspension.by) }),
        },
      }),
    reputationPoints: user.reputationPoints,
    stats: await userStats(user._id),
    openReportCount,
    createdAt: user.createdAt,
  };
}

export async function listUsers(query) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.role) filter.role = query.role;
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ username: pattern }, { displayName: pattern }, { email: pattern }];
  }
  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('suspension.by', USER_SUMMARY_FIELDS),
    User.countDocuments(filter),
  ]);
  return { items: await Promise.all(items.map(toAdminUser)), page, limit, total };
}

async function loadUser(userId) {
  const user = await User.findById(userId).populate('suspension.by', USER_SUMMARY_FIELDS);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

export async function getUser(userId) {
  return toAdminUser(await loadUser(userId));
}

export async function suspendUser(userId, adminId, { reason, until }) {
  const user = await loadUser(userId);
  if (user.role === 'admin') throw ApiError.forbidden("Admins can't be suspended");
  user.status = until == null ? 'banned' : 'suspended';
  user.suspension = {
    reason,
    until: until == null ? null : new Date(until),
    at: new Date(),
    by: adminId,
  };
  await user.save();
  return toAdminUser(await loadUser(userId));
}

export async function unsuspendUser(userId) {
  const user = await loadUser(userId);
  user.status = 'active';
  user.suspension = undefined;
  await user.save();
  return toAdminUser(user);
}

export async function setRole(userId, adminId, role) {
  if (userId === adminId) throw ApiError.forbidden("You can't change your own role");
  const user = await loadUser(userId);
  user.role = role;
  await user.save();
  return toAdminUser(user);
}

export { listReports, resolveReport, listFeatured, setFeatured, getConfig, toConfig, updateConfig };
