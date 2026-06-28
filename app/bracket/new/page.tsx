'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROUND_OF_32, TEAM_FLAGS, applyPick } from '@/lib/bracket';
import { emptyPicks } from '@/lib/scoring';
import { Picks } from '@/lib/types';

const ROUND_KEYS = ['r0', 'r1', 'r2', 'r3', 'r4'] as const;

// Layout constants
const CARD_W = 140;
const CARD_H = 110;
const TEAM_H = 55; // (CARD_H / 2)
const SLOT = 118; // CARD_H + 8px gap
const COL_GAP = 32;
const TOTAL_H = 8 * SLOT - 8; // 936

// Computed vertical top positions for each round (within each half, 0-indexed)
const R32_TOPS = [0, 1, 2, 3, 4, 5, 6, 7].map(i => i * SLOT);

const R16_TOPS = [0, 1, 2, 3].map(i => {
  const cy0 = R32_TOPS[i * 2] + CARD_H / 2;
  const cy1 = R32_TOPS[i * 2 + 1] + CARD_H / 2;
  return (cy0 + cy1) / 2 - CARD_H / 2;
});

const QF_TOPS = [0, 1].map(i => {
  const cy0 = R16_TOPS[i * 2] + CARD_H / 2;
  const cy1 = R16_TOPS[i * 2 + 1] + CARD_H / 2;
  return (cy0 + cy1) / 2 - CARD_H / 2;
});

const SF_TOP = (() => {
  const cy0 = QF_TOPS[0] + CARD_H / 2;
  const cy1 = QF_TOPS[1] + CARD_H / 2;
  return (cy0 + cy1) / 2 - CARD_H / 2;
})();

const FINAL_TOP = SF_TOP; // vertically centered same as SF

// Column left-edge x positions
const COL_X = {
  r32Left:  0,
  r16Left:  CARD_W + COL_GAP,
  qfLeft:   CARD_W * 2 + COL_GAP * 2,
  sfLeft:   CARD_W * 3 + COL_GAP * 3,
  final:    CARD_W * 4 + COL_GAP * 4,
  sfRight:  CARD_W * 5 + COL_GAP * 5,
  qfRight:  CARD_W * 6 + COL_GAP * 6,
  r16Right: CARD_W * 7 + COL_GAP * 7,
  r32Right: CARD_W * 8 + COL_GAP * 8,
};
const TOTAL_W = CARD_W * 9 + COL_GAP * 8; // 1516

// Round header labels and their column x positions
const COL_HEADERS: { label: string; x: number }[] = [
  { label: 'Round of 32', x: COL_X.r32Left },
  { label: 'Round of 16', x: COL_X.r16Left },
  { label: 'Quarterfinal', x: COL_X.qfLeft },
  { label: 'Semifinal', x: COL_X.sfLeft },
  { label: 'Final', x: COL_X.final },
  { label: 'Semifinal', x: COL_X.sfRight },
  { label: 'Quarterfinal', x: COL_X.qfRight },
  { label: 'Round of 16', x: COL_X.r16Right },
  { label: 'Round of 32', x: COL_X.r32Right },
];
const HEADER_H = 28; // height reserved above the bracket for column labels

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function TeamButton({
  team,
  picked,
  dimmed,
  onClick,
}: {
  team: string | null;
  picked: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  if (!team) {
    return (
      <div
        className="flex items-center px-2 text-[10px] text-[#4a5568] italic"
        style={{ height: TEAM_H }}
      >
        TBD
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ height: TEAM_H }}
      className={`w-full flex items-center gap-1.5 px-2 text-left text-[11px] font-semibold transition-all ${
        picked
          ? 'bg-[#FFD700] text-[#050d1a]'
          : dimmed
          ? 'bg-[#050d1a] text-[#374151] opacity-40'
          : 'bg-[#050d1a] text-white hover:bg-[#1a3a60] hover:text-[#FFD700]'
      }`}
    >
      <span className="text-base leading-none flex-shrink-0">
        {TEAM_FLAGS[team] || '🏳️'}
      </span>
      <span className="truncate leading-tight">{team}</span>
      {picked && <span className="ml-auto text-[9px] flex-shrink-0">✓</span>}
    </button>
  );
}

