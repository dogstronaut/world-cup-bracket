import { Bracket, Results, SyncLogEntry } from './types';
import { emptyResults } from './scoring';

// Use in-memory store when Vercel KV is not configured (local dev / testing)
const USE_MEMORY = !(process.env.KV_REST_API_URL || process.env.KV_URL);

// ---------- In-memory store (anchored to globalThis to survive Next.js HMR) ----------
const g = globalThis as typeof globalThis & {
  _wcbData?: Map<string, string>;
  _wcbSets?: Map<string, Set<string>>;
};
if (!g._wcbData) g._wcbData = new Map<string, string>();
if (!g._wcbSets) g._wcbSets = new Map<string, Set<string>>();
const _data = g._wcbData;
const _sets = g._wcbSets;

const mem = {
  get: (k: string): string | null => _data.get(k) ?? null,
  set: (k: string, v: string): void => { _data.set(k, v); },
  del: (k: string): void => { _data.delete(k); _sets.delete(k); },
  sadd: (k: string, v: string): void => {
    if (!_sets.has(k)) _sets.set(k, new Set());
    _sets.get(k)!.add(v);
  },
  srem: (k: string, v: string): void => { _sets.get(k)?.delete(v); },
  smembers: (k: string): string[] => Array.from(_sets.get(k) ?? []),
};

// ---------- KV helpers (lazily imported to avoid errors when not configured) ----------
async function kvGet(key: string): Promise<string | null> {
  if (USE_MEMORY) return mem.get(key);
  const { kv } = await import('@vercel/kv');
  return kv.get<string>(key);
}

async function kvSet(key: string, value: string): Promise<void> {
  if (USE_MEMORY) { mem.set(key, value); return; }
  const { kv } = await import('@vercel/kv');
  await kv.set(key, value);
}

async function kvDel(key: string): Promise<void> {
  if (USE_MEMORY) { mem.del(key); return; }
  const { kv } = await import('@vercel/kv');
  await kv.del(key);
}

async function kvSadd(key: string, value: string): Promise<void> {
  if (USE_MEMORY) { mem.sadd(key, value); return; }
  const { kv } = await import('@vercel/kv');
  await kv.sadd(key, value);
}

async function kvSrem(key: string, value: string): Promise<void> {
  if (USE_MEMORY) { mem.srem(key, value); return; }
  const { kv } = await import('@vercel/kv');
  await kv.srem(key, value);
}

async function kvSmembers(key: string): Promise<string[]> {
  if (USE_MEMORY) return mem.smembers(key);
  const { kv } = await import('@vercel/kv');
  return kv.smembers(key);
}

// ---------- Constants ----------
const BRACKETS_SET_KEY = 'brackets';
const RESULTS_KEY = 'results';
const SYNC_LOG_KEY = 'sync_log';
const LAST_SYNC_KEY = 'last_sync';

// ---------- Bracket operations ----------
export async function saveBracket(bracket: Bracket): Promise<void> {
  await Promise.all([
    kvSet(`bracket:${bracket.id}`, JSON.stringify(bracket)),
    kvSadd(BRACKETS_SET_KEY, bracket.id),
  ]);
}

export async function getBracket(id: string): Promise<Bracket | null> {
  const data = await kvGet(`bracket:${id}`);
  if (!data) return null;
  return JSON.parse(data) as Bracket;
}

export async function getAllBrackets(): Promise<Bracket[]> {
  const ids = await kvSmembers(BRACKETS_SET_KEY);
  if (!ids || ids.length === 0) return [];
  const bracketData = await Promise.all(ids.map(id => kvGet(`bracket:${id}`)));
  return (bracketData.filter(Boolean) as string[])
    .map(d => JSON.parse(d) as Bracket)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function deleteBracket(id: string): Promise<void> {
  await Promise.all([
    kvDel(`bracket:${id}`),
    kvSrem(BRACKETS_SET_KEY, id),
  ]);
}

export async function deleteAllBrackets(): Promise<void> {
  const ids = await kvSmembers(BRACKETS_SET_KEY);
  if (ids && ids.length > 0) {
    await Promise.all([
      ...ids.map(id => kvDel(`bracket:${id}`)),
      kvDel(BRACKETS_SET_KEY),
    ]);
  }
}

// ---------- Results operations ----------
export async function getResults(): Promise<Results> {
  const data = await kvGet(RESULTS_KEY);
  if (!data) return emptyResults();
  return { ...emptyResults(), ...JSON.parse(data) };
}

export async function saveResults(results: Results): Promise<void> {
  await kvSet(RESULTS_KEY, JSON.stringify(results));
}

export async function resetResults(): Promise<void> {
  await kvSet(RESULTS_KEY, JSON.stringify(emptyResults()));
}

// ---------- Sync log operations ----------
export async function addSyncLog(entry: SyncLogEntry): Promise<void> {
  const existing = await kvGet(SYNC_LOG_KEY);
  const log: SyncLogEntry[] = existing ? JSON.parse(existing) : [];
  log.unshift(entry);
  await Promise.all([
    kvSet(SYNC_LOG_KEY, JSON.stringify(log.slice(0, 50))),
    kvSet(LAST_SYNC_KEY, entry.timestamp),
  ]);
}

export async function getSyncLog(): Promise<SyncLogEntry[]> {
  const data = await kvGet(SYNC_LOG_KEY);
  return data ? JSON.parse(data) : [];
}

export async function getLastSync(): Promise<string | null> {
  return kvGet(LAST_SYNC_KEY);
}
