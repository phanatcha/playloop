import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const replySchema = new mongoose.Schema(
  {
    review: { type: ObjectId, ref: 'Review', required: true },
    author: { type: ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 1000 },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

replySchema.index({ review: 1, createdAt: 1 });

export const Reply = mongoose.model('Reply', replySchema);
