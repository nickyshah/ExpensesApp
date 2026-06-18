import { prisma } from '../db/prisma.js';

export const activeSessions = new Set();

export async function authMiddleware(req, res, next) {
  const setting = await prisma.setting.findUnique({ where: { key: 'pin_enabled' } });
  const pinEnabled = setting?.value === '1';
  if (!pinEnabled) return next();

  if (req.path.startsWith('/api/auth') || req.path.startsWith('/api/settings/public')) {
    return next();
  }

  const token = req.cookies?.expenses_app_session;
  if (token && activeSessions.has(token)) return next();

  return res.status(401).json({ error: 'unauthorized', pinRequired: true });
}
