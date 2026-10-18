import mongoose from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import { mediaUrl } from '../../utils/mediaUrl.js';
import { toUserSummary, USER_SUMMARY_FIELDS } from '../users/user.service.js';
import { Review } from '../reviews/review.model.js';
import { User } from '../users/user.model.js';
import { Game } from './game.model.js';
import { defaultForm } from './game.defaults.js';
import {
  genreProblems,
  missionProblems,
  normalizePresets,
  publishProblems,
  questionProblems,
} from './game.validation.js';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const asList = (value) => [].concat(value ?? []);

function throwIfProblems(problems, message = 'Some fields are invalid') {
  if (problems.length) throw ApiError.validation(message, problems);
}

async function findGame(gameId) {
  const game = await Game.findOne({ _id: gameId, deletedAt: null }).populate(
    'owner',
    USER_SUMMARY_FIELDS,
  );
  if (!game) throw ApiError.notFound('Game not found');
  return game;
}

const isOwner = (game, userId) => Boolean(userId) && game.owner._id.equals(userId);

export async function findOwnedGame(gameId, userId) {
  const game = await findGame(gameId);
  if (!isOwner(game, userId)) throw ApiError.forbidden();
  return game;
}

export async function createGame(userId, { title }) {
  const game = await Game.create({ owner: userId, title, form: defaultForm() });
  return game.populate('owner', USER_SUMMARY_FIELDS);
}

export async function getGame(gameId, userId) {
  const game = await findGame(gameId);
  if (game.status === 'draft' && !isOwner(game, userId)) throw ApiError.notFound('Game not found');
  return game;
}

export async function updateGame(gameId, userId, input) {
  const game = await findOwnedGame(gameId, userId);
  const { mediaIds, theme, delivery, ...fields } = input;

  // shortcut: media and background images need the uploads module (Max), reject until it lands
  if (mediaIds || theme?.backgroundUploadId) {
    throw ApiError.validation('Uploads are not available yet', [
      {
        path: mediaIds ? '/body/mediaIds' : '/body/theme/backgroundUploadId',
        message: 'Not available yet',
      },
    ]);
  }
  throwIfProblems(genreProblems(fields.genres));

  game.set(fields);
  if (theme) {
    if (theme.backgroundPreset)
      game.set({ 'theme.backgroundPreset': theme.backgroundPreset, 'theme.backgroundKey': null });
    if (theme.accentColor) game.theme.accentColor = theme.accentColor;
    if (theme.controlsCardColor) game.theme.controlsCardColor = theme.controlsCardColor;
  }
  if (delivery) game.set({ delivery: { ...game.delivery.toObject(), ...delivery } });

  if (game.status === 'published') {
    throwIfProblems(publishProblems(game), 'A published game must stay complete');
    if (game.isModified('version')) game.lastUpdatedAt = new Date();
  }
  return game.save();
}

export async function deleteGame(gameId, userId) {
  const game = await findOwnedGame(gameId, userId);
  game.deletedAt = new Date();
  await game.save();
}

export async function publishGame(gameId, userId) {
  const game = await findOwnedGame(gameId, userId);
  if (game.status === 'published') throw ApiError.conflict('Game is already published');
  throwIfProblems(publishProblems(game), 'Finish these before publishing');
  const now = new Date();
  game.set({ status: 'published', lastUpdatedAt: now, publishedAt: game.publishedAt ?? now });
  return game.save();
}

export async function unpublishGame(gameId, userId) {
  const game = await findOwnedGame(gameId, userId);
  if (game.status === 'draft') throw ApiError.conflict('Game is already a draft');
  game.status = 'draft';
  return game.save();
}

export const getForm = findOwnedGame;

