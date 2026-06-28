export interface Match {
  home: string;
  away: string;
  date: string;
}

export interface Picks {
  r0: (string | null)[];
  r1: (string | null)[];
  r2: (string | null)[];
  r3: (string | null)[];
  r4: (string | null)[];
  champion: string | null;
}

export interface Bracket {
  id: string;
  name: string;
  picks: Picks;
  createdAt: string;
}

export interface Results {
  r0: (string | null)[];
  r1: (string | null)[];
  r2: (string | null)[];
  r3: (string | null)[];
  r4: (string | null)[];
  champion: string | null;
}

export interface BracketScore {
  points: number;
  correct: number;
  total: number;
  accuracy: number;
}

export interface ScoredBracket extends Bracket {
  score: BracketScore;
}

export interface SyncLogEntry {
  timestamp: string;
  success: boolean;
  message: string;
  changes?: number;
}

export interface RecapEntry {
  date: string;
  title: string;
  body: string;
  createdAt: string;
}
