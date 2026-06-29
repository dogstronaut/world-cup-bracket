import Anthropic from '@anthropic-ai/sdk';
import { Results } from './types';
import { getResults, saveResults, addSyncLog } from './storage';
import { ROUND_OF_32 } from './bracket';

const ESPN_URL = 'https://www.espn.com/soccer/schedule/_/league/fifa.world';

const PARSE_SYSTEM_PROMPT = `You are a sports data assistant for the 2026 FIFA World Cup knockout stage.

You will receive text scraped from the ESPN World Cup schedule page as your PRIMARY source.
You also have access to web_search to VERIFY any result you find — search for the specific match to confirm it is finished before including it.

Rules:
- Only include a result if BOTH the ESPN page AND your web search confirm the match is COMPLETED/FINAL with a final score.
- If ESPN shows a result but you cannot verify it via web search, set that slot to null.
- Do NOT guess, predict, or infer any result. Only report confirmed finished matches.
- A match is only finished if you can find the final scoreline (e.g. "Brazil 2-1 Japan"). Scheduled, upcoming, or "preview" matches must be set to null.
- IMPORTANT: Round of 16, Quarterfinals, Semifinals, and Final slots (r1–r4) should almost always be null since those matches happen weeks after Round of 32. Set them to null unless you have an explicit final score from a completed match.

Use ONLY these EXACT team name spellings:
Canada, South Africa, Brazil, Japan, Germany, Paraguay, Netherlands, Morocco, Ivory Coast, Norway, France, Sweden, Mexico, Ecuador, England, DR Congo, Belgium, Senegal, USA, Bosnia-Herzegovina, Spain, Austria, Portugal, Croatia, Switzerland, Algeria, Australia, Egypt, Argentina, Cape Verde, Colombia, Ghana

Round of 32 bracket order (index → match):
0: Germany vs Paraguay (Jun 29)
1: France vs Sweden (Jun 30)
2: South Africa vs Canada (Jun 28)
3: Netherlands vs Morocco (Jun 29)
4: Portugal vs Croatia (Jul 2)
5: Spain vs Austria (Jul 2)
6: USA vs Bosnia-Herzegovina (Jul 1)
7: Belgium vs Senegal (Jul 1)
8: Brazil vs Japan (Jun 29)
9: Ivory Coast vs Norway (Jun 30)
10: Mexico vs Ecuador (Jun 30)
11: England vs DR Congo (Jul 1)
12: Argentina vs Cape Verde (Jul 3)
13: Australia vs Egypt (Jul 3)
14: Switzerland vs Algeria (Jul 2)
15: Colombia vs Ghana (Jul 3)

Round of 16 (r1): paired as (r0[0],r0[1]), (r0[2],r0[3]), (r0[4],r0[5]), (r0[6],r0[7]), (r0[8],r0[9]), (r0[10],r0[11]), (r0[12],r0[13]), (r0[14],r0[15])
Quarterfinals (r2): paired as (r1[0],r1[1]), (r1[2],r1[3]), (r1[4],r1[5]), (r1[6],r1[7])
Semifinals (r3): paired as (r2[0],r2[1]), (r2[2],r2[3])
Final (r4): r3[0] vs r3[1]

Return ONLY this JSON (no markdown, no extra text):
{
  "r0": [16 values],
  "r1": [8 values],
  "r2": [4 values],
  "r3": [2 values],
  "r4": [1 value],
  "champion": "string or null"
}

Each value is a team name string (exact spelling) or null if not yet confirmed as finished.`;

async function fetchESPNPage(): Promise<string> {
  const res = await fetch(ESPN_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    // @ts-ignore — Next.js cache option
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`ESPN fetch failed: ${res.status} ${res.statusText}`);

  const html = await res.text();

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 18000);

  if (text.length < 500) {
    throw new Error('ESPN page returned too little content — may be JS-rendered or blocked');
  }

  return text;
}

