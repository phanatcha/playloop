import { User } from '../src/modules/users/user.model.js';
import { SESSION_COOKIE, signSessionToken } from '../src/middleware/auth.js';

let count = 0;

export function createUser(overrides = {}) {
  count += 1;
  return User.create({
    username: `user${count}`,
    email: `user${count}@example.com`,
    passwordHash: 'not-a-real-hash',
    ...overrides,
  });
}

export const authCookie = (user) => `${SESSION_COOKIE}=${signSessionToken(user)}`;
