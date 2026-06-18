import crypto from 'crypto';

const COOKIE_NAME = 'expenses_app_session';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

function getSecret() {
  const secret = process.env.SESSION_SECRET || process.env.DATABASE_URL;
  if (!secret) throw new Error('SESSION_SECRET or DATABASE_URL must be set');
  return secret;
}

export function createSessionToken() {
  const payload = JSON.stringify({ exp: Date.now() + COOKIE_MAX_AGE * 1000 });
  const data = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token) return false;
  const [data, sig] = token.split('.');
  if (!data || !sig) return false;
  const expected = crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
  if (sig !== expected) return false;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    return payload.exp > Date.now();
  } catch {
    return false;
  }
}

export { COOKIE_NAME, COOKIE_MAX_AGE };
