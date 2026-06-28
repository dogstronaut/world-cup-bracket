import Anthropic from '@anthropic-ai/sdk';
import { ROUND_OF_32, ROUND_POINTS, TEAM_FLAGS } from './bracket';
import { getAllBrackets, getResults, saveRecap } from './storage';
import { calculateScore } from './scoring';
import { Bracket, Results } from './types';

const ROUND_KEYS = ['r0', 'r1', 'r2', 'r3', 'r4'] as const;

function buildRecapContext(brackets: Bracket[], results: Results, targetDate: string): string {
  // Find matches that completed on or before targetDate with a result set
  const completedToday: { match: string; winner: string; round: string; index: number }[] = [];

  for (let i = 0; i < 16; i++) {
    if (results.r0[i] && ROUND_OF_32[i].date === formatMatchDate(targetDate)) {
      completedToday.push({
        match: `${ROUND_OF_32[i].home} vs ${ROUND_OF_32[i].away}`,
        winner: results.r0[i]!,
        round: 'Round of 32',
        index: i,
      });
    }
  }

  // All completed results so far (for running stats)
  const allCompleted: { round: string; index: number; winner: string }[] = [];
  for (let i = 0; i < 16; i++) {
    if (results.r0[i]) allCompleted.push({ round: 'r0', index: i, winner: results.r0[i]! });
  }

  // Per-match bracket stats for completed matches
  const matchStats = completedToday.map(({ match, winner, round, index }) => {
    const rk = 'r0' as const;
    const correct = brackets.filter(b => b.picks[rk][index] === winner).length;
    const wrong = brackets.filter(b => b.picks[rk][index] && b.picks[rk][index] !== winner).length;
    const correctNames = brackets.filter(b => b.picks[rk][index] === winner).map(b => b.name);
    const wrongNames = brackets.filter(b => b.picks[rk][index] && b.picks[rk][index] !== winner).map(b => b.name);
    return { match, winner, correct, wrong, correctNames, wrongNames, total: correct + wrong };
  });

  // Champion pick distribution
  const champCounts: Record<string, string[]> = {};
  for (const b of brackets) {
    if (b.picks.champion) {
      if (!champCounts[b.picks.champion]) champCounts[b.picks.champion] = [];
      champCounts[b.picks.champion].push(b.name);
    }
  }
  const champSorted = Object.entries(champCounts).sort((a, b) => b[1].length - a[1].length);

  // Current leaderboard (top 5)
  const scored = brackets
    .map(b => ({ name: b.name, score: calculateScore(b.picks, results) }))
    .sort((a, b) => b.score.points - a.score.points || a.name.localeCompare(b.name))
    .slice(0, 10);

  // Bold / unusual picks
  const unusualPicks: string[] = [];
  for (const b of brackets) {
    for (let i = 0; i < 16; i++) {
      const pick = b.picks.r0[i];
      if (!pick) continue;
      const match = ROUND_OF_32[i];
      const isUnderdog = pick === match.away; // away team is generally the underdog
      const onlyOne = brackets.filter(br => br.picks.r0[i] === pick).length === 1;
      if (onlyOne && isUnderdog) {
        unusualPicks.push(`${b.name} is the ONLY person who picked ${pick} (vs ${pick === match.home ? match.away : match.home})`);
      }
    }
    // Solo champion pick
    if (b.picks.champion && champCounts[b.picks.champion]?.length === 1) {
      unusualPicks.push(`${b.name} is the ONLY person picking ${b.picks.champion} 🏆 to win it all`);
    }
  }

  // Upcoming matches (not yet played)
  const upcoming = ROUND_OF_32
    .map((m, i) => ({ ...m, i }))
    .filter(m => !results.r0[m.i]);

  return `
TODAY'S DATE: ${targetDate}
TOTAL BRACKETS SUBMITTED: ${brackets.length}

=== MATCHES COMPLETED TODAY ===
${matchStats.length === 0 ? 'No matches played today yet.' : matchStats.map(s => `
Match: ${s.match}
Winner: ${s.winner} ${TEAM_FLAGS[s.winner] || ''}
Bracket accuracy: ${s.correct}/${s.total} got it right (${Math.round((s.correct / s.total) * 100)}%)
✅ Correct picks: ${s.correctNames.join(', ')}
❌ Wrong picks: ${s.wrongNames.join(', ')}
`).join('\n')}

=== CURRENT LEADERBOARD (top 10) ===
${scored.map((s, i) => `${i + 1}. ${s.name} — ${s.score.points} pts`).join('\n')}

=== CHAMPION PICK DISTRIBUTION ===
${champSorted.map(([team, names]) => `${team} ${TEAM_FLAGS[team] || ''}: ${names.length} picks (${names.join(', ')})`).join('\n')}

=== BOLD / UNIQUE PICKS ===
${unusualPicks.length > 0 ? unusualPicks.join('\n') : 'No unique solo picks yet.'}

=== UPCOMING MATCHES STILL TO PLAY ===
${upcoming.map(m => `${m.home} vs ${m.away} — ${m.date}`).join('\n')}
`.trim();
}

function formatMatchDate(isoDate: string): string {
  // Convert "2026-06-29" → "Jun 29" to match ROUND_OF_32 date format
  const d = new Date(isoDate + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const RECAP_SYSTEM_PROMPT = `You are an energetic, funny sports broadcaster writing a daily World Cup bracket recap for a family group chat.
Your style: punchy, emoji-heavy, like ESPN SportsCenter meets a family WhatsApp group.
Keep it fun, tease the bad pickers (gently!), celebrate the good ones, hype up the drama.
You can mention real World Cup context, fun football facts, or historical trivia to add flavor.
Write in a natural, conversational tone — not too long, not too short.
Use line breaks generously for readability.
Do NOT use markdown headers (##) — use emojis as section markers instead.
Write the recap body only (no title — that is provided separately).`;

export async function generateAndPostRecap(date: string): Promise<{ success: boolean; message: string; title: string; body: string }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const [brackets, results] = await Promise.all([getAllBrackets(), getResults()]);
    const context = buildRecapContext(brackets, results, date);

    const formattedDate = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: RECAP_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Write the daily bracket recap for ${formattedDate}. Here is all the data you need:\n\n${context}\n\nWrite a fun, engaging recap. Include at least one interesting World Cup fact or piece of context. Call out bold/unique picks by name. Be specific with numbers (X out of Y got it right).`,
        },
      ],
    });

    const body = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');

    if (!body.trim()) throw new Error('Claude returned empty recap');

    // Auto-generate a punchy title
    const titleRes = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      messages: [
        {
          role: 'user',
          content: `Write a short punchy title (max 10 words, include an emoji) for this World Cup bracket recap:\n${body.slice(0, 300)}\n\nRespond with ONLY the title, nothing else.`,
        },
      ],
    });

    const title = (titleRes.content[0] as { type: 'text'; text: string }).text.trim();

    await saveRecap({ date, title, body, createdAt: new Date().toISOString() });

    return { success: true, message: 'Recap generated and posted', title, body };
  } catch (error) {
    return {
      success: false,
      message: `Recap generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      title: '',
      body: '',
    };
  }
}
