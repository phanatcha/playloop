import mongoose from 'mongoose';
import { FEEDBACK_STATUSES, REPUTATION_POINTS } from '@playloop/shared';
import { ApiError } from '../../utils/ApiError.js';
import { mediaUrl } from '../../utils/mediaUrl.js';
import { toUserSummary, USER_SUMMARY_FIELDS } from '../users/user.service.js';
import { User } from '../users/user.model.js';
import { Game } from '../games/game.model.js';
import {
  coverUrl,
  findOwnedGame,
  getGame,
  toForm,
  toGameRef,
  toTheme,
} from '../games/game.service.js';
import { Review } from './review.model.js';
import { answerProblems, verdictProblems } from './review.validation.js';

const GAME_FIELDS = 'owner title pitch genres media theme controls delivery deletedAt';
const VERDICT_FIELDS = [
  'comparison',
  'changeText',
  'actualDifficulty',
  'actualStrength',
  'actualAudience',
  'enjoyment',
  'improveCategory',
  'improveOther',
  'improveText',
  'completedAt',
];

function throwIfProblems(problems, message = 'Some answers are invalid') {
  if (problems.length) throw ApiError.validation(message, problems);
}

async function loadReview(reviewId) {
  const review = await Review.findById(reviewId)
    .populate('reviewer', USER_SUMMARY_FIELDS)
    .populate({
      path: 'game',
      select: GAME_FIELDS,
      populate: { path: 'owner', select: USER_SUMMARY_FIELDS },
    });
  if (!review) throw ApiError.notFound('Review not found');
  return review;
}

const isReviewer = (review, userId) => Boolean(userId) && review.reviewer._id.equals(userId);

async function loadEditable(reviewId, userId) {
  const review = await loadReview(reviewId);
  if (!isReviewer(review, userId)) throw ApiError.forbidden();
  if (review.status === 'submitted') throw ApiError.conflict('This review is already submitted');
  return review;
}

function requireStage(done, message) {
  if (!done) throw ApiError.conflict(message);
}

export async function startReview(gameId, userId, origin = 'browse') {
  const game = await Game.findOne({ _id: gameId, deletedAt: null, status: 'published' });
  if (!game) throw ApiError.notFound('Game not found');
  if (game.owner.equals(userId)) throw ApiError.forbidden("You can't review your own game");

  const existing = await Review.findOne({
    game: game._id,
    reviewer: userId,
    gameVersion: game.version,
  });
  if (existing?.status === 'submitted') {
    throw ApiError.conflict('You already reviewed this version of the game');
  }
  if (existing) return { review: await loadReview(existing._id), created: false };

  const { revision, firstImpression, playtest, finalVerdict } = toForm(game);
  try {
    const review = await Review.create({
      game: game._id,
      reviewer: userId,
      gameVersion: game.version,
      origin,
      deliveryMethod: game.delivery.method,
      form: { revision, firstImpression, playtest, finalVerdict },
    });
    return { review: await loadReview(review._id), created: true };
  } catch (err) {
    if (err.code === 11000) return startReview(gameId, userId, origin);
    throw err;
  }
}

export async function getReview(reviewId, userId) {
  const review = await loadReview(reviewId);
  if (review.status === 'in_progress' && !isReviewer(review, userId)) {
    throw ApiError.notFound('Review not found');
  }
  return review;
}

export async function saveFirstImpression(reviewId, userId, { answers, complete }) {
  const review = await loadEditable(reviewId, userId);
  const { questions } = review.form.firstImpression;
  throwIfProblems(answerProblems(questions, answers, { complete }, '/body/answers'));
  review.firstImpression.answers = answers;
  if (complete) review.firstImpression.completedAt = new Date();
  return review.save();
}

export async function acceptMission(reviewId, userId, missionId) {
  const review = await loadEditable(reviewId, userId);
  requireStage(review.firstImpression.completedAt, 'Finish your first impression first');
  if (!review.form.playtest.missions.some((m) => m.id === missionId)) {
    throw ApiError.notFound('Mission not found');
  }
  review.playtest.acceptedMissionIds.addToSet(missionId);
  return review.save();
}