function MatchCard({
  teamA,
  teamB,
  pick,
  onPick,
}: {
  teamA: string | null;
  teamB: string | null;
  pick: string | null;
  onPick: (t: string) => void;
}) {
  return (
    <div
      style={{ width: CARD_W, height: CARD_H }}
      className="border border-[#1a3a60] rounded overflow-hidden bg-[#0f2040] flex flex-col"
    >
      <div className="flex flex-col flex-1 divide-y divide-[#1a3060]">
        <TeamButton
          team={teamA}
          picked={pick === teamA && teamA !== null}
          dimmed={!!pick && pick !== teamA}
          onClick={() => teamA && onPick(teamA)}
        />
        <TeamButton
          team={teamB}
          picked={pick === teamB && teamB !== null}
          dimmed={!!pick && pick !== teamB}
          onClick={() => teamB && onPick(teamB)}
        />
      </div>
    </div>
  );
}

function Connectors({
  fromTops,
  toTops,
  fromX,
  toX,
  color,
  reversed,
}: {
  fromTops: number[];
  toTops: number[];
  fromX: number;
  toX: number;
  color: string;
  reversed?: boolean;
}) {
  return (
    <>
      {toTops.map((toTop, i) => {
        const from0 = fromTops[i * 2];
        const from1 = fromTops[i * 2 + 1];
        if (from0 === undefined || from1 === undefined) return null;
        const cy0 = from0 + CARD_H / 2;
        const cy1 = from1 + CARD_H / 2;
        const toCy = toTop + CARD_H / 2;
        const midX = (fromX + toX) / 2;

        if (reversed) {
          // Lines go left from fromX toward toX (which is to the right)
          // fromX = left edge of "from" column, toX = right edge of "to" column
          return (
            <g key={i}>
              <line x1={fromX} y1={cy0} x2={midX} y2={cy0} stroke={color} strokeWidth={1.5} />
              <line x1={fromX} y1={cy1} x2={midX} y2={cy1} stroke={color} strokeWidth={1.5} />
              <line x1={midX} y1={cy0} x2={midX} y2={cy1} stroke={color} strokeWidth={1.5} />
              <line x1={midX} y1={toCy} x2={toX} y2={toCy} stroke={color} strokeWidth={1.5} />
            </g>
          );
        }

        return (
          <g key={i}>
            <line x1={fromX} y1={cy0} x2={midX} y2={cy0} stroke={color} strokeWidth={1.5} />
            <line x1={fromX} y1={cy1} x2={midX} y2={cy1} stroke={color} strokeWidth={1.5} />
            <line x1={midX} y1={cy0} x2={midX} y2={cy1} stroke={color} strokeWidth={1.5} />
            <line x1={midX} y1={toCy} x2={toX} y2={toCy} stroke={color} strokeWidth={1.5} />
          </g>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function NewBracketPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [picks, setPicks] = useState<Picks>(emptyPicks());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function getTeams(round: number, absIndex: number): [string | null, string | null] {
    if (round === 0) {
      return [ROUND_OF_32[absIndex].home, ROUND_OF_32[absIndex].away];
    }
    const prevKey = ROUND_KEYS[round - 1];
    return [picks[prevKey][absIndex * 2] || null, picks[prevKey][absIndex * 2 + 1] || null];
  }

  function handlePick(round: number, absIndex: number, team: string) {
    setPicks(prev => applyPick(prev, round, absIndex, team));
  }

  const totalPicks = ROUND_KEYS.reduce(
    (sum, rk) => sum + picks[rk].filter(Boolean).length,
    0
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (totalPicks < 31) { setError('Please complete all rounds before submitting'); return; }
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

  // Helper: render one match card absolutely positioned
  function renderMatch(
    round: number,
    absIndex: number,
    left: number,
    top: number
  ) {
    const [teamA, teamB] = getTeams(round, absIndex);
    const roundKey = ROUND_KEYS[round];
    const pick = picks[roundKey][absIndex] || null;
    return (
      <div
        key={`${round}-${absIndex}`}
        style={{ position: 'absolute', left, top: top + HEADER_H }}
      >
        <MatchCard
          teamA={teamA}
          teamB={teamB}
          pick={pick}
          onPick={team => handlePick(round, absIndex, team)}
        />
      </div>
    );
  }

  const connectorColor = '#2a4a70';
  // Offset all connector y-positions by HEADER_H
  const r32TopsOff = R32_TOPS.map(t => t + HEADER_H);
  const r16TopsOff = R16_TOPS.map(t => t + HEADER_H);
  const qfTopsOff  = QF_TOPS.map(t => t + HEADER_H);
  const sfTopOff   = SF_TOP + HEADER_H;
  const finalTopOff = FINAL_TOP + HEADER_H;

  const containerH = TOTAL_H + HEADER_H;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-xl font-black text-white">🏆 Fill Out Your Bracket</h1>
        <p className="text-[#8899aa] text-sm">
          Click a team to pick the winner. Complete all rounds to submit.
        </p>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-[#8899aa]">Progress</span>
          <span className={totalPicks === 31 ? 'text-green-400 font-bold' : 'text-[#8899aa]'}>
            {totalPicks}/31 picks
          </span>
        </div>
        <div className="h-2 bg-[#050d1a] rounded-full border border-[#1a3a60] overflow-hidden">
          <div
            className="h-full bg-[#FFD700] rounded-full transition-all"
            style={{ width: `${(totalPicks / 31) * 100}%` }}
          />
        </div>
      </div>

      {/* Round completion badges */}
      <div className="flex gap-2 justify-center flex-wrap">
        {(['R32 (1pt)', 'R16 (2pts)', 'QF (4pts)', 'SF (8pts)', 'Final (16pts)'] as const).map(
          (label, i) => {
            const rk = ROUND_KEYS[i];
            const sizes = [16, 8, 4, 2, 1];
            const done = picks[rk].filter(Boolean).length;
            const complete = done === sizes[i];
            return (
              <span
                key={label}
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  complete
                    ? 'border-green-600 text-green-400'
                    : 'border-[#1a3a60] text-[#8899aa]'
                }`}
              >
                {complete ? '✓ ' : ''}{label}
              </span>
            );
          }
        )}
      </div>

      {/* ── Visual Bracket ── */}
      <div className="overflow-x-auto -mx-4 px-4 pb-4">
        <div style={{ width: TOTAL_W, height: containerH, position: 'relative' }}>

          {/* Column header labels */}
          {COL_HEADERS.map(({ label, x }, idx) => (
            <div
              key={idx}
              style={{
                position: 'absolute',
                left: x,
                top: 0,
                width: CARD_W,
                height: HEADER_H,
              }}
              className="flex items-center justify-center text-[9px] font-bold text-[#4a6a90] uppercase tracking-wider"
            >
              {label}
            </div>
          ))}

          {/* SVG connector lines */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: TOTAL_W,
              height: containerH,
              pointerEvents: 'none',
            }}
          >
            {/* Left half: R32 → R16 */}
            <Connectors
              fromTops={r32TopsOff.slice(0, 8)}
              toTops={r16TopsOff}
              fromX={COL_X.r32Left + CARD_W}
              toX={COL_X.r16Left}
              color={connectorColor}
            />
            {/* Left half: R16 → QF */}
            <Connectors
              fromTops={r16TopsOff}
              toTops={qfTopsOff}
              fromX={COL_X.r16Left + CARD_W}
              toX={COL_X.qfLeft}
              color={connectorColor}
            />
            {/* Left half: QF → SF */}
            <Connectors
              fromTops={qfTopsOff}
              toTops={[sfTopOff]}
              fromX={COL_X.qfLeft + CARD_W}
              toX={COL_X.sfLeft}
              color={connectorColor}
            />
            {/* Left SF → Final */}
            <line
              x1={COL_X.sfLeft + CARD_W}
              y1={sfTopOff + CARD_H / 2}
              x2={COL_X.final}
              y2={finalTopOff + CARD_H / 2}
              stroke={connectorColor}
              strokeWidth={1.5}
            />
            {/* Right SF → Final */}
            <line
              x1={COL_X.sfRight}
              y1={sfTopOff + CARD_H / 2}
              x2={COL_X.final + CARD_W}
              y2={finalTopOff + CARD_H / 2}
              stroke={connectorColor}
              strokeWidth={1.5}
            />
            {/* Right half: QF → SF (reversed) */}
            <Connectors
              fromTops={qfTopsOff}
              toTops={[sfTopOff]}
              fromX={COL_X.qfRight}
              toX={COL_X.sfRight + CARD_W}
              color={connectorColor}
              reversed
            />
            {/* Right half: R16 → QF (reversed) */}
            <Connectors
              fromTops={r16TopsOff}
              toTops={qfTopsOff}
              fromX={COL_X.r16Right}
              toX={COL_X.qfRight + CARD_W}
              color={connectorColor}
              reversed
            />
            {/* Right half: R32 → R16 (reversed) */}
            <Connectors
              fromTops={r32TopsOff.slice(0, 8)}
              toTops={r16TopsOff}
              fromX={COL_X.r32Right}
              toX={COL_X.r16Right + CARD_W}
              color={connectorColor}
              reversed
            />
          </svg>

          {/* ── Left half match cards ── */}
          {/* R32: matches 0–7 */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i =>
            renderMatch(0, i, COL_X.r32Left, R32_TOPS[i])
          )}
          {/* R16: matches 0–3 */}
          {[0, 1, 2, 3].map(i =>
            renderMatch(1, i, COL_X.r16Left, R16_TOPS[i])
          )}
          {/* QF: matches 0–1 */}
          {[0, 1].map(i =>
            renderMatch(2, i, COL_X.qfLeft, QF_TOPS[i])
          )}
          {/* SF: match 0 */}
          {renderMatch(3, 0, COL_X.sfLeft, SF_TOP)}

          {/* ── Final ── */}
          {renderMatch(4, 0, COL_X.final, FINAL_TOP)}

          {/* ── Right half match cards ── */}
          {/* SF: match 1 */}
          {renderMatch(3, 1, COL_X.sfRight, SF_TOP)}
          {/* QF: matches 2–3 */}
          {[0, 1].map(i =>
            renderMatch(2, 2 + i, COL_X.qfRight, QF_TOPS[i])
          )}
          {/* R16: matches 4–7 */}
          {[0, 1, 2, 3].map(i =>
            renderMatch(1, 4 + i, COL_X.r16Right, R16_TOPS[i])
          )}
          {/* R32: matches 8–15 */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i =>
            renderMatch(0, 8 + i, COL_X.r32Right, R32_TOPS[i])
          )}
        </div>
      </div>

      {/* Champion announcement */}
      {picks.champion && (
        <div className="bg-[#FFD700]/10 border border-[#FFD700] rounded-xl p-4 text-center">
          <p className="text-[#FFD700] font-black">
            🏆 {name || 'You'} think{name ? 's' : ''}{' '}
            {TEAM_FLAGS[picks.champion] || ''} {picks.champion} wins it all!
          </p>
          <p className="text-[#8899aa] text-xs mt-1">
            Correct champion = +32 bonus points
          </p>
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
            <p className="text-[#8899aa] text-sm mt-1">
              Bracket: <span className="text-white font-bold">🏆 {name}&apos;s Bracket</span>
            </p>
          )}
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          onClick={handleSubmit as React.MouseEventHandler<HTMLButtonElement>}
          disabled={submitting || totalPicks < 31 || !name.trim()}
          className="w-full bg-[#FFD700] text-[#050d1a] font-black text-lg py-3 rounded-xl hover:bg-[#FFE57F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? '⏳ Submitting...'
            : totalPicks < 31
            ? `Complete All Picks (${31 - totalPicks} remaining)`
            : '🏆 Submit My Bracket!'}
        </button>
      </div>
    </div>
  );
}
