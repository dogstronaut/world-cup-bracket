import { Bracket, Results, SyncLogEntry, RecapEntry } from './types';
import { emptyResults } from './scoring';
import { ROUND_OF_32 } from './bracket';

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
  getObj: <T>(k: string): T | null => {
    const s = _data.get(k);
    return s ? JSON.parse(s) as T : null;
  },
  setObj: (k: string, v: unknown): void => { _data.set(k, JSON.stringify(v)); },
  del:    (k: string): void => { _data.delete(k); _sets.delete(k); },
  sadd:   (k: string, v: string): void => {
    if (!_sets.has(k)) _sets.set(k, new Set());
    _sets.get(k)!.add(v);
  },
  srem:      (k: string, v: string): void => { _sets.get(k)?.delete(v); },
  smembers:  (k: string): string[] => Array.from(_sets.get(k) ?? []),
};

// ---------- KV helpers ----------
// @vercel/kv auto-deserializes stored JSON, so we use native object storage
// (no JSON.stringify/parse at the call sites).

async function kvGetObj<T>(key: string): Promise<T | null> {
  if (USE_MEMORY) return mem.getObj<T>(key);
  const { kv } = await import('@vercel/kv');
  return kv.get<T>(key);
}

async function kvSetObj(key: string, value: unknown): Promise<void> {
  if (USE_MEMORY) { mem.setObj(key, value); return; }
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
const RESULTS_KEY      = 'results';
const SYNC_LOG_KEY     = 'sync_log';
const LAST_SYNC_KEY    = 'last_sync';

// ---------- Bracket operations ----------
export async function saveBracket(bracket: Bracket): Promise<void> {
  await Promise.all([
    kvSetObj(`bracket:${bracket.id}`, bracket),
    kvSadd(BRACKETS_SET_KEY, bracket.id),
  ]);
}

export async function getBracket(id: string): Promise<Bracket | null> {
  return kvGetObj<Bracket>(`bracket:${id}`);
}

export async function getAllBrackets(): Promise<Bracket[]> {
  const ids = await kvSmembers(BRACKETS_SET_KEY);
  if (!ids || ids.length === 0) return [];
  const brackets = await Promise.all(ids.map(id => kvGetObj<Bracket>(`bracket:${id}`)));
  return (brackets.filter(Boolean) as Bracket[])
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function updateBracketName(id: string, name: string): Promise<void> {
  const bracket = await getBracket(id);
  if (!bracket) return;
  await kvSetObj(`bracket:${id}`, { ...bracket, name });
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
  const data = await kvGetObj<Results>(RESULTS_KEY);
  if (!data) return emptyResults();
  const results: Results = { ...emptyResults(), ...data };

  // Sanitize R32: clear any winner that isn't one of the two teams in that slot.
  // This auto-corrects bad data written by a hallucinating sync.
  let dirty = false;
  for (let i = 0; i < 16; i++) {
    const winner = results.r0[i];
    if (winner !== null) {
      const { home, away } = ROUND_OF_32[i];
      if (winner !== home && winner !== away) {
        results.r0[i] = null;
        dirty = true;
      }
    }
  }
  if (dirty) await kvSetObj(RESULTS_KEY, results);

  return results;
}

export async function saveResults(results: Results): Promise<void> {
  await kvSetObj(RESULTS_KEY, results);
}

export async function resetResults(): Promise<void> {
  await kvSetObj(RESULTS_KEY, emptyResults());
}

// ---------- Sync log operations ----------
export async function addSyncLog(entry: SyncLogEntry): Promise<void> {
  const log = (await kvGetObj<SyncLogEntry[]>(SYNC_LOG_KEY)) ?? [];
  log.unshift(entry);
  await Promise.all([
    kvSetObj(SYNC_LOG_KEY, log.slice(0, 50)),
    kvSetObj(LAST_SYNC_KEY, entry.timestamp),
  ]);
}

export async function getSyncLog(): Promise<SyncLogEntry[]> {
  return (await kvGetObj<SyncLogEntry[]>(SYNC_LOG_KEY)) ?? [];
}

export async function getLastSync(): Promise<string | null> {
  return kvGetObj<string>(LAST_SYNC_KEY);
}

// ---------- Recap operations ----------
const RECAPS_SET_KEY = 'recaps';

export async function saveRecap(recap: RecapEntry): Promise<void> {
  await Promise.all([
    kvSetObj(`recap:${recap.date}`, recap),
    kvSadd(RECAPS_SET_KEY, recap.date),
  ]);
}

export async function getRecap(date: string): Promise<RecapEntry | null> {
  return kvGetObj<RecapEntry>(`recap:${date}`);
}

export async function getAllRecaps(): Promise<RecapEntry[]> {
  const dates = await kvSmembers(RECAPS_SET_KEY);
  if (!dates || dates.length === 0) return [];
  const recaps = await Promise.all(dates.map(date => kvGetObj<RecapEntry>(`recap:${date}`)));
  return (recaps.filter(Boolean) as RecapEntry[])
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function deleteRecap(date: string): Promise<void> {
  await Promise.all([
    kvDel(`recap:${date}`),
    kvSrem(RECAPS_SET_KEY, date),
  ]);
}
