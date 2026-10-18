import mongoose from 'mongoose';
import { NOTIFICATION_TYPES } from '@playloop/shared';

const { ObjectId } = mongoose.Schema.Types;

const notificationSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    message: { type: String, required: true },
    link: { type: String, required: true },
    actor: { type: ObjectId, ref: 'User' },
    game: { type: ObjectId, ref: 'Game' },
    review: { type: ObjectId, ref: 'Review' },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1 });

export const Notification = mongoose.model('Notification', notificationSchema);