export async function updateForm(gameId, userId, input) {
  const game = await findOwnedGame(gameId, userId);
  const { firstImpression, playtest, finalVerdict } = input;
  const problems = [];

  if (firstImpression) {
    problems.push(
      ...questionProblems(firstImpression.questions, '/body/firstImpression/questions'),
    );
    game.form.firstImpression.questions = normalizePresets(firstImpression.questions);
  }
  if (playtest) {
    problems.push(
      ...missionProblems(playtest.missions, '/body/playtest/missions'),
      ...questionProblems(playtest.questions, '/body/playtest/questions'),
    );
    if (game.status === 'published' && !playtest.missions.length) {
      problems.push({
        path: '/body/playtest/missions',
        message: 'A published game needs at least one mission',
      });
    }
    game.form.playtest = {
      ...playtest,
      questions: playtest.questions.map(({ preset: _preset, ...question }) => question),
    };
  }
  if (finalVerdict) game.form.finalVerdict = finalVerdict;
  throwIfProblems(problems);

  game.form.revision += 1;
  game.form.updatedAt = new Date();
  game.markModified('form');
  return game.save();
}

export async function listGames(query) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter = { status: 'published', deletedAt: null };
  if (query.search) filter.title = { $regex: escapeRegex(query.search), $options: 'i' };
  for (const [param, field] of [
    ['genre', 'genres'],
    ['platform', 'platforms'],
    ['buildStage', 'buildStage'],
  ]) {
    const values = asList(query[param]);
    if (values.length) filter[field] = { $in: values };
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    query.sort === 'popular'
      ? popularGames(filter, skip, limit)
      : Game.find(filter)
          .sort({ publishedAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('owner', USER_SUMMARY_FIELDS),
    Game.countDocuments(filter),
  ]);
  return { items, page, limit, total };
}

const POPULAR_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

async function popularGames(filter, skip, limit) {
  const since = new Date(Date.now() - POPULAR_WINDOW_MS);
  const ranked = await Game.aggregate([
    { $match: filter },
    {
      $lookup: {
        from: Review.collection.name,
        let: { game: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$game', '$$game'] },
                  { $eq: ['$status', 'submitted'] },
                  { $gte: ['$submittedAt', since] },
                ],
              },
            },
          },
          { $count: 'count' },
        ],
        as: 'recent',
      },
    },
    { $addFields: { recentReviews: { $ifNull: [{ $first: '$recent.count' }, 0] } } },
    { $sort: { recentReviews: -1, publishedAt: -1, _id: 1 } },
    { $skip: skip },
    { $limit: limit },
    { $project: { _id: 1 } },
  ]);
  const ids = ranked.map((g) => g._id);
  const games = await Game.find({ _id: { $in: ids } }).populate('owner', USER_SUMMARY_FIELDS);
  const byId = new Map(games.map((g) => [g.id, g]));
  return ids.map((id) => byId.get(id.toString()));
}

export async function listRecommendations(userId, limit) {
  const base = { status: 'published', deletedAt: null };
  if (!userId) return popularGames(base, 0, limit);

  const me = new mongoose.Types.ObjectId(userId);
  const [user, reviewed] = await Promise.all([
    User.findById(me).select('favoriteGenres'),
    Review.distinct('game', { reviewer: me }),
  ]);
  const notMine = { ...base, owner: { $ne: me } };
  const picks = user?.favoriteGenres.length
    ? await popularGames(
        { ...notMine, _id: { $nin: reviewed }, genres: { $in: user.favoriteGenres } },
        0,
        limit,
      )
    : [];
  if (picks.length < limit) {
    const skip = [...reviewed, ...picks.map((g) => g._id)];
    // shortcut: admin-featured games should fill in before popular ones once the admin module exists
    picks.push(
      ...(await popularGames({ ...notMine, _id: { $nin: skip } }, 0, limit - picks.length)),
    );
  }
  return picks;
}

export async function listMyGames(userId, query) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const owner = new mongoose.Types.ObjectId(userId);
  const filter = { owner, deletedAt: null, ...(query.status && { status: query.status }) };

  const [items, total, groups] = await Promise.all([
    Game.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Game.countDocuments(filter),
    Game.aggregate([
      { $match: { owner, deletedAt: null } },
      { $group: { _id: '$status', count: { $sum: 1 }, reviews: { $sum: '$reviewCount' } } },
    ]),
  ]);
  const newCounts = await Review.aggregate([
    {
      $match: {
        game: { $in: items.map((g) => g._id) },
        status: 'submitted',
        feedbackStatus: 'new',
      },
    },
    { $group: { _id: '$game', count: { $sum: 1 } } },
  ]);
  const newByGame = new Map(newCounts.map((c) => [c._id.toString(), c.count]));
  for (const game of items) game.$locals.newReviewCount = newByGame.get(game._id.toString()) ?? 0;

  const byStatus = Object.fromEntries(groups.map((g) => [g._id, g]));
  const summary = {
    published: byStatus.published?.count ?? 0,
    drafts: byStatus.draft?.count ?? 0,
    reviewsReceived: groups.reduce((sum, g) => sum + g.reviews, 0),
  };
  return { items, page, limit, total, summary };
}

