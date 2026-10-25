import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../modules/users/user.model.js';
import { ApiError } from '../utils/ApiError.js';

export const SESSION_COOKIE = 'playloop_token';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax',
  path: '/',
});

export function signSessionToken(user) {
  return jwt.sign({ sub: user._id.toString() }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

export function setSessionCookie(res, user) {
  res.cookie(SESSION_COOKIE, signSessionToken(user), { ...cookieOptions(), maxAge: WEEK_MS });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export async function requireAdmin(req, res, next) {
  await requireAuth(req, res, () => {});
  if (req.user.role !== 'admin') throw ApiError.forbidden();
  next();
}

async function loadUser(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  try {
    const { sub } = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    return await User.findById(sub).select('role status suspension');
  } catch {
    return null;
  }
}

export function accountBlockMessage(user) {
  if (user.status === 'banned') return 'Your account has been banned';
  if (user.status !== 'suspended') return null;
  const until = user.suspension?.until;
  if (!until) return 'Your account is suspended';
  if (until > new Date())
    return `Your account is suspended until ${until.toISOString().slice(0, 10)}`;
  return null;
}

export async function requireAuth(req, _res, next) {
  const user = await loadUser(req);
  if (!user) throw ApiError.unauthorized();
  const reason = accountBlockMessage(user);
  if (reason) throw ApiError.forbidden(reason);
  req.user = { id: user._id.toString(), role: user.role };
  next();
}

export async function optionalAuth(req, _res, next) {
  const user = await loadUser(req);
  req.user =
    user && !accountBlockMessage(user) ? { id: user._id.toString(), role: user.role } : null;
  next();
}
