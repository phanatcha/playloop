import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User } from '../src/modules/users/user.model.js';
import { Notification } from '../src/modules/notifications/notification.model.js';
import { ReputationEvent } from '../src/modules/reputation/reputation-event.model.js';
import { createUser } from './helpers.js';

const app = createApp();
const now = new Date();
const lastMonthDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
const lastMonth = lastMonthDay.toISOString().slice(0, 7);

const earn = (user, points, createdAt) =>
  ReputationEvent.create({ user: user._id, points, kind: 'helpful_vote', createdAt });

const monthBadges = async (user) =>
  (await User.findById(user._id)).badges.filter((b) => b.key === 'reviewer_of_the_month');

describe('Reviewer of the Month', () => {
  it("goes once to last month's top reviewer, not this month's leader", async () => {
    const [runnerUp, winner, currentLeader] = await Promise.all([
      createUser(),
      createUser(),
      createUser(),
    ]);
    await earn(runnerUp, 10, lastMonthDay);
    await earn(winner, 25, lastMonthDay);
    await earn(currentLeader, 100, now);

    await Promise.all([
      request(app).get('/api/leaderboard'),
      request(app).get('/api/leaderboard?period=month'),
      request(app).get('/api/leaderboard?period=month'),
    ]);

    expect(await monthBadges(winner)).toEqual([
      expect.objectContaining({ key: 'reviewer_of_the_month', period: lastMonth }),
    ]);
    expect(await monthBadges(currentLeader)).toEqual([]);
    expect(await monthBadges(runnerUp)).toEqual([]);
    expect(
      await Notification.countDocuments({ user: winner._id, type: 'badge_awarded' }),
    ).toBeGreaterThanOrEqual(1);
    expect(
      await Notification.countDocuments({
        user: winner._id,
        message: `You earned Reviewer of the Month for ${lastMonth}`,
      }),
    ).toBe(1);
  });

  it("doesn't change hands once a month is awarded", async () => {
    const [winner, lateRiser] = await Promise.all([createUser(), createUser()]);
    await earn(winner, 25, lastMonthDay);
    await request(app).get('/api/leaderboard');

    await earn(lateRiser, 500, lastMonthDay);
    await request(app).get('/api/leaderboard');

    expect(await monthBadges(winner)).toHaveLength(1);
    expect(await monthBadges(lateRiser)).toEqual([]);
  });

  it('awards nobody when no one earned points last month', async () => {
    const user = await createUser();
    await earn(user, 40, now);
    await request(app).get('/api/leaderboard?period=month');
    expect(await monthBadges(user)).toEqual([]);
  });
});
