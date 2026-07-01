import Anthropic from '@anthropic-ai/sdk';
import { ROUND_OF_32, ROUND_POINTS, TEAM_FLAGS } from './bracket';
import { getAllBrackets, getResults, saveRecap } from './storage';
import { calculateScore } from './scoring';
import { Bracket, Results } from './types';

const ROUND_KEYS = ['r0', 'r1', 'r2', 'r3', 'r4'] as const;

// Convert "Jun 28", "Jul 1" etc. to a sortable number (month * 100 + day)
function matchDateToSortKey(matchDate: string): number {
  const months: Record<string, number> = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
  const [mon, day] = matchDate.split(' ');
  return (months[mon] || 0) * 100 + parseInt(day || '0', 10);
}

function buildRecapContext(brackets: Bracket[], results: Results, targetDate: string): string {
  const todayFormatted = formatMatchDate(targetDate); // e.g. "Jul 1"
  const todayKey = matchDateToSortKey(todayFormatted);

  // Compute yesterday's formatted date
  const yesterdayISO = new Date(new Date(targetDate + 'T12:00:00Z').getTime() - 86400000).toISOString().slice(0, 10);
  const yesterdayFormatted = formatMatchDate(yesterdayISO); // e.g. "Jun 30"
  const yesterdayKey = matchDateToSortKey(yesterdayFormatted);

  // Build stats for a completed R32 match
  function matchStats(i: number) {
    const winner = results.r0[i]!;
    const correctNames = brackets.filter(b => b.picks.r0[i] === winner).map(b => b.name);
    const wrongNames = brackets.filter(b => b.picks.r0[i] && b.picks.r0[i] !== winner).map(b => b.name);
    return {
      match: `${ROUND_OF_32[i].home} vs ${ROUND_OF_32[i].away}`,
      date: ROUND_OF_32[i].date,
      winner,
      correctNames,
      wrongNames,
      total: correctNames.length + wrongNames.length,
    };
  }

  // Bucket completed matches by date
  const completedYesterday: ReturnType<typeof matchStats>[] = [];
  const completedToday: ReturnType<typeof matchStats>[] = [];
  const completedEarlier: ReturnType<typeof matchStats>[] = [];
  for (let i = 0; i < 16; i++) {
    if (!results.r0[i]) continue;
    const key = matchDateToSortKey(ROUND_OF_32[i].date);
    const s = matchStats(i);
    if (key === todayKey) completedToday.push(s);
    else if (key === yesterdayKey) completedYesterday.push(s);
    else completedEarlier.push(s);
  }

  type UpcomingMatch = { match: string; date: string; home: string; away: string; homePickers: string[]; awayPickers: string[] };
  // Only show today's unplayed matches — no future days
  const upcomingToday: UpcomingMatch[] = [];
  for (let i = 0; i < 16; i++) {
    if (results.r0[i]) continue;
    const m = ROUND_OF_32[i];
    if (matchDateToSortKey(m.date) !== todayKey) continue;
    const homePickers = brackets.filter(b => b.picks.r0[i] === m.home).map(b => b.name);
    const awayPickers = brackets.filter(b => b.picks.r0[i] === m.away).map(b => b.name);
    upcomingToday.push({ match: `${m.home} vs ${m.away}`, date: m.date, home: m.home, away: m.away, homePickers, awayPickers });
  }

  // Champion pick distribution
  const champCounts: Record<string, string[]> = {};
  for (const b of brackets) {
    if (b.picks.champion) {
      if (!champCounts[b.picks.champion]) champCounts[b.picks.champion] = [];
      champCounts[b.picks.champion].push(b.name);
    }
  }
  const champSorted = Object.entries(champCounts).sort((a, b) => b[1].length - a[1].length);

  // Leaderboard top 10
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
      const m = ROUND_OF_32[i];
      const onlyOne = brackets.filter(br => br.picks.r0[i] === pick).length === 1;
      if (onlyOne && pick === m.away) {
        unusualPicks.push(`${b.name} is the ONLY person who picked ${pick} to beat ${m.home}`);
      }
    }
    if (b.picks.champion && champCounts[b.picks.champion]?.length === 1) {
      unusualPicks.push(`${b.name} is the ONLY person picking ${b.picks.champion} to win it all`);
    }
  }

  function renderCompleted(s: ReturnType<typeof matchStats>) {
    return `${s.match} → Winner: ${s.winner} ${TEAM_FLAGS[s.winner] || ''}
  ✅ Got it right (${s.correctNames.length}/${s.total}): ${s.correctNames.join(', ') || 'nobody'}
  ❌ Got it wrong (${s.wrongNames.length}/${s.total}): ${s.wrongNames.join(', ') || 'nobody'}`;
  }

  function renderUpcoming(m: UpcomingMatch) {
    return `${m.match}
  → ${m.home}: ${m.homePickers.length} picks (${m.homePickers.join(', ') || 'nobody'})
  → ${m.away}: ${m.awayPickers.length} picks (${m.awayPickers.join(', ') || 'nobody'})`;
  }

  return `
TODAY'S DATE: ${targetDate} (${todayFormatted})
YESTERDAY: ${yesterdayFormatted}
TOTAL BRACKETS: ${brackets.length}

=== YESTERDAY'S COMPLETED MATCHES (${yesterdayFormatted}) ===
${completedYesterday.length === 0 ? `No completed matches recorded for ${yesterdayFormatted}.` : completedYesterday.map(renderCompleted).join('\n\n')}

=== TODAY'S COMPLETED MATCHES (${todayFormatted}) ===
${completedToday.length === 0 ? `No completed matches recorded for ${todayFormatted} yet.` : completedToday.map(renderCompleted).join('\n\n')}

=== STILL TO PLAY TODAY (${todayFormatted}) ===
${upcomingToday.length === 0 ? "All of today's matches are done." : upcomingToday.map(renderUpcoming).join('\n\n')}

${completedEarlier.length > 0 ? `=== EARLIER COMPLETED MATCHES ===\n${completedEarlier.map(renderCompleted).join('\n\n')}` : ''}

=== CURRENT LEADERBOARD (top 10) ===
${scored.map((s, i) => `${i + 1}. ${s.name} — ${s.score.points} pts (${s.score.correct} correct)`).join('\n')}

=== CHAMPION PICK DISTRIBUTION ===
${champSorted.map(([team, names]) => `${team} ${TEAM_FLAGS[team] || ''}: ${names.length} picks (${names.join(', ')})`).join('\n')}

=== BOLD / UNIQUE PICKS ===
${unusualPicks.length > 0 ? unusualPicks.join('\n') : 'No solo unique picks yet.'}
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
Write the recap body only (no title — that is provided separately).

Structure every recap like this:
1. Yesterday's results — who won each match, how many people got it right, call out names specifically (both correct AND wrong picks)
2. Today's matches — any completed ones with results, plus still-to-play today with pick breakdowns (how many picked each team, name them)
3. Leaderboard update — who's leading, who's falling behind, any close races
4. A fun World Cup fact or historical tidbit relevant to today's matches
5. Bold/unique picks worth watching

DO NOT tease or preview matches scheduled for future days beyond today. Focus only on yesterday and today.`;

export async function generateAndPostRecap(date: string, notes?: string): Promise<{ success: boolean; message: string; title: string; body: string }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const [brackets, results] = await Promise.all([getAllBrackets(), getResults()]);
    const context = buildRecapContext(brackets, results, date);

    const formattedDate = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    });

    const notesSection = notes?.trim()
      ? `\n\n=== EMPHASIS NOTES FROM ADMIN ===\nMake sure to highlight these points in the recap:\n${notes.trim()}`
      : '';

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: RECAP_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Write the daily bracket recap for ${formattedDate}. Here is all the data you need:\n\n${context}${notesSection}\n\nWrite a fun, engaging recap. Include at least one interesting World Cup fact or piece of context. Call out bold/unique picks by name. Be specific with numbers (X out of Y got it right).`,
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

    return { success: true, message: 'Recap generated — review and post when ready', title, body };
  } catch (error) {
    return {
      success: false,
      message: `Recap generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      title: '',
      body: '',
    };
  }
}