function extractBalancedJSON(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export async function syncResults(): Promise<{ success: boolean; message: string; changes: number }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    // Step 1: Fetch ESPN page as the primary source
    let espnText: string;
    let espnNote = '';
    try {
      espnText = await fetchESPNPage();
    } catch (err) {
      // If ESPN fetch fails, still attempt with web search alone
      espnText = '';
      espnNote = `Note: ESPN page could not be fetched (${err instanceof Error ? err.message : 'unknown'}). Rely on web search only and be conservative — only return results you can confirm with high confidence.\n\n`;
    }

    // Step 2: Pass ESPN content to Claude WITH web_search available for cross-referencing.
    // web_search_20250305 is server-side — Anthropic executes searches automatically.
    const userMessage = espnText
      ? `${espnNote}PRIMARY SOURCE — ESPN World Cup schedule page:\n---\n${espnText}\n---\n\nFor each completed match you find above, use web_search to verify the result is final before including it in your JSON. Return only cross-confirmed results.`
      : `${espnNote}Use web_search to find all completed 2026 FIFA World Cup knockout stage results. Only include matches confirmed as FINAL. Return the required JSON.`;

    const response: any = await (client.messages.create as any)({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: PARSE_SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: userMessage }],
    });

    // Extract text blocks from response
    let jsonText = '';
    for (const block of response.content) {
      if ((block as any).type === 'text') jsonText += (block as any).text;
    }

    const jsonStr = extractBalancedJSON(jsonText);
    if (!jsonStr) {
      throw new Error(`No JSON in response. Got: ${jsonText.slice(0, 300)}`);
    }

    const newResults: Results = JSON.parse(jsonStr);

    if (!Array.isArray(newResults.r0) || newResults.r0.length !== 16) {
      throw new Error('Invalid results structure returned');
    }

    // Validate R32: winner must be one of the two actual teams in that slot
    for (let i = 0; i < 16; i++) {
      const winner = newResults.r0[i];
      if (winner !== null) {
        const { home, away } = ROUND_OF_32[i];
        if (winner !== home && winner !== away) {
          console.warn(`Sync: invalid r0[${i}] winner "${winner}" (${home} vs ${away}) — cleared`);
          newResults.r0[i] = null;
        }
      }
    }

    // Chain validation: r1[i] requires r0[2i] and r0[2i+1] both filled (same for later rounds)
    for (let i = 0; i < 8; i++) {
      if (!newResults.r0[i * 2] || !newResults.r0[i * 2 + 1]) {
        if (newResults.r1[i]) {
          console.warn(`Sync: clearing hallucinated r1[${i}] — r0 pair not complete`);
          newResults.r1[i] = null;
        }
      }
    }
    for (let i = 0; i < 4; i++) {
      if (!newResults.r1[i * 2] || !newResults.r1[i * 2 + 1]) {
        if (newResults.r2[i]) {
          console.warn(`Sync: clearing hallucinated r2[${i}] — r1 pair not complete`);
          newResults.r2[i] = null;
        }
      }
    }
    for (let i = 0; i < 2; i++) {
      if (!newResults.r2[i * 2] || !newResults.r2[i * 2 + 1]) {
        if (newResults.r3[i]) {
          console.warn(`Sync: clearing hallucinated r3[${i}] — r2 pair not complete`);
          newResults.r3[i] = null;
        }
      }
    }
    if (!newResults.r3[0] || !newResults.r3[1]) {
      if (newResults.r4[0]) {
        console.warn(`Sync: clearing hallucinated r4[0] — r3 pair not complete`);
        newResults.r4[0] = null;
      }
    }

    // Additive merge — only fill null slots, never overwrite existing data
    const currentResults = await getResults();
    const merged: Results = {
      r0: [...currentResults.r0],
      r1: [...currentResults.r1],
      r2: [...currentResults.r2],
      r3: [...currentResults.r3],
      r4: [...currentResults.r4],
      champion: currentResults.champion,
    };

    let changes = 0;
    const rounds = ['r0', 'r1', 'r2', 'r3', 'r4'] as const;
    for (const round of rounds) {
      for (let i = 0; i < newResults[round].length; i++) {
        if (merged[round][i] === null && newResults[round][i]) {
          merged[round][i] = newResults[round][i];
          changes++;
        }
      }
    }
    if (!merged.champion && newResults.champion) {
      merged.champion = newResults.champion;
      changes++;
    }

    await saveResults(merged);

    const sourceNote = espnText ? 'ESPN + web search' : 'web search only';
    const message = `Synced (${sourceNote}). ${changes} result(s) updated.`;
    await addSyncLog({ timestamp: new Date().toISOString(), success: true, message, changes });
    return { success: true, message, changes };

  } catch (error) {
    const message = `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    await addSyncLog({ timestamp: new Date().toISOString(), success: false, message, changes: 0 });
    return { success: false, message, changes: 0 };
  }
}
