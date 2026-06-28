'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROUND_OF_32, ROUND_NAMES, ROUND_SIZES, TEAM_FLAGS, ROUND_POINTS, applyPick } from '@/lib/bracket';
import { emptyPicks } from '@/lib/scoring';
import { Picks } from '@/lib/types';

const ROUND_KEYS = ['r0', 'r1', 'r2', 'r3', 'r4'] as const;

export default function NewBracketPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [picks, setPicks] = useState<Picks>(emptyPicks());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Get the two teams for a match in a given round
  function getTeams(round: number, index: number): [string | null, string | null] {
    if (round === 0) {
      return [ROUND_OF_32[index].home, ROUND_OF_32[index].away];
    }
    const left = picks[ROUND_KEYS[round - 1]][index * 2] || null;
    const right = picks[ROUND_KEYS[round - 1]][index * 2 + 1] || null;
    return [left, right];
  }

  function handlePick(round: number, index: number, team: string) {
    setPicks(prev => applyPick(prev, round, index, team));
  }

  function countPicks(): number {
    let count = 0;
    for (const rk of ROUND_KEYS) count += picks[rk].filter(Boolean).length;
    return count;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (countPicks() < 31) { setError('Please complete all rounds before submitting'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/brackets', {
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

  const totalPicks = countPicks();
  const progress = Math.round((totalPicks / 31) * 100);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-black text-white">
          🏆 Fill Out Your Bracket
        </h1>
        <p className="text-[#8899aa]">Pick the winner of every match to complete your bracket</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Name input */}
        <div className="bg-[#0f2040] border border-[#1a3a60] rounded-xl p-5">
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
            <p className="text-[#8899aa] text-sm mt-2">
              Your bracket will be called: <span className="text-white font-bold">🏆 {name}'s Bracket</span>
            </p>
          )}
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-[#8899aa]">
            <span>Progress</span>
            <span className={totalPicks === 31 ? 'text-green-400 font-bold' : ''}>{totalPicks}/31 picks</span>
          </div>
          <div className="h-2 bg-[#050d1a] rounded-full overflow-hidden border border-[#1a3a60]">
            <div
              className="h-full bg-[#FFD700] transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Rounds */}
        {ROUND_KEYS.map((roundKey, roundIdx) => {
          const matchCount = ROUND_SIZES[roundIdx];
          const pts = ROUND_POINTS[roundIdx];
          const roundComplete = picks[roundKey].slice(0, matchCount).every(Boolean);

          return (
            <div key={roundKey} className="space-y-3">
              {/* Round header */}
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-black text-white">{ROUND_NAMES[roundIdx]}</h2>
                <span className="text-xs text-[#8899aa] bg-[#050d1a] border border-[#1a3a60] rounded-full px-2 py-0.5">
                  {pts} pt{pts !== 1 ? 's' : ''} each
                </span>
                {roundComplete && (
                  <span className="text-xs text-green-400 font-bold">✓ Complete</span>
                )}
              </div>

              {/* Matches */}
              <div className="space-y-2">
                {Array.from({ length: matchCount }).map((_, i) => {
                  const [teamA, teamB] = getTeams(roundIdx, i);
                  const currentPick = picks[roundKey][i];
                  const isLocked = !teamA || !teamB;

                  // Left/right half label for R32
                  const halfLabel = roundIdx === 0
                    ? (i < 8 ? '◀ Left half' : '▶ Right half')
                    : null;
                  const showHalfLabel = roundIdx === 0 && (i === 0 || i === 8);

                  return (
                    <div key={i}>
                      {showHalfLabel && (
                        <p className="text-xs text-[#8899aa] font-medium uppercase tracking-wide mb-1 mt-3">
                          {halfLabel}
                        </p>
                      )}
                      {isLocked ? (
                        <div className="bg-[#050d1a] border border-[#1a3060] rounded-lg px-4 py-3 flex items-center gap-2 opacity-50">
                          <span className="text-[#8899aa] text-sm">
                            🔒 Match {i + 1} — Complete previous round first
                          </span>
                        </div>
                      ) : (
                        <div className="bg-[#0f2040] border border-[#1a3a60] rounded-lg p-3">
                          {/* Match header for r32 */}
                          {roundIdx === 0 && (
                            <p className="text-xs text-[#8899aa] mb-2">
                              Match {i + 1} · {ROUND_OF_32[i].date}
                            </p>
                          )}
                          <div className="flex gap-2">
                            {[teamA, teamB].map((team, ti) => {
                              if (!team) return null;
                              const isSelected = currentPick === team;
                              const otherSelected = currentPick && currentPick !== team;
                              return (
                                <button
                                  key={ti}
                                  type="button"
                                  onClick={() => handlePick(roundIdx, i, team)}
                                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg font-semibold text-sm transition-all duration-150 border ${
                                    isSelected
                                      ? 'bg-[#FFD700] text-[#050d1a] border-[#FFD700] shadow-md shadow-[#FFD700]/20'
                                      : otherSelected
                                      ? 'bg-[#050d1a] text-[#4a5568] border-[#1a3060] opacity-50'
                                      : 'bg-[#050d1a] text-white border-[#1a3a60] hover:border-[#FFD700] hover:text-[#FFD700]'
                                  }`}
                                >
                                  <span>{TEAM_FLAGS[team] || '🏳️'}</span>
                                  <span className="truncate">{team}</span>
                                  {isSelected && <span className="ml-1">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Champion display */}
        {picks.champion && (
          <div className="bg-gradient-to-r from-[#FFD700]/20 to-[#FFD700]/5 border border-[#FFD700] rounded-xl p-5 text-center">
            <p className="text-[#FFD700] font-black text-lg">
              🏆 {name || 'You'} think{name ? 's' : ''} {picks.champion} wins it all!
            </p>
            <p className="text-[#8899aa] text-xs mt-1">Champion correct → +32 bonus points</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-950 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || totalPicks < 31}
          className="w-full bg-[#FFD700] text-[#050d1a] font-black text-lg py-4 rounded-xl hover:bg-[#FFE57F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {submitting
            ? '⏳ Submitting...'
            : totalPicks < 31
            ? `Complete All Picks (${31 - totalPicks} remaining)`
            : '🏆 Submit My Bracket!'}
        </button>
      </form>
    </div>
  );
}
