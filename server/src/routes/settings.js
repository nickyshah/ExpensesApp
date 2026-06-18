import express from 'express';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ValidationError, requireFields } from '../utils/validators.js';
import { getSetting, setSetting } from '../lib/settings.js';

const router = express.Router();

router.get('/public', asyncHandler(async (req, res) => {
  res.json({
    pinEnabled: (await getSetting('pin_enabled')) === '1',
    theme: (await getSetting('theme')) || 'system',
    currency: (await getSetting('currency')) || 'AUD',
    locale: (await getSetting('locale')) || 'en-AU',
  });
}));

router.get('/', asyncHandler(async (req, res) => {
  res.json({
    pinEnabled: (await getSetting('pin_enabled')) === '1',
    theme: (await getSetting('theme')) || 'system',
    currency: (await getSetting('currency')) || 'AUD',
    locale: (await getSetting('locale')) || 'en-AU',
  });
}));

router.put('/', asyncHandler(async (req, res) => {
  const { theme, currency, locale } = req.body;
  if (theme && !['light', 'dark', 'system'].includes(theme)) throw new ValidationError('invalid theme');
  if (theme) await setSetting('theme', theme);
  if (currency) await setSetting('currency', currency);
  if (locale) await setSetting('locale', locale);
  res.json({ success: true });
}));

router.post('/pin', asyncHandler(async (req, res) => {
  const { pin } = req.body;
  requireFields(req.body, ['pin']);
  if (!/^\d{4,8}$/.test(pin)) throw new ValidationError('PIN must be 4-8 digits');

  const hash = bcrypt.hashSync(pin, 10);
  await setSetting('pin_hash', hash);
  await setSetting('pin_enabled', '1');
  res.json({ success: true });
}));

router.delete('/pin', asyncHandler(async (req, res) => {
  const { pin } = req.body;
  requireFields(req.body, ['pin']);
  const hash = await getSetting('pin_hash');
  if (!hash || !bcrypt.compareSync(pin, hash)) throw new ValidationError('Incorrect PIN');

  await setSetting('pin_enabled', '0');
  await setSetting('pin_hash', '');
  res.json({ success: true });
}));

export default router;
