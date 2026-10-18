import { Router } from 'express';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import * as controller from './discussion.controller.js';

export const reviewReplyRoutes = Router({ mergeParams: true });

reviewReplyRoutes.get('/', optionalAuth, controller.listReplies);
reviewReplyRoutes.post('/', requireAuth, controller.createReply);

export const replyRoutes = Router();

replyRoutes.patch('/:replyId', requireAuth, controller.updateReply);
replyRoutes.delete('/:replyId', requireAuth, controller.deleteReply);

export const reactionRoutes = Router();

reactionRoutes.put('/:targetType/:targetId/:emoji', requireAuth, controller.addReaction);
reactionRoutes.delete('/:targetType/:targetId/:emoji', requireAuth, controller.removeReaction);
