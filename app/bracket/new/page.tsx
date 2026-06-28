'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ROUND_OF_32, TEAM_FLAGS, applyPick } from '@/lib/bracket';
import { emptyPicks } from '@/lib/scoring';
import { Picks } from '@/lib/types';

const ROUND_KEYS = ['r0', 'r1', 'r2', 'r3', 'r4'] as const;
const ROUND_LABELS = ['Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals', 'Final'];
const ROUND_SHORT  = ['R32', 'R16', 'QF', 'SF', 'Final'];
const ROUND_SIZES  = [16, 8, 4, 2, 1];
const ROUND_PTS    = [1, 2, 4, 8, 16];

// ─── TeamRow ─────────────────────────────────────
function TeamRow({
  team, picked, dimmed, onClick,
}: {
  team: string | null; picked: boolean; dimmed: boolean; onClick: () => void;
}) {
  if (!team) {
    return (
      <div className="px-4 py-3.5 flex items-center gap-3">
        <span className="w-8 h-8 rounded-full bg-[#1a3060] flex items-center justify-center text-[#4a5568] text-sm">?</span>
        <span className="text-[#4a5568] text-sm italic">TBD</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ borderLeft: picked ? '3px solid #FFD700' : '3px solid transparent' }}
      className={`w-full px-4 py-3.5 flex items-center gap-3 text-left transition-all ${
        picked   ? 'bg-[#FFD700]/10' :
        dimmed   ? 'opacity-35' :
        'hover:bg-[#1a3a60]/30 active:bg-[#1a3a60]/50'
      }`}
    >
      <span className="text-2xl leading-none flex-shrink-0 w-8 text-center">
        {TEAM_FLAGS[team] || '🏳️'}
      </span>
      <span className={`font-bold text-sm flex-1 leading-tight ${picked ? 'text-[#FFD700]' : 'text-white'}`}>
        {team}
      </span>
      {picked && (
        <span className="w-5 h-5 rounded-full bg-[#FFD700] flex items-center justify-center flex-shrink-0 text-[#050d1a] text-xs font-black">
          ✓
        </span>
      )}
    </button>
  );
}

