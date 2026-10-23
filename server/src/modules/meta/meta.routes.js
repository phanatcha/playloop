import { Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit.js';
import * as controller from './meta.controller.js';

const limit = rateLimit({
  name: 'meta',
  limit: 120,
  windowMs: 60 * 1000,
  key: (req) => [`ip:${req.ip}`],
});

export const metaRoutes = Router();

metaRoutes.get('/', limit, controller.meta);
