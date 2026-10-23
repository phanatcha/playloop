import mongoose from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import {
  adjustReputation,
  awardAchievements,
  notifyProgress,
  votePoints,
} from '../reputation/reputation.service.js';
import { Review } from '../reviews/review.model.js';
import { Vote } from './vote.model.js';

async function visibleReview(reviewId) {
  const review = await Review.findById(reviewId).populate('reviewer', 'displayName');
  if (!review || review.removedAt || review.hiddenAt || review.status !== 'submitted') {
    throw ApiError.notFound('Review not found');
  }
  return review;
}

function countsOf(review, myVote) {
  return {
    reviewId: review._id.toString(),
    helpfulCount: review.helpfulCount,
    notHelpfulCount: review.notHelpfulCount,
    myVote,
  };
}

async function applyVote(review, userId, nextValue) {
  const link = `/games/${review.game}/reviews/${review._id}`;
  let progress = null;
  await mongoose.connection.transaction(async (session) => {
    const existing = await Vote.findOne({ user: userId, review: review._id }).session(session);
    const previous = existing?.value ?? null;
    if (previous === nextValue) return;

    const pointsFor = (value) => (value == null ? 0 : votePoints(value));
    const delta = pointsFor(nextValue) - pointsFor(previous);
    if (nextValue == null) await existing.deleteOne({ session });
    else if (existing) {
      existing.value = nextValue;
      await existing.save({ session });
    } else {
      await Vote.create([{ user: userId, review: review._id, value: nextValue }], { session });
    }

    const helpfulDelta = (nextValue === 1 ? 1 : 0) - (previous === 1 ? 1 : 0);
    const notHelpfulDelta = (nextValue === -1 ? 1 : 0) - (previous === -1 ? 1 : 0);
    review.helpfulCount += helpfulDelta;
    review.notHelpfulCount += notHelpfulDelta;
    await review.save({ session });

    progress = await adjustReputation(
      review.reviewer._id,
      delta,
      {
        review: review._id,
        kind: nextValue === 1 ? 'helpful' : nextValue === -1 ? 'not_helpful' : 'vote_removed',
      },
      session,
    );
    const badges = await awardAchievements(review.reviewer._id, session);
    await notifyProgress(
      review.reviewer._id,
      { before: progress?.before, after: progress?.after, badges },
      link,
      session,
    );
  });
  return countsOf(review, nextValue);
}

export async function setVote(reviewId, userId, value) {
  const review = await visibleReview(reviewId);
  if (review.reviewer._id.equals(userId))
    throw ApiError.forbidden("You can't vote on your own review");
  return applyVote(review, userId, value);
}

export async function removeVote(reviewId, userId) {
  const review = await visibleReview(reviewId);
  const existing = await Vote.findOne({ user: userId, review: review._id });
  if (!existing) return countsOf(review, null);
  return applyVote(review, userId, null);
}

export async function votesByReview(reviewIds, userId) {
  if (!userId || !reviewIds.length) return new Map();
  const votes = await Vote.find({ review: { $in: reviewIds }, user: userId });
  return new Map(votes.map((vote) => [vote.review.toString(), vote.value]));
}
