import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ValidationError } from './utils/validators.js';
import { getSetting } from './lib/settings.js';
import { verifySessionToken, COOKIE_NAME, COOKIE_MAX_AGE } from './session.js';

const PUBLIC_PREFIXES = ['/api/auth', '/api/settings/public', '/api/health'];

export async function createContext(request, segments = []) {
  const url = new URL(request.url);
  const path = `/api/${segments.join('/')}`.replace(/\/$/, '') || '/api';
  const query = Object.fromEntries(url.searchParams);

  let bodyCache;
  let formCache;

  const ctx = {
    request,
    path,
    query,
    params: {},

    async json() {
      if (bodyCache === undefined) {
        bodyCache = await request.json().catch(() => ({}));
      }
      return bodyCache;
    },

    async formData() {
      if (formCache === undefined) {
        formCache = await request.formData();
      }
      return formCache;
    },

    async cookie(name) {
      const jar = await cookies();
      return jar.get(name)?.value;
    },

    jsonResponse(data, status = 200) {
      return NextResponse.json(data, { status });
    },

    textResponse(text, status = 200, headers = {}) {
      return new NextResponse(text, { status, headers });
    },

    setSessionCookie(token) {
      const res = NextResponse.json({ success: true });
      res.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
      });
      return res;
    },

    withSessionCookie(response, token) {
      response.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
      });
      return response;
    },

    clearSessionCookie(data = { success: true }) {
      const res = NextResponse.json(data);
      res.cookies.set(COOKIE_NAME, '', { httpOnly: true, maxAge: 0, path: '/' });
      return res;
    },
  };

  return ctx;
}

export async function requireAuth(ctx) {
  const isPublic = PUBLIC_PREFIXES.some((p) => ctx.path === p || ctx.path.startsWith(`${p}/`));
  if (isPublic) return null;

  const pinEnabled = (await getSetting('pin_enabled')) === '1';
  if (!pinEnabled) return null;

  const token = await ctx.cookie(COOKIE_NAME);
  if (token && verifySessionToken(token)) return null;

  return ctx.jsonResponse({ error: 'unauthorized', pinRequired: true }, 401);
}

export function handleError(err) {
  console.error(err);
  const status = err.status || (err instanceof ValidationError ? 400 : 500);
  return NextResponse.json(
    { error: err.message || 'Internal server error' },
    { status },
  );
}
