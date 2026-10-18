import { toReview } from '../reviews/review.service.js';
import * as roulette from './roulette.service.js';

export async function spin(req, res) {
  const { spinToken, game } = await roulette.spin(req.user.id, req.body);
  res.json({ spinToken, game: roulette.toRouletteGame(game) });
}

export async function accept(req, res) {
  const { review, created } = await roulette.accept(req.user.id, req.body.spinToken);
  res.status(created ? 201 : 200).json(toReview(review, req.user.id));
}
