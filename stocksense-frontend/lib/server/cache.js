const store = new Map();

export function readCache(key) {
  const entry = store.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expireAt <= Date.now()) {
    store.delete(key);
    return null;
  }

  return entry.value;
}

export function writeCache(key, value, ttlMs) {
  store.set(key, {
    value,
    expireAt: Date.now() + ttlMs,
  });
  return value;
}

export async function withCache(key, ttlMs, producer) {
  const cached = readCache(key);
  if (cached) {
    return cached;
  }

  const fresh = await producer();
  return writeCache(key, fresh, ttlMs);
}