export async function addCard(reviewId, userId, card) {
  const review = await loadEditable(reviewId, userId);
  requireStage(review.firstImpression.completedAt, 'Finish your first impression first');
  requireStage(
    review.playtest.acceptedMissionIds.includes(card.missionId),
    'Accept this mission first',
  );
  review.playtest.cards.push(card);
  await review.save();
  return review.playtest.cards.at(-1);
}

function findCard(review, cardId) {
  const card = review.playtest.cards.id(cardId);
  if (!card) throw ApiError.notFound('Card not found');
  return card;
}

export async function updateCard(reviewId, userId, cardId, changes) {
  const review = await loadEditable(reviewId, userId);
  const card = findCard(review, cardId);
  card.set(changes);
  await review.save();
  return card;
}

export async function deleteCard(reviewId, userId, cardId) {
  const review = await loadEditable(reviewId, userId);
  findCard(review, cardId).deleteOne();
  await review.save();
}

export async function savePlaytest(reviewId, userId, { playedSeconds, proofUploadId, complete }) {
  const review = await loadEditable(reviewId, userId);
  requireStage(review.firstImpression.completedAt, 'Finish your first impression first');

  // shortcut: proof screenshots need the uploads module (Max), reject until it lands
  if (proofUploadId) {
    throw ApiError.validation('Uploads are not available yet', [
      { path: '/body/proofUploadId', message: 'Not available yet' },
    ]);
  }
  if (proofUploadId === null) review.playtest.proofKey = null;
  if (playedSeconds !== undefined) review.playtest.playedSeconds = playedSeconds;

  if (complete) {
    const accepted = review.playtest.acceptedMissionIds;
    const missing = review.form.playtest.missions.filter((m) => !accepted.includes(m.id));
    throwIfProblems(
      [
        ...missing.map((m) => ({ path: '/body/complete', message: `Accept mission "${m.title}"` })),
        ...(review.deliveryMethod === 'download' && !review.playtest.proofKey
          ? [{ path: '/body/proofUploadId', message: 'Add your end-of-game screenshot' }]
          : []),
      ],
      'Finish the playtest first',
    );
    review.playtest.completedAt = new Date();
  }
  return review.save();
}

export async function saveDeveloperAnswers(reviewId, userId, { answers, complete }) {
  const review = await loadEditable(reviewId, userId);
  requireStage(review.playtest.completedAt, 'Finish the playtest first');
  const { questions } = review.form.playtest;
  throwIfProblems(answerProblems(questions, answers, { complete }, '/body/answers'));
  review.developerAnswers.answers = answers;
  if (complete) review.developerAnswers.completedAt = new Date();
  return review.save();
}

const devQuestionsDone = (review) =>
  !review.form.playtest.questions.length || Boolean(review.developerAnswers.completedAt);

export async function saveFinalVerdict(reviewId, userId, { complete, ...fields }) {
  const review = await loadEditable(reviewId, userId);
  requireStage(review.playtest.completedAt, 'Finish the playtest first');
  requireStage(devQuestionsDone(review), "Answer the developer's questions first");
  review.set({ finalVerdict: { ...review.finalVerdict.toObject(), ...fields } });
  if (complete) {
    throwIfProblems(verdictProblems(review.finalVerdict), 'Finish the final verdict first');
    review.finalVerdict.completedAt = new Date();
  }
  return review.save();
}

function submitProblems(review) {
  const { form } = review;
  return [
    ...answerProblems(
      form.firstImpression.questions,
      review.firstImpression.answers,
      { complete: true },
      '/firstImpression',
    ),
    ...(review.playtest.completedAt ? [] : [{ path: '/playtest', message: 'Finish the playtest' }]),
    ...answerProblems(
      form.playtest.questions,
      review.developerAnswers.answers,
      { complete: true },
      '/developerAnswers',
    ),
    ...verdictProblems(review.finalVerdict).map((p) => ({
      ...p,
      path: p.path.replace('/body', '/finalVerdict'),
    })),
  ];
}

export async function submitReview(reviewId, userId) {
  const review = await loadEditable(reviewId, userId);
  throwIfProblems(submitProblems(review), 'Finish every step before submitting');

  await mongoose.connection.transaction(async (session) => {
    review.set({ status: 'submitted', submittedAt: new Date() });
    await review.save({ session });
    await Game.updateOne({ _id: review.game._id }, { $inc: { reviewCount: 1 } }, { session });
  });
  // shortcut: badges, reviewer stats and the developer notification come with those modules
  return review;
}

