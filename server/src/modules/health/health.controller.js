import { dbState } from '../../config/db.js';

export function getHealth(_req, res) {
  res.json({ status: 'ok', db: dbState(), uptime: Math.round(process.uptime()) });
}
