import { Match } from './types';

export const ROUND_OF_32: Match[] = [
  // Left half (0-7)
  { home: 'Canada', away: 'South Africa', date: 'Jun 28' },
  { home: 'Brazil', away: 'Japan', date: 'Jun 29' },
  { home: 'Germany', away: 'Paraguay', date: 'Jun 29' },
  { home: 'Netherlands', away: 'Morocco', date: 'Jun 29' },
  { home: 'Ivory Coast', away: 'Norway', date: 'Jun 30' },
  { home: 'France', away: 'Sweden', date: 'Jun 30' },
  { home: 'Mexico', away: 'Ecuador', date: 'Jun 30' },
  { home: 'England', away: 'DR Congo', date: 'Jul 1' },
  // Right half (8-15)
  { home: 'Belgium', away: 'Senegal', date: 'Jul 1' },
  { home: 'USA', away: 'Bosnia-Herzegovina', date: 'Jul 1' },
  { home: 'Spain', away: 'Austria', date: 'Jul 2' },
  { home: 'Portugal', away: 'Croatia', date: 'Jul 2' },
  { home: 'Switzerland', away: 'Algeria', date: 'Jul 2' },
  { home: 'Australia', away: 'Egypt', date: 'Jul 3' },
  { home: 'Argentina', away: 'Cape Verde', date: 'Jul 3' },
  { home: 'Colombia', away: 'Ghana', date: 'Jul 3' },
];

export const TEAM_FLAGS: Record<string, string> = {
  'Canada': '🇨🇦', 'South Africa': '🇿🇦', 'Brazil': '🇧🇷', 'Japan': '🇯🇵',
  'Germany': '🇩🇪', 'Paraguay': '🇵🇾', 'Netherlands': '🇳🇱', 'Morocco': '🇲🇦',
  'Ivory Coast': '🇨🇮', 'Norway': '🇳🇴', 'France': '🇫🇷', 'Sweden': '🇸🇪',
  'Mexico': '🇲🇽', 'Ecuador': '🇪🇨', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'DR Congo': '🇨🇩',
  'Belgium': '🇧🇪', 'Senegal': '🇸🇳', 'USA': '🇺🇸', 'Bosnia-Herzegovina': '🇧🇦',
  'Spain': '🇪🇸', 'Austria': '🇦🇹', 'Portugal': '🇵🇹', 'Croatia': '🇭🇷',
  'Switzerland': '🇨🇭', 'Algeria': '🇩🇿', 'Australia': '🇦🇺', 'Egypt': '🇪🇬',
  'Argentina': '🇦🇷', 'Cape Verde': '🇨🇻', 'Colombia': '🇨🇴', 'Ghana': '🇬🇭',
};

export const ROUND_NAMES = ['Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals', 'Final'];
export const ROUND_SIZES = [16, 8, 4, 2, 1];
export const ROUND_POINTS = [1, 2, 4, 8, 16];
export const ROUND_KEYS = ['r0', 'r1', 'r2', 'r3', 'r4'] as const;
export type RoundKey = typeof ROUND_KEYS[number];

export const ALL_TEAMS = Array.from(new Set(ROUND_OF_32.flatMap(m => [m.home, m.away])));

// Get teams eligible for a match slot in a given round (based on R32 matchups only)
export function getEligibleTeamsForSlot(round: number, index: number): string[] {
  if (round === 0) {
    const match = ROUND_OF_32[index];
    return [match.home, match.away];
  }
  return [
    ...getEligibleTeamsForSlot(round - 1, index * 2),
    ...getEligibleTeamsForSlot(round - 1, index * 2 + 1),
  ];
}

// Get match description for a given round and slot (shows which R32 teams feed into it)
export function getMatchFeedText(round: number, index: number): string {
  if (round === 0) return `Match ${index + 1}`;
  return `Winner of Match ${index * 2 + 1} vs Winner of Match ${index * 2 + 2}`;
}

// Apply a pick with cascade logic
export function applyPick(
  picks: { r0: (string|null)[], r1: (string|null)[], r2: (string|null)[], r3: (string|null)[], r4: (string|null)[], champion: string|null },
  round: number,
  index: number,
  newTeam: string | null
) {
  const result = {
    r0: [...picks.r0],
    r1: [...picks.r1],
    r2: [...picks.r2],
    r3: [...picks.r3],
    r4: [...picks.r4],
    champion: picks.champion,
  };

  const oldTeam = result[ROUND_KEYS[round]][index];
  result[ROUND_KEYS[round]][index] = newTeam;

  // Auto-set champion when r4[0] is set
  if (round === 4 && index === 0) {
    result.champion = newTeam;
  }

  // Cascade: clear downstream picks that relied on oldTeam
  if (oldTeam) {
    let cascadeIndex = index;
    for (let r = round + 1; r <= 4; r++) {
      const parentIndex = Math.floor(cascadeIndex / 2);
      if (result[ROUND_KEYS[r]][parentIndex] === oldTeam) {
        result[ROUND_KEYS[r]][parentIndex] = null;
        if (r === 4) result.champion = null;
        cascadeIndex = parentIndex;
      } else {
        break;
      }
    }
    if (result.champion === oldTeam) {
      result.champion = null;
    }
  }

  return result;
}
