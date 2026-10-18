import { Router } from 'express';
import { healthRoutes } from './modules/health/health.routes.js';
import { gameRoutes, myGameRoutes } from './modules/games/game.routes.js';

export const routes = Router();

routes.use('/health', healthRoutes);
routes.use('/games', gameRoutes);
routes.use('/me/games', myGameRoutes);
