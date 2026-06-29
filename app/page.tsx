import Link from 'next/link';
import { getAllBrackets, getResults, getAllRecaps } from '@/lib/storage';
import { calculateScore } from '@/lib/scoring';
import { TEAM_FLAGS } from '@/lib/bracket';
import { ScoredBracket, RecapEntry } from '@/lib/types';

export const revalidate = 30;

const MEDALS = ['🥇', '🥈', '🥉'];

export default async function HomePage() {
  let scoredBrackets: ScoredBracket[] = [];
  let latestRecap: RecapEntry | null = null;
  let error = false;

  try {
    const [brackets, results, recaps] = await Promise.all([getAllBrackets(), getResults(), getAllRecaps()]);
    scoredBrackets = brackets
      .map(b => ({ ...b, score: calculateScore(b.picks, results) }))
      .sort((a, b) =>
        b.score.points - a.score.points ||
        b.score.correct - a.score.correct ||
        a.name.localeCompare(b.name)
      );
    latestRecap = recaps.length > 0 ? recaps[0] : null;
  } catch {
    error = true;
  }

  return (
    <div className="space-y-10">
      {/* Daily Recap */}
      {latestRecap && (
        <section className="bg-[#0f2040] border-2 border-[#FFD700] rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">📰</span>
            <h2 className="font-black text-[#FFD700] uppercase tracking-wide text-sm">Match Day Recap</h2>
            <span className="ml-auto text-xs text-[#8899aa]">{latestRecap.date}</span>
          </div>
          <h3 className="text-white font-black text-xl leading-snug">{latestRecap.title}</h3>
          <p className="text-[#c8d8e8] text-sm leading-relaxed whitespace-pre-line">{latestRecap.body}</p>
        </section>
      )}

      {/* Hero */}
      <section className="text-center space-y-5 py-6">
        <div className="space-y-2">
          <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
            Pick your winners.<br/>
            <span className="text-[#FFD700]">Prove you know football.</span>
          </h2>
          <p className="text-[#8899aa] text-base max-w-md mx-auto">
            Fill out the complete 2026 World Cup knockout bracket — from Round of 32 to the Final.
            Scores update live as matches are played!
          </p>
        </div>

        {/* Tournament dates */}
        <div className="flex flex-wrap justify-center gap-2 text-xs">
          {[
            { label: 'Round of 32', dates: 'Jun 28 – Jul 3' },
            { label: 'Round of 16', dates: 'Jul 5–8' },
            { label: 'Quarterfinals', dates: 'Jul 11–12' },
            { label: 'Semifinals', dates: 'Jul 15–16' },
            { label: 'Final', dates: 'Jul 19' },
          ].map(r => (
            <span key={r.label} className="bg-[#0f2040] border border-[#1a3a60] rounded-full px-3 py-1 text-[#8899aa]">
              {r.label} · <span className="text-white">{r.dates}</span>
            </span>
          ))}
        </div>

        <p className="text-[#FFD700] font-bold text-sm">⏳ Bracket submissions are now closed.</p>
      </section>

      {/* Scoring guide */}
      <section className="bg-[#0f2040] border border-[#1a3a60] rounded-xl p-5">
        <h3 className="font-bold text-white mb-3 text-sm uppercase tracking-wide">📊 Scoring</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
          {[
            { round: 'R32', pts: 1 },
            { round: 'R16', pts: 2 },
            { round: 'QF', pts: 4 },
            { round: 'SF', pts: 8 },
            { round: 'Final', pts: 16 },
            { round: 'Champion', pts: '+32' },
          ].map(s => (
            <div key={s.round} className="bg-[#050d1a] border border-[#1a3060] rounded-lg p-2">
              <p className="text-[#8899aa] text-xs">{s.round}</p>
              <p className="text-[#FFD700] font-black text-lg">{s.pts}</p>
              <p className="text-[#8899aa] text-xs">pts</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#8899aa] mt-3">Max possible: 16×1 + 8×2 + 4×4 + 2×8 + 1×16 + 32 = 128 points</p>
      </section>

      {/* Leaderboard */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-white">🏆 Leaderboard</h2>
          <span className="text-xs text-[#8899aa]">{scoredBrackets.length} bracket{scoredBrackets.length !== 1 ? 's' : ''}</span>
        </div>

        {error && (
          <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-red-300 text-sm text-center">
            Failed to load leaderboard. Please refresh the page.
          </div>
        )}

        {!error && scoredBrackets.length === 0 && (
          <div className="bg-[#0f2040] border border-[#1a3a60] rounded-xl p-12 text-center space-y-4">
            <p className="text-5xl">⚽</p>
            <p className="text-white font-bold text-xl">No brackets yet!</p>
            <p className="text-[#8899aa]">Be the first to submit your predictions.</p>
          </div>
        )}

        {!error && scoredBrackets.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block bg-[#0f2040] border border-[#1a3a60] rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#050d1a] border-b border-[#1a3a60]">
                    <th className="px-4 py-3 text-left text-xs text-[#8899aa] uppercase tracking-wide w-12">Rank</th>
                    <th className="px-4 py-3 text-left text-xs text-[#8899aa] uppercase tracking-wide">Name</th>
                    <th className="px-4 py-3 text-right text-xs text-[#8899aa] uppercase tracking-wide">Points</th>
                    <th className="px-4 py-3 text-right text-xs text-[#8899aa] uppercase tracking-wide">Accuracy</th>
                    <th className="px-4 py-3 text-right text-xs text-[#8899aa] uppercase tracking-wide">Correct</th>
                    <th className="px-4 py-3 text-right text-xs text-[#8899aa] uppercase tracking-wide">Champion Pick</th>
                  </tr>
                </thead>
                <tbody>
                  {scoredBrackets.map((b, i) => (
                    <tr
                      key={b.id}
                      className={`border-b border-[#1a3060] last:border-0 hover:bg-[#1a3060] transition-colors ${
                        i === 0 ? 'bg-[#FFD700]/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
                        <span className="text-lg">{MEDALS[i] || `${i + 1}`}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/bracket/${b.id}`}
                          className="font-bold text-white hover:text-[#FFD700] transition-colors text-base"
                        >
                          {b.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-black text-[#FFD700] text-lg">{b.score.points}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-white font-semibold">{b.score.accuracy}%</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[#8899aa]">{b.score.correct}/{b.score.total}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {b.picks.champion ? (
                          <span className="text-sm text-[#8899aa]">
                            {TEAM_FLAGS[b.picks.champion] || ''} {b.picks.champion}
                          </span>
                        ) : (
                          <span className="text-[#4a5568]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {scoredBrackets.map((b, i) => (
                <Link
                  key={b.id}
                  href={`/bracket/${b.id}`}
                  className={`block bg-[#0f2040] border rounded-xl p-4 hover:border-[#FFD700] transition-colors ${
                    i === 0 ? 'border-[#FFD700]/50' : 'border-[#1a3a60]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{MEDALS[i] || `#${i + 1}`}</span>
                      <span className="font-bold text-white text-lg">{b.name}</span>
                    </div>
                    <span className="font-black text-[#FFD700] text-2xl">{b.score.points}pts</span>
                  </div>
                  <div className="flex gap-4 text-sm text-[#8899aa]">
                    <span>{b.score.accuracy}% accuracy</span>
                    <span>{b.score.correct}/{b.score.total} correct</span>
                    {b.picks.champion && (
                      <span>{TEAM_FLAGS[b.picks.champion] || ''} {b.picks.champion}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

      </section>
    </div>
  );
}
