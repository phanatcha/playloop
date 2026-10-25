import { Router } from 'express';
import { buildStatus, internalGuard } from './internal.controller.js';

export const internalRoutes = Router();

internalRoutes.post('/builds/:buildId/status', internalGuard, buildStatus);