export const estimatedMinutes = (game) =>
  game.form.playtest.missions.reduce((sum, mission) => sum + mission.minutes, 0);

export const coverUrl = (game) => mediaUrl(game.media.find((m) => m.type === 'image')?.key);

export const toGameRef = (game) => ({
  id: game._id.toString(),
  title: game.title,
  coverUrl: coverUrl(game),
  deleted: Boolean(game.deletedAt),
});

export const toTheme = (theme) => ({
  backgroundPreset: theme.backgroundKey ? null : theme.backgroundPreset,
  backgroundImageUrl: mediaUrl(theme.backgroundKey),
  accentColor: theme.accentColor,
  controlsCardColor: theme.controlsCardColor,
});

export function toGameCard(game) {
  return {
    id: game._id.toString(),
    title: game.title,
    pitch: game.pitch,
    coverUrl: coverUrl(game),
    genres: [...game.genres],
    platforms: [...game.platforms],
    buildStage: game.buildStage,
    engine: game.engine,
    estimatedMinutes: estimatedMinutes(game),
    reviewCount: game.reviewCount,
    owner: toUserSummary(game.owner),
    publishedAt: game.publishedAt,
  };
}

export function toGameDetail(game, userId) {
  const { delivery } = game;
  return {
    id: game._id.toString(),
    status: game.status,
    owner: toUserSummary(game.owner),
    title: game.title,
    pitch: game.pitch,
    genres: [...game.genres],
    platforms: [...game.platforms],
    ...(game.buildStage && { buildStage: game.buildStage }),
    version: game.version,
    lastUpdatedAt: game.lastUpdatedAt,
    media: game.media.map((m) => ({ id: m._id.toString(), type: m.type, url: mediaUrl(m.key) })),
    contentWarnings: [...game.contentWarnings],
    coreGameplay: [...game.coreGameplay],
    playable: [...game.playable],
    controls: game.controls.map(({ key, action }) => ({ key, action })),
    devNotes: game.devNotes,
    ...(game.engine && { engine: game.engine }),
    engineOther: game.engineOther,
    credits: game.credits.map(({ role, name }) => ({ role, name })),
    theme: toTheme(game.theme),
    delivery: {
      ...(delivery.method && { method: delivery.method }),
      webUrl: delivery.webUrl,
      builds: [],
    },
    playtest: {
      missionCount: game.form.playtest.missions.length,
      estimatedMinutes: estimatedMinutes(game),
    },
    reviewCount: game.reviewCount,
    isOwner: isOwner(game, userId),
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    publishedAt: game.publishedAt,
  };
}

export function toMyGameItem(game) {
  return {
    id: game._id.toString(),
    title: game.title,
    pitch: game.pitch,
    coverUrl: coverUrl(game),
    status: game.status,
    ...(game.buildStage && { buildStage: game.buildStage }),
    ...(game.engine && { engine: game.engine }),
    platforms: [...game.platforms],
    reviewCount: game.reviewCount,
    newReviewCount: game.$locals.newReviewCount ?? 0,
    updatedAt: game.updatedAt,
  };
}

export function toForm(game) {
  const { form } = game;
  return {
    gameId: game._id.toString(),
    revision: form.revision,
    firstImpression: { questions: form.firstImpression.questions },
    playtest: {
      missions: form.playtest.missions.map(({ id, title, minutes }) => ({ id, title, minutes })),
      knownIssues: [...form.playtest.knownIssues],
      questions: form.playtest.questions,
    },
    finalVerdict: { farewellMessage: form.finalVerdict.farewellMessage },
    estimatedMinutes: estimatedMinutes(game),
    updatedAt: form.updatedAt,
  };
}
