'use client';
import { useState, useEffect, useCallback } from 'react';
import { ROUND_OF_32, ROUND_NAMES, ROUND_SIZES, ALL_TEAMS, TEAM_FLAGS } from '@/lib/bracket';
import { Results, SyncLogEntry, RecapEntry } from '@/lib/types';

const ROUND_KEYS = ['r0', 'r1', 'r2', 'r3', 'r4'] as const;

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');

  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [brackets, setBrackets] = useState<{ id: string; name: string; createdAt: string }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [recaps, setRecaps] = useState<RecapEntry[]>([]);
  const [recapDate, setRecapDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recapTitle, setRecapTitle] = useState('');
  const [recapBody, setRecapBody] = useState('');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const fetchAdminData = useCallback(async (pw: string) => {
    const res = await fetch('/api/admin', {
      headers: { Authorization: `Bearer ${pw}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    setSyncLog(data.syncLog || []);
    setLastSync(data.lastSync || null);
    setResults(data.results || null);
    setBrackets(data.brackets || []);
    setRecaps(data.recaps || []);
    return true;
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setLoading(true);
    const ok = await fetchAdminData(password);
    setLoading(false);
    if (ok) {
      setAuthed(true);
    } else {
      setAuthError('Incorrect password');
    }
  }

  async function adminAction(body: Record<string, unknown>) {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${password}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setActionMessage(data.message || data.error || 'Done');
    setTimeout(() => setActionMessage(''), 4000);
    await fetchAdminData(password);
    return data;
  }

  async function handleSync() {
    setSyncing(true);
    await adminAction({ action: 'trigger_sync' });
    setSyncing(false);
  }

  async function handleOverride(round: string, index: number, winner: string) {
    await adminAction({ action: 'override_result', round, index, winner: winner || null });
  }

  async function handleReset(action: string) {
    const label = action === 'reset_results' ? 'reset all results' : 'delete ALL brackets';
    if (!confirm(`Are you sure you want to ${label}? This cannot be undone.`)) return;
    await adminAction({ action });
  }

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-16">
        <div className="bg-[#0f2040] border border-[#1a3a60] rounded-xl p-6 space-y-4">
          <h1 className="text-xl font-black text-white text-center">🔐 Admin Panel</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full bg-[#050d1a] border border-[#1a3a60] rounded-lg px-4 py-3 text-white placeholder-[#4a5568] focus:outline-none focus:border-[#FFD700]"
            />
            {authError && <p className="text-red-400 text-sm">{authError}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FFD700] text-[#050d1a] font-black py-3 rounded-lg hover:bg-[#FFE57F] disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">🔐 Admin Panel</h1>
        {actionMessage && (
          <div className="bg-green-950 border border-green-700 text-green-300 text-sm px-4 py-2 rounded-lg">
            {actionMessage}
          </div>
        )}
      </div>

      {/* Sync section */}
      <div className="bg-[#0f2040] border border-[#1a3a60] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-white">🔄 Auto-Sync Results</h2>
            <p className="text-[#8899aa] text-sm">
              {lastSync
                ? `Last synced: ${new Date(lastSync).toLocaleString()}`
                : 'Never synced'}
            </p>
            <p className="text-[#8899aa] text-xs mt-1">Runs automatically every 30 minutes via Vercel Cron</p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-[#FFD700] text-[#050d1a] font-bold px-4 py-2 rounded-lg hover:bg-[#FFE57F] disabled:opacity-50 whitespace-nowrap"
          >
            {syncing ? '⏳ Syncing...' : '▶ Sync Now'}
          </button>
        </div>

        {/* Sync log */}
        {syncLog.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-[#8899aa] uppercase tracking-wide mb-2">Sync Log</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {syncLog.map((entry, i) => (
                <div
                  key={i}
                  className={`text-xs flex items-start gap-2 px-3 py-1.5 rounded ${
                    entry.success ? 'bg-green-950 text-green-300' : 'bg-red-950 text-red-300'
                  }`}
                >
                  <span className="text-[#8899aa] shrink-0">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                  <span>{entry.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Clean Results */}
      <div className="bg-[#0f2040] border border-[#FFD700]/30 rounded-xl p-5 space-y-3">
        <h2 className="font-bold text-white">🧹 Fix Bad Sync Data</h2>
        <p className="text-[#8899aa] text-sm">Clears any Round of 16 / QF / SF / Final results that were incorrectly synced before those matches were played. Keeps all real Round of 32 results intact.</p>
        <button
          onClick={() => adminAction({ action: 'clean_results' })}
          className="bg-[#FFD700] text-[#050d1a] font-black px-5 py-2.5 rounded-lg hover:bg-[#FFE57F] transition-colors"
        >
          🧹 Clean Invalid Results
        </button>
      </div>

      {/* Manual Override */}
      {results && (
        <div className="bg-[#0f2040] border border-[#1a3a60] rounded-xl p-5 space-y-5">
          <h2 className="font-bold text-white">🎯 Manual Result Override</h2>
          <p className="text-[#8899aa] text-sm">Override individual match results if auto-sync gets a team name wrong.</p>

          {ROUND_KEYS.map((roundKey, roundIdx) => (
            <div key={roundKey}>
              <h3 className="text-sm font-bold text-[#8899aa] uppercase tracking-wide mb-2">
                {ROUND_NAMES[roundIdx]}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Array.from({ length: ROUND_SIZES[roundIdx] }).map((_, i) => {
                  const label = roundIdx === 0
                    ? `${ROUND_OF_32[i].home} vs ${ROUND_OF_32[i].away}`
                    : `Match ${i + 1}`;
                  const options = roundIdx === 0
                    ? [ROUND_OF_32[i].home, ROUND_OF_32[i].away]
                    : ALL_TEAMS;

                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-[#8899aa] w-24 shrink-0 truncate">{label}</span>
                      <select
                        value={results[roundKey][i] || ''}
                        onChange={e => handleOverride(roundKey, i, e.target.value)}
                        className="flex-1 bg-[#050d1a] border border-[#1a3a60] rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-[#FFD700]"
                      >
                        <option value="">Not yet played</option>
                        {options.map(team => (
                          <option key={team} value={team}>{TEAM_FLAGS[team] || ''} {team}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Champion override */}
          <div>
            <h3 className="text-sm font-bold text-[#8899aa] uppercase tracking-wide mb-2">Champion</h3>
            <select
              value={results.champion || ''}
              onChange={e => adminAction({ action: 'override_result', round: 'r4', index: 0, winner: e.target.value || null }).then(() => handleOverride('r4', 0, e.target.value))}
              className="bg-[#050d1a] border border-[#1a3a60] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#FFD700]"
            >
              <option value="">Not yet decided</option>
              {ALL_TEAMS.map(team => (
                <option key={team} value={team}>{TEAM_FLAGS[team] || ''} {team}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Submitted Brackets */}
      <div className="bg-[#0f2040] border border-[#1a3a60] rounded-xl p-5 space-y-3">
        <h2 className="font-bold text-white">📋 Submitted Brackets ({brackets.length})</h2>
        {brackets.length === 0 ? (
          <p className="text-[#8899aa] text-sm">No brackets submitted yet.</p>
        ) : (
          <div className="space-y-2">
            {brackets.map(b => (
              <div key={b.id} className="bg-[#050d1a] border border-[#1a3a60] rounded-lg px-4 py-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{b.name}</p>
                    <p className="text-[#4a6a90] text-xs">{new Date(b.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => { setEditingId(b.id); setEditingName(b.name); }}
                      className="text-[#FFD700] hover:text-white text-xs font-bold border border-[#4a4a20] hover:border-[#FFD700] px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Rename
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete ${b.name}'s bracket? This cannot be undone.`)) return;
                        await adminAction({ action: 'delete_bracket', id: b.id });
                      }}
                      className="text-red-400 hover:text-red-300 text-xs font-bold border border-red-800 hover:border-red-600 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {editingId === b.id && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      maxLength={50}
                      className="flex-1 bg-[#0f2040] border border-[#FFD700] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none"
                      onKeyDown={async e => {
                        if (e.key === 'Enter') {
                          await adminAction({ action: 'rename_bracket', id: b.id, name: editingName });
                          setEditingId(null);
                        }
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                    />
                    <button
                      onClick={async () => {
                        await adminAction({ action: 'rename_bracket', id: b.id, name: editingName });
                        setEditingId(null);
                      }}
                      className="bg-[#FFD700] text-[#050d1a] text-xs font-black px-3 py-1.5 rounded-lg hover:bg-[#FFE57F]"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-[#8899aa] text-xs font-bold px-2 py-1.5"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Daily Recap */}
      <div className="bg-[#0f2040] border border-[#1a3a60] rounded-xl p-5 space-y-4">
        <h2 className="font-bold text-white">📰 Daily Recap</h2>
        <p className="text-[#8899aa] text-sm">Auto-generate a recap from live bracket data, or write one manually. Posts to the top of the homepage.</p>

        <div className="space-y-3">
          {/* Date picker */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#8899aa] uppercase tracking-wide">Date</label>
            <input
              type="date"
              value={recapDate}
              onChange={e => setRecapDate(e.target.value)}
              className="bg-[#050d1a] border border-[#1a3a60] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#FFD700]"
            />
          </div>

          {/* Auto-generate */}
          <button
            onClick={async () => {
              if (!recapDate) return;
              setGenerating(true);
              const data = await adminAction({ action: 'generate_recap', date: recapDate });
              if (data?.title) setRecapTitle(data.title);
              if (data?.body) setRecapBody(data.body);
              setGenerating(false);
            }}
            disabled={generating || !recapDate}
            className="w-full bg-[#FFD700] text-[#050d1a] font-black px-5 py-2.5 rounded-lg hover:bg-[#FFE57F] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? '✍️ Generating recap...' : '⚡ Auto-Generate & Post Recap'}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-[#1a3060]" />
            <span className="text-[#4a6a90] text-xs">or write manually</span>
            <div className="flex-1 border-t border-[#1a3060]" />
          </div>

          {/* Manual title + body */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#8899aa] uppercase tracking-wide">Title</label>
            <input
              type="text"
              value={recapTitle}
              onChange={e => setRecapTitle(e.target.value)}
              placeholder="e.g. Day 2: Brazil Dominates!"
              maxLength={120}
              className="w-full bg-[#050d1a] border border-[#1a3a60] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a5568] focus:outline-none focus:border-[#FFD700]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#8899aa] uppercase tracking-wide">Body</label>
            <textarea
              value={recapBody}
              onChange={e => setRecapBody(e.target.value)}
              placeholder="Recap body (auto-filled after generating, or type your own)..."
              rows={6}
              className="w-full bg-[#050d1a] border border-[#1a3a60] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a5568] focus:outline-none focus:border-[#FFD700] resize-y"
            />
          </div>
          <button
            onClick={async () => {
              if (!recapDate || !recapTitle.trim() || !recapBody.trim()) return;
              await adminAction({ action: 'save_recap', date: recapDate, title: recapTitle, body: recapBody });
              setRecapTitle('');
              setRecapBody('');
            }}
            disabled={!recapDate || !recapTitle.trim() || !recapBody.trim()}
            className="bg-[#1a4a70] text-white font-bold px-5 py-2 rounded-lg hover:bg-[#2a5a90] border border-[#2a6a90] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Save Manual Recap
          </button>
        </div>

        {recaps.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#1a3a60]">
            <h3 className="text-xs font-bold text-[#8899aa] uppercase tracking-wide">Saved Recaps</h3>
            {recaps.map(r => (
              <div key={r.date} className="bg-[#050d1a] border border-[#1a3a60] rounded-lg px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{r.title}</p>
                  <p className="text-[#4a6a90] text-xs">{r.date}</p>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete recap for ${r.date}? This cannot be undone.`)) return;
                    await adminAction({ action: 'delete_recap', date: r.date });
                  }}
                  className="text-red-400 hover:text-red-300 text-xs font-bold border border-red-800 hover:border-red-600 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-red-950 border border-red-800 rounded-xl p-5 space-y-4">
        <h2 className="font-bold text-red-300">⚠️ Danger Zone</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => handleReset('reset_results')}
            className="flex-1 bg-red-900 border border-red-700 text-red-200 font-bold px-4 py-2 rounded-lg hover:bg-red-800 transition-colors"
          >
            Reset All Results
          </button>
          <button
            onClick={() => handleReset('delete_all_brackets')}
            className="flex-1 bg-red-900 border border-red-700 text-red-200 font-bold px-4 py-2 rounded-lg hover:bg-red-800 transition-colors"
          >
            Delete All Brackets
          </button>
        </div>
        <p className="text-red-400 text-xs">These actions are irreversible. Use with caution.</p>
      </div>
    </div>
  );
}
