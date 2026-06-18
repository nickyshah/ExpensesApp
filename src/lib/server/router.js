import { routes } from './handlers.js';
import { createContext, requireAuth, handleError } from './http.js';
import { seed } from './seed.js';

let seeded = false;

async function ensureSeeded() {
  if (seeded) return;
  try {
    await seed();
    seeded = true;
  } catch (err) {
    console.error('Seed failed:', err);
  }
}

function matchRoute(method, path) {
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = path.match(route.pattern);
    if (!match) continue;
    const params = {};
    if (route.params) {
      route.params.forEach((name, i) => {
        params[name] = match[i + 1];
      });
    }
    return { handler: route.handler, params };
  }
  return null;
}

export async function dispatch(request, segments = []) {
  await ensureSeeded();

  const path = `/${segments.join('/')}`.replace(/\/$/, '') || '/';
  const ctx = await createContext(request, segments);
  ctx.path = `/api${path}`;

  const authResponse = await requireAuth(ctx);
  if (authResponse) return authResponse;

  const matched = matchRoute(request.method, path);
  if (!matched) {
    return ctx.jsonResponse({ error: 'Not found' }, 404);
  }

  ctx.params = matched.params;

  try {
    return await matched.handler(ctx);
  } catch (err) {
    return handleError(err);
  }
}