export async function deleteReview(reviewId, userId) {
  const review = await loadReview(reviewId);
  if (!isReviewer(review, userId)) throw ApiError.forbidden();

  await mongoose.connection.transaction(async (session) => {
    await Review.deleteOne({ _id: review._id }, { session });
    if (review.status === 'submitted') {
      await Game.updateOne({ _id: review.game._id }, { $inc: { reviewCount: -1 } }, { session });
    }
  });
  // shortcut: votes, replies and earned reputation must be removed here once those modules exist
}

export async function listMyReviews(userId, query) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter = { reviewer: userId, ...(query.status && { status: query.status }) };
  const [items, total] = await Promise.all([
    Review.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('game', 'title media deletedAt'),
    Review.countDocuments(filter),
  ]);
  return { items, page, limit, total };
}

export async function listGameReviews(gameId, userId, query) {
  const game = await getGame(gameId, userId);
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter = {
    game: game._id,
    status: 'submitted',
    ...(query.version && { gameVersion: query.version }),
  };
  const sort =
    query.sort === 'newest' ? { submittedAt: -1 } : { helpfulCount: -1, submittedAt: -1 };

  const [items, total] = await Promise.all([
    Review.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('reviewer', USER_SUMMARY_FIELDS),
    Review.countDocuments(filter),
  ]);
  return { items, page, limit, total };
}

export async function getFeedbackInbox(gameId, userId, query) {
  const game = await findOwnedGame(gameId, userId);
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const base = { game: game._id, status: 'submitted' };
  const filter = { ...base, ...(query.status && { feedbackStatus: query.status }) };

  const [items, total, groups] = await Promise.all([
    Review.find(filter)
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('reviewer', USER_SUMMARY_FIELDS),
    Review.countDocuments(filter),
    Review.aggregate([
      { $match: base },
      { $group: { _id: '$feedbackStatus', count: { $sum: 1 } } },
    ]),
  ]);
  const counts = Object.fromEntries(FEEDBACK_STATUSES.map((s) => [s, 0]));
  for (const { _id, count } of groups) counts[_id] = count;
  counts.all = groups.reduce((sum, g) => sum + g.count, 0);
  return { items, page, limit, total, counts };
}

const feedbackBonus = (status) =>
  ({ planned: REPUTATION_POINTS.feedbackPlanned, fixed: REPUTATION_POINTS.feedbackFixed })[
    status
  ] ?? 0;

export async function setFeedbackStatus(reviewId, userId, status) {
  const review = await loadReview(reviewId);
  if (!review.game.owner._id.equals(userId)) throw ApiError.forbidden();
  if (review.status !== 'submitted')
    throw ApiError.conflict('Only submitted reviews have a status');
  if (review.feedbackStatus === status) return review;

  const delta = feedbackBonus(status) - feedbackBonus(review.feedbackStatus);
  await mongoose.connection.transaction(async (session) => {
    review.feedbackStatus = status;
    await review.save({ session });
    if (delta) {
      await User.updateOne(
        { _id: review.reviewer._id },
        [{ $set: { reputationPoints: { $max: [0, { $add: ['$reputationPoints', delta] }] } } }],
        { session, updatePipeline: true },
      );
    }
  });
  // shortcut: Bug Hunter badge and the reviewer notification come with the badges and notifications modules
  return review;
}

export const toFeedbackItem = (review) => ({
  id: review._id.toString(),
  reviewer: toUserSummary(review.reviewer),
  gameVersion: review.gameVersion,
  excerpt: (review.finalVerdict.changeText ?? '').slice(0, 200),
  playedSeconds: review.playtest.playedSeconds,
  feedbackStatus: review.feedbackStatus,
  submittedAt: review.submittedAt,
});

function currentStep(review) {
  if (!review.firstImpression.completedAt) return 'first_impression';
  if (!review.playtest.completedAt) return 'playtest';
  if (!devQuestionsDone(review)) return 'developer_questions';
  if (!review.finalVerdict.completedAt) return 'final_verdict';
  return 'summary';
}

const withCompletedAt = (stage, body) => ({
  ...body,
  ...(stage.completedAt && { completedAt: stage.completedAt }),
});

