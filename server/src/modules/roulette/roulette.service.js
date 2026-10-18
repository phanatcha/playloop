import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { toUserSummary, USER_SUMMARY_FIELDS } from '../users/user.service.js';
import { Game } from '../games/game.model.js';
import { coverUrl, estimatedMinutes } from '../games/game.service.js';
import { Review } from '../reviews/review.model.js';
import { startReview } from '../reviews/review.service.js';

const { ObjectId } = mongoose.Types;

export async function spin(userId, { genres, platform, buildStage, maxMinutes, exclude = [] }) {
  const reviewer = new ObjectId(userId);
  const match = {
    status: 'published',
    deletedAt: null,
    owner: { $ne: reviewer },
    _id: { $nin: exclude.map((id) => new ObjectId(id)) },
    'form.playtest.missions.0': { $exists: true },
    ...(genres?.length && { genres: { $in: genres } }),
    ...(platform && { platforms: platform }),
    ...(buildStage && { buildStage }),
  };

  const [picked] = await Game.aggregate([
    { $match: match },
    { $addFields: { minutes: { $sum: '$form.playtest.missions.minutes' } } },
    ...(maxMinutes ? [{ $match: { minutes: { $lte: maxMinutes } } }] : []),
    {
      $lookup: {
        from: Review.collection.name,
        let: { game: '$_id', version: '$version' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$game', '$$game'] },
                  { $eq: ['$gameVersion', '$$version'] },
                  { $eq: ['$reviewer', reviewer] },
                  { $eq: ['$status', 'submitted'] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: 'reviewed',
      },
    },
    { $match: { reviewed: { $size: 0 } } },
    { $sample: { size: 1 } },
    { $project: { _id: 1 } },
  ]);
  if (!picked) throw ApiError.noMatch();

  const game = await Game.findById(picked._id).populate('owner', USER_SUMMARY_FIELDS);
  const spinToken = jwt.sign({ sub: userId, gameId: game.id, purpose: 'roulette' }, env.jwtSecret, {
    expiresIn: '30m',
  });
  return { spinToken, game };
}

export function accept(userId, spinToken) {
  let payload;
  try {
    payload = jwt.verify(spinToken, env.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    payload = null;
  }
  if (payload?.purpose !== 'roulette' || payload.sub !== userId) {
    throw ApiError.validation('This spin has expired, please spin again', [
      { path: '/body/spinToken', message: 'Invalid or expired' },
    ]);
  }
  return startReview(payload.gameId, userId, 'roulette');
}

export const toRouletteGame = (game) => ({
  id: game._id.toString(),
  title: game.title,
  pitch: game.pitch,
  coverUrl: coverUrl(game),
  genres: [...game.genres],
  platforms: [...game.platforms],
  buildStage: game.buildStage,
  engine: game.engine,
  deliveryMethod: game.delivery.method,
  missionCount: game.form.playtest.missions.length,
  estimatedMinutes: estimatedMinutes(game),
  owner: toUserSummary(game.owner),
});
