import { Router } from 'express';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import * as controller from './review.controller.js';

export const gameReviewRoutes = Router({ mergeParams: true });

gameReviewRoutes.post('/', requireAuth, controller.startReview);

export const reviewRoutes = Router();

reviewRoutes.get('/:reviewId', optionalAuth, controller.getReview);
reviewRoutes.delete('/:reviewId', requireAuth, controller.deleteReview);
reviewRoutes.put('/:reviewId/first-impression', requireAuth, controller.saveFirstImpression);
reviewRoutes.post('/:reviewId/missions/:missionId/accept', requireAuth, controller.acceptMission);
reviewRoutes.post('/:reviewId/cards', requireAuth, controller.addCard);
reviewRoutes.patch('/:reviewId/cards/:cardId', requireAuth, controller.updateCard);
reviewRoutes.delete('/:reviewId/cards/:cardId', requireAuth, controller.deleteCard);
reviewRoutes.put('/:reviewId/playtest', requireAuth, controller.savePlaytest);
reviewRoutes.put('/:reviewId/developer-answers', requireAuth, controller.saveDeveloperAnswers);
reviewRoutes.put('/:reviewId/final-verdict', requireAuth, controller.saveFinalVerdict);
reviewRoutes.post('/:reviewId/submit', requireAuth, controller.submitReview);

export const myReviewRoutes = Router();

myReviewRoutes.get('/', requireAuth, controller.listMyReviews);