export const toAnswersStage = (stage) => withCompletedAt(stage, { answers: [...stage.answers] });

export const toCard = (card) => ({
  id: card._id.toString(),
  type: card.type,
  missionId: card.missionId,
  comment: card.comment,
  playedSeconds: card.playedSeconds,
  createdAt: card.createdAt,
});

export function toPlaytestStage(review, canSeeProof) {
  const { playtest } = review;
  return withCompletedAt(playtest, {
    acceptedMissionIds: [...playtest.acceptedMissionIds],
    cards: playtest.cards.map(toCard),
    playedSeconds: playtest.playedSeconds,
    // shortcut: public media URL, switch to a presigned private URL when proof uploads land
    proofScreenshotUrl: canSeeProof ? mediaUrl(playtest.proofKey) : null,
  });
}

export function toVerdictStage(review) {
  const verdict = review.finalVerdict;
  return Object.fromEntries(
    VERDICT_FIELDS.filter((field) => verdict[field] != null).map((f) => [f, verdict[f]]),
  );
}

function expectations(review) {
  const answers = new Map(review.firstImpression.answers.map((a) => [a.questionId, a]));
  const result = {};
  for (const question of review.form.firstImpression.questions) {
    const answer = answers.get(question.id);
    if (!question.preset || !answer) continue;
    if (question.preset === 'impression') result.impressionText = answer.text;
    else if (question.preset !== 'excitement' && answer.optionId)
      result[question.preset] = answer.optionId;
  }
  return result;
}

export function toReview(review, userId) {
  const { game } = review;
  const reviewer = isReviewer(review, userId);
  const gameOwner = Boolean(userId) && game.owner._id.equals(userId);
  return {
    id: review._id.toString(),
    status: review.status,
    origin: review.origin,
    gameVersion: review.gameVersion,
    deliveryMethod: review.deliveryMethod,
    currentStep: currentStep(review),
    reviewer: toUserSummary(review.reviewer),
    game: {
      id: game._id.toString(),
      title: game.title,
      pitch: game.pitch,
      genres: [...game.genres],
      coverUrl: coverUrl(game),
      theme: toTheme(game.theme),
      controls: game.controls.map(({ key, action }) => ({ key, action })),
      owner: toUserSummary(game.owner),
      deleted: Boolean(game.deletedAt),
      webPlayUrl: review.deliveryMethod === 'web' ? game.delivery.webUrl : null,
      // shortcut: empty until the uploads module provides download builds
      downloads: [],
    },
    form: review.form,
    firstImpression: toAnswersStage(review.firstImpression),
    playtest: toPlaytestStage(review, reviewer || gameOwner),
    developerAnswers: toAnswersStage(review.developerAnswers),
    finalVerdict: toVerdictStage(review),
    expectations: expectations(review),
    feedbackStatus: review.feedbackStatus,
    helpfulCount: review.helpfulCount,
    notHelpfulCount: review.notHelpfulCount,
    // shortcut: myVote and reactions are filled in by the votes and discussions modules
    myVote: null,
    replyCount: review.replyCount,
    reactions: [],
    isReviewer: reviewer,
    isGameOwner: gameOwner,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    submittedAt: review.submittedAt,
  };
}

export function toReviewCard(review) {
  const cardCounts = { confused: 0, enjoyed: 0, bug: 0 };
  for (const card of review.playtest.cards) cardCounts[card.type] += 1;
  return {
    id: review._id.toString(),
    reviewer: toUserSummary(review.reviewer),
    gameVersion: review.gameVersion,
    submittedAt: review.submittedAt,
    cardCounts,
    finalVerdict: toVerdictStage(review),
    feedbackStatus: review.feedbackStatus,
    helpfulCount: review.helpfulCount,
    notHelpfulCount: review.notHelpfulCount,
    // shortcut: myVote is filled in by the votes module (Max)
    myVote: null,
    replyCount: review.replyCount,
    reactions: [],
  };
}

export function toMyReviewItem(review) {
  return {
    id: review._id.toString(),
    status: review.status,
    origin: review.origin,
    game: toGameRef(review.game),
    gameVersion: review.gameVersion,
    currentStep: currentStep(review),
    helpfulCount: review.helpfulCount,
    updatedAt: review.updatedAt,
    submittedAt: review.submittedAt,
  };
}