// ─── MatchCard ────────────────────────────────────
function MatchCard({
  index, teamA, teamB, pick, date, onPick,
}: {
  index: number; teamA: string | null; teamB: string | null;
  pick: string | null; date: string | null; onPick: (t: string) => void;
}) {
  return (
    <div className="bg-[#0f2040] border border-[#1a3a60] rounded-xl overflow-hidden">
      <div className="px-4 pt-2.5 pb-1 flex items-center justify-between">
        <span className="text-[10px] text-[#4a6a90] font-semibold uppercase tracking-wider">
          Match {index + 1}{date ? ` · ${date}` : ''}
        </span>
        {pick && <span className="text-[10px] text-[#FFD700] font-bold">✓ Picked</span>}
      </div>
      <TeamRow
        team={teamA}
        picked={pick === teamA && teamA !== null}
        dimmed={!!pick && pick !== teamA && teamA !== null}
        onClick={() => teamA && onPick(teamA)}
      />
      <div className="border-t border-[#1a3060]" />
      <TeamRow
        team={teamB}
        picked={pick === teamB && teamB !== null}
        dimmed={!!pick && pick !== teamB && teamB !== null}
        onClick={() => teamB && onPick(teamB)}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────
export default function NewBracketPage() {
  const router = useRouter();
  const topRef = useRef<HTMLDivElement>(null);
  const [name, setName]           = useState('');
  const [picks, setPicks]         = useState<Picks>(emptyPicks());
  const [activeRound, setRound]   = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');

  function getMatchTeams(round: number, i: number): [string | null, string | null] {
    if (round === 0) return [ROUND_OF_32[i].home, ROUND_OF_32[i].away];
    const prev = ROUND_KEYS[round - 1];
    return [picks[prev][i * 2] || null, picks[prev][i * 2 + 1] || null];
  }

  function handlePick(round: number, i: number, team: string) {
    setPicks(prev => applyPick(prev, round, i, team));
  }

  function scrollTop() {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const totalPicks = ROUND_KEYS.reduce((s, k) => s + picks[k].filter(Boolean).length, 0);
  const roundCount = (r: number) => picks[ROUND_KEYS[r]].filter(Boolean).length;
  const roundDone  = (r: number) => roundCount(r) === ROUND_SIZES[r];

  async function handleSubmit() {
    setError('');
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (totalPicks < 31) { setError(`Complete all picks first (${31 - totalPicks} remaining)`); return; }
    setSubmitting(true);
    try {
      const res  = await fetch('/api/brackets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), picks }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Submission failed'); setSubmitting(false); return; }
      router.push(`/bracket/${data.id}?new=1`);
    } catch {
      setError('Network error — please try again');
      setSubmitting(false);
    }
  }

  return (
    <div ref={topRef} className="space-y-5 max-w-lg mx-auto">

      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl font-black text-white">🏆 Fill Out Your Bracket</h1>
        <p className="text-[#8899aa] text-sm mt-1">Tap a team to pick the winner</p>
      </div>

      {/* Overall progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-[#8899aa]">
          <span>Overall Progress</span>
          <span className={totalPicks === 31 ? 'text-green-400 font-bold' : ''}>
            {totalPicks}/31 picks
          </span>
        </div>
        <div className="h-1.5 bg-[#050d1a] rounded-full border border-[#1a3a60] overflow-hidden">
          <div
            className="h-full bg-[#FFD700] rounded-full transition-all duration-300"
            style={{ width: `${(totalPicks / 31) * 100}%` }}
          />
        </div>
      </div>

      {/* Round tabs */}
      <div className="flex gap-1.5">
        {ROUND_SHORT.map((label, r) => {
          const done   = roundDone(r);
          const active = activeRound === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => { setRound(r); scrollTop(); }}
              className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all border ${
                active ? 'bg-[#FFD700] text-[#050d1a] border-[#FFD700]' :
                done   ? 'bg-[#0a2030] text-green-400 border-green-700' :
                         'bg-[#0a2030] text-[#8899aa] border-[#1a3a60]'
              }`}
            >
              {done && !active ? '✓' : label}
            </button>
          );
        })}
      </div>

      {/* Round header */}
      <div>
        <h2 className="text-white font-black text-lg">{ROUND_LABELS[activeRound]}</h2>
        <p className="text-[#4a6a90] text-xs">
          {ROUND_PTS[activeRound]} pt{ROUND_PTS[activeRound] > 1 ? 's' : ''} per correct pick ·{' '}
          <span className={roundDone(activeRound) ? 'text-green-400' : 'text-[#8899aa]'}>
            {roundCount(activeRound)}/{ROUND_SIZES[activeRound]} picked
          </span>
        </p>
      </div>

      {/* Match cards */}
      <div className="space-y-3">
        {Array.from({ length: ROUND_SIZES[activeRound] }, (_, i) => {
          const [teamA, teamB] = getMatchTeams(activeRound, i);
          return (
            <MatchCard
              key={i}
              index={i}
              teamA={teamA}
              teamB={teamB}
              pick={picks[ROUND_KEYS[activeRound]][i] || null}
              date={activeRound === 0 ? ROUND_OF_32[i].date : null}
              onPick={team => handlePick(activeRound, i, team)}
            />
          );
        })}
      </div>

      {/* Round navigation */}
      <div className="flex gap-3">
        {activeRound > 0 && (
          <button
            type="button"
            onClick={() => { setRound(r => r - 1); scrollTop(); }}
            className="flex-1 py-3 rounded-xl border border-[#1a3a60] text-[#8899aa] text-sm font-bold hover:border-[#4a6a90] hover:text-white transition-colors"
          >
            ← {ROUND_SHORT[activeRound - 1]}
          </button>
        )}
        {activeRound < 4 && (
          <button
            type="button"
            onClick={() => { setRound(r => r + 1); scrollTop(); }}
            disabled={!roundDone(activeRound)}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${
              roundDone(activeRound)
                ? 'bg-[#1a4a70] text-white hover:bg-[#2a5a90] border border-[#2a6a90]'
                : 'bg-[#050d1a] text-[#3a4a5a] border border-[#1a2a40] cursor-not-allowed'
            }`}
          >
            {roundDone(activeRound)
              ? `Next: ${ROUND_SHORT[activeRound + 1]} →`
              : `${ROUND_SIZES[activeRound] - roundCount(activeRound)} picks remaining`}
          </button>
        )}
      </div>

      {/* Champion banner */}
      {picks.champion && (
        <div className="bg-[#FFD700]/10 border border-[#FFD700] rounded-xl p-4 text-center">
          <p className="text-[#FFD700] font-black text-base">
            🏆 {TEAM_FLAGS[picks.champion] || ''} {picks.champion} wins it all!
          </p>
          <p className="text-[#8899aa] text-xs mt-1">Correct champion = +32 bonus points</p>
        </div>
      )}

      {/* Name + Submit */}
      <div className="bg-[#0f2040] border border-[#1a3a60] rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-[#FFD700] font-bold mb-2 text-sm uppercase tracking-wide">
            👤 Your Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Sofia, Danny, Mom..."
            maxLength={50}
            className="w-full bg-[#050d1a] border border-[#1a3a60] rounded-lg px-4 py-3 text-white text-lg font-semibold placeholder-[#4a5568] focus:outline-none focus:border-[#FFD700] transition-colors"
          />
          {name && (
            <p className="text-[#8899aa] text-xs mt-1">
              Bracket: <span className="text-white font-semibold">🏆 {name}&apos;s Bracket</span>
            </p>
          )}
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || totalPicks < 31 || !name.trim()}
          className="w-full bg-[#FFD700] text-[#050d1a] font-black text-lg py-3.5 rounded-xl hover:bg-[#FFE57F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? '⏳ Submitting...'
            : totalPicks < 31
            ? `Complete All Picks (${31 - totalPicks} left)`
            : '🏆 Submit My Bracket!'}
        </button>
      </div>

    </div>
  );
}
