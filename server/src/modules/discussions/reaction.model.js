import mongoose from 'mongoose';
import { REACTION_EMOJIS, REACTION_TARGET_TYPES } from '@playloop/shared';

const { ObjectId } = mongoose.Schema.Types;

const reactionSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: REACTION_TARGET_TYPES, required: true },
    targetId: { type: ObjectId, required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    emoji: { type: String, enum: REACTION_EMOJIS, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

reactionSchema.index({ targetType: 1, targetId: 1, user: 1, emoji: 1 }, { unique: true });

export const Reaction = mongoose.model('Reaction', reactionSchema);
