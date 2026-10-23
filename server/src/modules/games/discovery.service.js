import mongoose from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import { Featured } from './featured.model.js';
import { toGameCard } from '../games/game.service.js';
import { Game } from '../games/game.model.js';
import { Review } from '../reviews/review.model.js';
import { USER_SUMMARY_FIELDS } from '../users/user.service.js';
import { User } from '../users/user.model.js';

const visible = { status: 'published', deletedAt: null, hiddenAt: null, removedAt: null };

async function bannedIds() {
  return User.find({ status: 'banned' }).distinct('_id');
}

export async function featuredGames() {
  const doc = await Featured.findById('featured').populate({
    path: 'games',
    match: visible,
    populate: { path: 'owner', select: USER_SUMMARY_FIELDS },
  });
  return (doc?.games ?? []).filter(Boolean);
}

export async function listFeatured() {
  return { items: (await featuredGames()).map(toGameCard) };
}

export async function setFeatured(gameIds) {
  const games = await Game.find({ _id: { $in: gameIds }, ...visible });
  if (games.length !== gameIds.length) {
    throw ApiError.validation('Some fields are invalid', [
      { path: '/body/gameIds', message: 'Featured games must be published' },
    ]);
  }
  const byId = new Map(games.map((game) => [game._id.toString(), game]));
  const ordered = gameIds.map((id) => byId.get(id));
  await Game.populate(ordered, { path: 'owner', select: USER_SUMMARY_FIELDS });
  await Featured.findByIdAndUpdate(
    'featured',
    { games: ordered.map((game) => game._id) },
    { upsert: true, new: true },
  );
  return { items: ordered.map(toGameCard) };
}

async function popularGames(limit, exclude) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const banned = await bannedIds();
  const ranked = await Review.aggregate([
    {
      $match: {
        status: 'submitted',
        removedAt: null,
        hiddenAt: null,
        submittedAt: { $gte: since },
      },
    },
    { $group: { _id: '$game', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit + exclude.length },
  ]);
  const ids = ranked.map((row) => row._id).filter((id) => !exclude.some((skip) => skip.equals(id)));
  const games = await Game.find({
    _id: { $in: ids.slice(0, limit) },
    ...visible,
    owner: { $nin: banned },
  }).populate('owner', USER_SUMMARY_FIELDS);
  const byId = new Map(games.map((game) => [game._id.toString(), game]));
  return ids.map((id) => byId.get(id.toString())).filter(Boolean);
}

export async function listRecommendations(user, limit = 5) {
  const featured = await featuredGames();
  const picked = [];
  const seen = new Set();
  const add = (game) => {
    if (!game || seen.has(game._id.toString()) || picked.length >= limit) return;
    seen.add(game._id.toString());
    picked.push(game);
  };

  if (user) {
    const me = await User.findById(user.id);
    if (me?.favoriteGenres.length) {
      const reviewed = await Review.find({
        reviewer: user.id,
        status: 'submitted',
        removedAt: null,
      }).select('game gameVersion');
      const blocked = new Set(reviewed.map((review) => `${review.game}:${review.gameVersion}`));
      const banned = await bannedIds();
      const matches = await Game.find({
        ...visible,
        owner: { $ne: user.id, $nin: banned },
        genres: { $in: me.favoriteGenres },
      })
        .sort({ publishedAt: -1 })
        .limit(30)
        .populate('owner', USER_SUMMARY_FIELDS);
      for (const game of matches) {
        if (!blocked.has(`${game._id}:${game.version}`)) add(game);
      }
    }
  }

  if (picked.length < limit) {
    for (const game of featured) add(game);
  }
  if (picked.length < limit) {
    for (const game of await popularGames(
      limit,
      [...seen].map((id) => new mongoose.Types.ObjectId(id)),
    )) {
      add(game);
    }
  }
  return { items: picked.map(toGameCard) };
}
