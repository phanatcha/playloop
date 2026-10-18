import { levelFor } from '@playloop/shared';
import { mediaUrl } from '../../utils/mediaUrl.js';

export const USER_SUMMARY_FIELDS = 'username displayName avatarKey reputationPoints';

export function toUserSummary(user) {
  const { level, title } = levelFor(user.reputationPoints ?? 0);
  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName,
    avatarUrl: mediaUrl(user.avatarKey),
    level,
    levelTitle: title,
  };
}
