import { queueMutation, cacheResponse, getCachedResponse, getQueuedMutations, removeQueuedMutation } from '../lib/offlineDb.js';

const BASE = '/api';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, isFormData = false } = {}) {
  const url = `${BASE}${path}`;
  const isWrite = method !== 'GET';

  // If offline and this is a write, queue it and optimistically return
  if (isWrite && !navigator.onLine) {
    await queueMutation({ url, method, body });
    return { queued: true };
  }

  try {
    const res = await fetch(url, {
      method,
      headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
      credentials: 'include',
    });

    if (res.status === 401) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(data.error || 'Unauthorized', 401);
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
    }

    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : await res.blob();

    if (!isWrite && contentType.includes('application/json')) {
      cacheResponse(url, data).catch(() => {});
    }

    return data;
  } catch (err) {
    // Network failure (not HTTP error): fall back to cache for GET, queue for writes
    if (err instanceof ApiError) throw err;

    if (isWrite) {
      await queueMutation({ url, method, body });
      return { queued: true };
    }

    const cached = await getCachedResponse(url);
    if (cached !== undefined) return cached;

    throw new ApiError('Network error and no cached data available', 0);
  }
}

export const api = {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path, body) => request(path, { method: 'DELETE', body }),
  upload: (path, formData) => request(path, { method: 'POST', body: formData, isFormData: true }),
};

/** Replay any queued offline mutations. Call on regaining connectivity. */
export async function syncOutbox() {
  const queued = await getQueuedMutations();
  let succeeded = 0, failed = 0;

  for (const item of queued) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: item.body ? JSON.stringify(item.body) : undefined,
        credentials: 'include',
      });
      if (res.ok) {
        await removeQueuedMutation(item.id);
        succeeded++;
      } else {
        failed++;
      }
    } catch {
      // Still offline - stop trying for now
      break;
    }
  }

  return { succeeded, failed, remaining: (await getQueuedMutations()).length };
}

export { ApiError };
