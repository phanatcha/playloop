import { Router } from 'express';
import { healthRoutes } from './modules/health/health.routes.js';
import { gameRoutes, myGameRoutes } from './modules/games/game.routes.js';
import {
  gameFeedbackRoutes,
  gameReviewRoutes,
  myReviewRoutes,
  reviewRoutes,
} from './modules/reviews/review.routes.js';

export const routes = Router();

routes.use('/health', healthRoutes);
routes.use('/games/:gameId/reviews', gameReviewRoutes);
routes.use('/games/:gameId/feedback', gameFeedbackRoutes);
routes.use('/games', gameRoutes);
routes.use('/reviews', reviewRoutes);
routes.use('/me/games', myGameRoutes);
routes.use('/me/reviews', myReviewRoutes);
