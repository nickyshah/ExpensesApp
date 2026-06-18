import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireFields, ValidationError } from '../utils/validators.js';
import { activeSessions } from '../middleware/auth.js';
import { getSetting } from '../lib/settings.js';

const router = express.Router();

const COOKIE_NAME = 'expenses_app_session';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

router.get('/status', asyncHandler(async (req, res) => {
  const pinEnabled = (await getSetting('pin_enabled')) === '1';
  if (!pinEnabled) return res.json({ pinEnabled: false, authenticated: true });

  const token = req.cookies?.[COOKIE_NAME];
  const authenticated = !!(token && activeSessions.has(token));
  res.json({ pinEnabled: true, authenticated });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { pin } = req.body;
  requireFields(req.body, ['pin']);

  const pinEnabled = (await getSetting('pin_enabled')) === '1';
  if (!pinEnabled) return res.json({ success: true });

  const hash = await getSetting('pin_hash');
  if (!hash || !bcrypt.compareSync(String(pin), hash)) {
    throw new ValidationError('Incorrect PIN');
  }

  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.add(token);

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
  });
  res.json({ success: true });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) activeSessions.delete(token);
  res.clearCookie(COOKIE_NAME);
  res.json({ success: true });
}));

export default router;
