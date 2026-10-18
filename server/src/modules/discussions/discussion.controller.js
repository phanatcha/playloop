import * as discussions from './discussion.service.js';

export async function listReplies(req, res) {
  const { review, reactions, ...page } = await discussions.listReplies(
    req.params.reviewId,
    req.user?.id,
    req.query,
  );
  res.json({
    ...page,
    items: page.items.map((reply) =>
      discussions.toReply(reply, review, reactions.get(reply.id) ?? []),
    ),
  });
}

export async function createReply(req, res) {
  const { reply, review } = await discussions.createReply(
    req.params.reviewId,
    req.user.id,
    req.body.body,
  );
  res.status(201).json(discussions.toReply(reply, review));
}

export async function updateReply(req, res) {
  const { reply, review, reactions } = await discussions.updateReply(
    req.params.replyId,
    req.user.id,
    req.body.body,
  );
  res.json(discussions.toReply(reply, review, reactions));
}

export async function deleteReply(req, res) {
  await discussions.deleteReply(req.params.replyId, req.user.id);
  res.status(204).end();
}

export async function addReaction(req, res) {
  const { targetType, targetId, emoji } = req.params;
  res.json(await discussions.addReaction(targetType, targetId, emoji, req.user.id));
}

export async function removeReaction(req, res) {
  const { targetType, targetId, emoji } = req.params;
  res.json(await discussions.removeReaction(targetType, targetId, emoji, req.user.id));
}
