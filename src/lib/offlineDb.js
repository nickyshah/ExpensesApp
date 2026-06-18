import { openDB } from 'idb';

const DB_NAME = 'expenses-app-offline';
const DB_VERSION = 1;

let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Queue of mutations made while offline, replayed when back online
        if (!db.objectStoreNames.contains('outbox')) {
          db.createStore?.('outbox', { keyPath: 'id', autoIncrement: true });
        }
        const outbox = db.objectStoreNames.contains('outbox')
          ? null
          : db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });

        // Cache of last-known GET responses, keyed by request URL
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'url' });
        }
      },
    });
  }
  return dbPromise;
}

/** Queue a write (POST/PUT/DELETE) to be replayed when back online */
export async function queueMutation({ url, method, body }) {
  const db = await getDb();
  await db.add('outbox', { url, method, body, createdAt: Date.now() });
}

/** Get all queued mutations in order */
export async function getQueuedMutations() {
  const db = await getDb();
  return db.getAll('outbox');
}

/** Remove a queued mutation by its id */
export async function removeQueuedMutation(id) {
  const db = await getDb();
  await db.delete('outbox', id);
}

/** Cache a GET response for offline viewing */
export async function cacheResponse(url, data) {
  const db = await getDb();
  await db.put('cache', { url, data, cachedAt: Date.now() });
}

/** Retrieve a cached GET response */
export async function getCachedResponse(url) {
  const db = await getDb();
  const row = await db.get('cache', url);
  return row?.data;
}

/** Count of pending offline mutations (for UI indicator) */
export async function getPendingCount() {
  const db = await getDb();
  return db.count('outbox');
}
