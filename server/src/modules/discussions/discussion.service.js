import mongoose from 'mongoose';
import { REACTION_EMOJIS } from '@playloop/shared';
import { ApiError } from '../../utils/ApiError.js';
import { toUserSummary, USER_SUMMARY_FIELDS } from '../users/user.service.js';
import { notify } from '../notifications/notification.service.js';
import { Review } from '../reviews/review.model.js';
import { Reply } from './reply.model.js';
import { Reaction } from './reaction.model.js';

async function loadReview(reviewId) {
  const review = await Review.findById(reviewId).populate('game', 'owner title');
  if (!review) throw ApiError.notFound('Review not found');
  return review;
}

async function loadSubmittedReview(reviewId) {
  const review = await loadReview(reviewId);
  if (review.status !== 'submitted') throw ApiError.notFound('Review not found');
  return review;
}

async function loadReply(replyId) {
  const reply = await Reply.findById(replyId).populate('author', USER_SUMMARY_FIELDS);
  if (!reply) throw ApiError.notFound('Reply not found');
  return reply;
}

function assertAuthor(reply, userId) {
  if (!reply.author._id.equals(userId)) throw ApiError.forbidden();
}

export async function reactionSummaries(targetType, targetIds, userId) {
  const byTarget = new Map();
  if (!targetIds.length) return byTarget;

  const rows = await Reaction.aggregate([
    { $match: { targetType, targetId: { $in: targetIds } } },
    {
      $group: {
        _id: { targetId: '$targetId', emoji: '$emoji' },
        count: { $sum: 1 },
        users: { $push: '$user' },
      },
    },
  ]);
  for (const { _id, count, users } of rows) {
    const key = _id.targetId.toString();
    if (!byTarget.has(key)) byTarget.set(key, []);
    byTarget.get(key).push({
      emoji: _id.emoji,
      count,
      reactedByMe: Boolean(userId) && users.some((user) => user.equals(userId)),
    });
  }
  for (const list of byTarget.values()) {
    list.sort((a, b) => REACTION_EMOJIS.indexOf(a.emoji) - REACTION_EMOJIS.indexOf(b.emoji));
  }
  return byTarget;
}

export async function listReplies(reviewId, userId, query) {
  const review = await loadSubmittedReview(reviewId);
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const [items, total] = await Promise.all([
    Reply.find({ review: review._id })
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author', USER_SUMMARY_FIELDS),
    Reply.countDocuments({ review: review._id }),
  ]);
  const reactions = await reactionSummaries(
    'reply',
    items.map((r) => r._id),
    userId,
  );
  return { items, page, limit, total, review, reactions };
}

export async function createReply(reviewId, userId, body) {
  const review = await loadReview(reviewId);
  if (review.status !== 'submitted') {
    if (!review.reviewer.equals(userId)) throw ApiError.notFound('Review not found');
    throw ApiError.forbidden('You can reply once the review is submitted');
  }

  let reply;
  await mongoose.connection.transaction(async (session) => {
    [reply] = await Reply.create([{ review: review._id, author: userId, body }], { session });
    await Review.updateOne({ _id: review._id }, { $inc: { replyCount: 1 } }, { session });
  });
  await reply.populate('author', USER_SUMMARY_FIELDS);

  const name = reply.author.displayName;
  const recipients = [
    [review.reviewer, `${name} replied to your review of ${review.game.title}`],
    [review.game.owner, `${name} replied to a review of ${review.game.title}`],
  ].filter(([user], i, all) => all.findIndex(([other]) => other.equals(user)) === i);
  for (const [user, message] of recipients) {
    await notify({
      user,
      actor: userId,
      type: 'reply_received',
      message,
      link: `/games/${review.game.id}/reviews/${review.id}`,
      game: review.game._id,
      review: review._id,
    });
  }
  return { reply, review };
}

export async function updateReply(replyId, userId, body) {
  const reply = await loadReply(replyId);
  assertAuthor(reply, userId);
  reply.set({ body, editedAt: new Date() });
  await reply.save();
  const [review, reactions] = await Promise.all([
    loadReview(reply.review),
    reactionSummaries('reply', [reply._id], userId),
  ]);
  return { reply, review, reactions: reactions.get(reply.id) ?? [] };
}

export async function deleteReply(replyId, userId) {
  const reply = await loadReply(replyId);
  assertAuthor(reply, userId);
  await mongoose.connection.transaction(async (session) => {
    await Reply.deleteOne({ _id: reply._id }, { session });
    await Review.updateOne({ _id: reply.review }, { $inc: { replyCount: -1 } }, { session });
    await Reaction.deleteMany({ targetType: 'reply', targetId: reply._id }, { session });
  });
}

async function assertReactionTarget(targetType, targetId) {
  if (targetType === 'review') await loadSubmittedReview(targetId);
  else await loadReply(targetId);
}

export async function addReaction(targetType, targetId, emoji, userId) {
  await assertReactionTarget(targetType, targetId);
  const key = { targetType, targetId, user: userId, emoji };
  try {
    await Reaction.updateOne(key, { $setOnInsert: key }, { upsert: true });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
  return reactionsFor(targetType, targetId, userId);
}

export async function removeReaction(targetType, targetId, emoji, userId) {
  await assertReactionTarget(targetType, targetId);
  await Reaction.deleteOne({ targetType, targetId, user: userId, emoji });
  return reactionsFor(targetType, targetId, userId);
}

async function reactionsFor(targetType, targetId, userId) {
  const id = new mongoose.Types.ObjectId(targetId);
  const summaries = await reactionSummaries(targetType, [id], userId);
  return { targetType, targetId: id.toString(), reactions: summaries.get(id.toString()) ?? [] };
}

export function toReply(reply, review, reactions = []) {
  return {
    id: reply._id.toString(),
    reviewId: review._id.toString(),
    author: toUserSummary(reply.author),
    isGameOwner: reply.author._id.equals(review.game.owner),
    isReviewAuthor: reply.author._id.equals(review.reviewer),
    body: reply.body,
    edited: Boolean(reply.editedAt),
    reactions,
    createdAt: reply.createdAt,
    updatedAt: reply.updatedAt,
  };
}
