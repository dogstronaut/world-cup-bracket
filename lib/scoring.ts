import { Picks, Results, BracketScore } from './types';
import { ROUND_KEYS, ROUND_POINTS, ROUND_SIZES } from './bracket';

export function calculateScore(picks: Picks, results: Results): BracketScore {
  let points = 0;
  let correct = 0;
  let total = 0;

  for (let r = 0; r < ROUND_KEYS.length; r++) {
    const roundKey = ROUND_KEYS[r];
    const pts = ROUND_POINTS[r];
    for (let i = 0; i < ROUND_SIZES[r]; i++) {
      if (results[roundKey][i] !== null) {
        total++;
        if (picks[roundKey][i] && picks[roundKey][i] === results[roundKey][i]) {
          correct++;
          points += pts;
        }
      }
    }
  }

  // Champion bonus (does NOT affect accuracy)
  if (results.champion !== null && picks.champion && picks.champion === results.champion) {
    points += 32;
  }

  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { points, correct, total, accuracy };
}

export function emptyResults(): Results {
  return {
    r0: Array(16).fill(null),
    r1: Array(8).fill(null),
    r2: Array(4).fill(null),
    r3: Array(2).fill(null),
    r4: Array(1).fill(null),
    champion: null,
  };
}

export function emptyPicks(): Picks {
  return {
    r0: Array(16).fill(null),
    r1: Array(8).fill(null),
    r2: Array(4).fill(null),
    r3: Array(2).fill(null),
    r4: Array(1).fill(null),
    champion: null,
  };
}

export function countTotalPicks(picks: Picks): number {
  let count = 0;
  const rounds = ['r0', 'r1', 'r2', 'r3', 'r4'] as const;
  for (const r of rounds) {
    count += picks[r].filter(Boolean).length;
  }
  return count;
}

export function isComplete(picks: Picks): boolean {
  return countTotalPicks(picks) === 31 && picks.champion !== null;
}
