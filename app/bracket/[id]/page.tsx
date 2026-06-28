import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getBracket, getResults } from '@/lib/storage';
import { calculateScore } from '@/lib/scoring';
import { ROUND_OF_32, ROUND_NAMES, ROUND_SIZES, ROUND_POINTS, TEAM_FLAGS } from '@/lib/bracket';
import { Results, Bracket } from '@/lib/types';

export const revalidate = 30;

const ROUND_KEYS = ['r0', 'r1', 'r2', 'r3', 'r4'] as const;

function MatchResult({
  pick, result, pts,
}: { pick: string | null; result: string | null; pts: number }) {
  const isCorrect = result && pick === result;
  const isWrong = result && pick && pick !== result;
  const isPending = !result;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm font-semibold ${
        isCorrect
          ? 'bg-green-900 text-green-300 border border-green-700'
          : isWrong
          ? 'bg-red-950 text-red-300 border border-red-800 line-through opacity-70'
          : isPending && pick
          ? 'bg-[#0f2040] text-white border border-[#1a3a60]'
          : 'bg-[#050d1a] text-[#8899aa] border border-[#1a3060] italic'
      }`}
    >
      {pick ? `${TEAM_FLAGS[pick] || ''} ${pick}` : '—'}
      {isCorrect && ` +${pts}pts`}
    </span>
  );
}

export default async function BracketViewPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { new?: string };
}) {
  let bracket: Bracket | null;
  let results: Results;

  try {
    [bracket, results] = await Promise.all([getBracket(params.id), getResults()]);
  } catch {
    return (
      <div className="text-center py-16">
        <p className="text-red-400">Failed to load bracket. Please try again.</p>
        <Link href="/" className="mt-4 inline-block text-[#FFD700] hover:underline">← Back to leaderboard</Link>
      </div>
    );
  }

  if (!bracket) notFound();

  const score = calculateScore(bracket.picks, results);
  const isNew = searchParams.new === '1';

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* New submission celebration */}
      {isNew && (
        <div className="bg-green-950 border border-green-700 rounded-xl p-4 text-center">
          <p className="text-green-300 font-bold text-lg">🎉 Bracket submitted successfully!</p>
          <p className="text-green-400 text-sm mt-1">Good luck! Scores update as matches are played.</p>
        </div>
      )}

      {/* Personal header */}
      <div className="bg-gradient-to-br from-[#0f2040] to-[#050d1a] border border-[#1a3a60] rounded-xl p-6 text-center space-y-2">
        <p className="text-[#8899aa] text-sm uppercase tracking-wide">🏆 World Cup Predictions</p>
        <h1 className="text-3xl font-black text-white">{bracket.name}'s Bracket</h1>
        {bracket.picks.champion && (
          <p className="text-[#FFD700] font-bold">
            {bracket.name} thinks {TEAM_FLAGS[bracket.picks.champion] || ''} {bracket.picks.champion} 🏆 wins it all!
          </p>
        )}
        <p className="text-xs text-[#8899aa]">
          Submitted {new Date(bracket.createdAt).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
          })}
        </p>
      </div>

      {/* Score card */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#0f2040] border border-[#1a3a60] rounded-xl p-4 text-center">
          <p className="text-[#8899aa] text-xs uppercase tracking-wide">Points</p>
          <p className="text-[#FFD700] font-black text-3xl">{score.points}</p>
        </div>
        <div className="bg-[#0f2040] border border-[#1a3a60] rounded-xl p-4 text-center">
          <p className="text-[#8899aa] text-xs uppercase tracking-wide">Accuracy</p>
          <p className="text-white font-black text-3xl">{score.accuracy}%</p>
        </div>
        <div className="bg-[#0f2040] border border-[#1a3a60] rounded-xl p-4 text-center">
          <p className="text-[#8899aa] text-xs uppercase tracking-wide">Correct</p>
          <p className="text-white font-black text-3xl">{score.correct}<span className="text-[#8899aa] text-lg">/{score.total}</span></p>
        </div>
      </div>

      {/* Champion bonus status */}
      {bracket.picks.champion && (
        <div className={`border rounded-xl p-4 text-center ${
          results.champion === bracket.picks.champion
            ? 'bg-[#FFD700]/20 border-[#FFD700]'
            : results.champion
            ? 'bg-red-950 border-red-800'
            : 'bg-[#0f2040] border-[#1a3a60]'
        }`}>
          <p className="font-bold text-sm">
            {results.champion === bracket.picks.champion
              ? `🎉 Champion correct! +32 bonus points!`
              : results.champion
              ? `❌ Champion: ${TEAM_FLAGS[bracket.picks.champion] || ''} ${bracket.picks.champion} was eliminated`
              : `🏆 Champion pick: ${TEAM_FLAGS[bracket.picks.champion] || ''} ${bracket.picks.champion} (+32 if correct)`}
          </p>
        </div>
      )}

      {/* Round-by-round picks */}
      {ROUND_KEYS.map((roundKey, roundIdx) => {
        const matchCount = ROUND_SIZES[roundIdx];
        const pts = ROUND_POINTS[roundIdx];
        const roundCorrect = Array.from({ length: matchCount }).filter(
          (_, i) => results[roundKey][i] && bracket.picks[roundKey][i] === results[roundKey][i]
        ).length;
        const roundTotal = Array.from({ length: matchCount }).filter(
          (_, i) => results[roundKey][i] !== null
        ).length;

        return (
          <div key={roundKey} className="bg-[#0f2040] border border-[#1a3a60] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[#050d1a] border-b border-[#1a3a60]">
              <h2 className="font-bold text-white">{ROUND_NAMES[roundIdx]}</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#8899aa]">{pts} pt{pts !== 1 ? 's' : ''} each</span>
                {roundTotal > 0 && (
                  <span className="text-xs text-green-400 font-bold">
                    {roundCorrect}/{roundTotal} correct
                  </span>
                )}
              </div>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: matchCount }).map((_, i) => {
                const pick = bracket.picks[roundKey][i];
                const result = results[roundKey][i];
                const matchLabel = roundIdx === 0
                  ? `${ROUND_OF_32[i].home} vs ${ROUND_OF_32[i].away}`
                  : `Match ${i + 1}`;

                return (
                  <div key={i} className="space-y-1">
                    {roundIdx === 0 && (
                      <p className="text-xs text-[#8899aa]">{matchLabel} · {ROUND_OF_32[i].date}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#8899aa] w-4">{i + 1}.</span>
                      <MatchResult pick={pick} result={result} pts={pts} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Navigation */}
      <div className="flex gap-4 justify-center pb-8">
        <Link
          href="/"
          className="bg-[#0f2040] border border-[#1a3a60] text-white font-bold px-6 py-2 rounded-lg hover:border-[#FFD700] hover:text-[#FFD700] transition-colors"
        >
          ← Leaderboard
        </Link>
        <Link
          href="/bracket/new"
          className="bg-[#FFD700] text-[#050d1a] font-bold px-6 py-2 rounded-lg hover:bg-[#FFE57F] transition-colors"
        >
          + New Bracket
        </Link>
      </div>
    </div>
  );
}
