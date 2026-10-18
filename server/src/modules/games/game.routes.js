import { Router } from 'express';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import * as controller from './game.controller.js';

export const gameRoutes = Router();

gameRoutes.get('/', controller.listGames);
gameRoutes.post('/', requireAuth, controller.createGame);
gameRoutes.get('/:gameId', optionalAuth, controller.getGame);
gameRoutes.patch('/:gameId', requireAuth, controller.updateGame);
gameRoutes.delete('/:gameId', requireAuth, controller.deleteGame);
gameRoutes.post('/:gameId/publish', requireAuth, controller.publishGame);
gameRoutes.post('/:gameId/unpublish', requireAuth, controller.unpublishGame);
gameRoutes.get('/:gameId/form', requireAuth, controller.getForm);
gameRoutes.patch('/:gameId/form', requireAuth, controller.updateForm);

export const myGameRoutes = Router();

myGameRoutes.get('/', requireAuth, controller.listMyGames);
