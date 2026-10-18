import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as controller from './roulette.controller.js';

export const rouletteRoutes = Router();

rouletteRoutes.post('/spin', requireAuth, controller.spin);
rouletteRoutes.post('/accept', requireAuth, controller.accept);
