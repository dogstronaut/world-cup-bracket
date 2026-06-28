import Anthropic from '@anthropic-ai/sdk';
import { Results } from './types';
import { getResults, saveResults, addSyncLog } from './storage';
import { ROUND_OF_32 } from './bracket';

const ESPN_URL = 'https://www.espn.com/soccer/schedule/_/league/fifa.world';

const PARSE_SYSTEM_PROMPT = `You are a sports data assistant for the 2026 FIFA World Cup knockout stage.
You will be given the text content scraped from the ESPN World Cup schedule page.
Extract all COMPLETED match results from it.

Use ONLY these EXACT team name spellings (no variations, no abbreviations):
Canada, South Africa, Brazil, Japan, Germany, Paraguay, Netherlands, Morocco, Ivory Coast, Norway, France, Sweden, Mexico, Ecuador, England, DR Congo, Belgium, Senegal, USA, Bosnia-Herzegovina, Spain, Austria, Portugal, Croatia, Switzerland, Algeria, Australia, Egypt, Argentina, Cape Verde, Colombia, Ghana

The Round of 32 matches in bracket order are:
Index 0: Germany vs Paraguay (Jun 29)
Index 1: France vs Sweden (Jun 30)
Index 2: South Africa vs Canada (Jun 28)
Index 3: Netherlands vs Morocco (Jun 29)
Index 4: Portugal vs Croatia (Jul 2)
Index 5: Spain vs Austria (Jul 2)
Index 6: USA vs Bosnia-Herzegovina (Jul 1)
Index 7: Belgium vs Senegal (Jul 1)
Index 8: Brazil vs Japan (Jun 29)
Index 9: Ivory Coast vs Norway (Jun 30)
Index 10: Mexico vs Ecuador (Jun 30)
Index 11: England vs DR Congo (Jul 1)
Index 12: Argentina vs Cape Verde (Jul 3)
Index 13: Australia vs Egypt (Jul 3)
Index 14: Switzerland vs Algeria (Jul 2)
Index 15: Colombia vs Ghana (Jul 3)

Round of 16 (r1): winners from r0, paired as (0,1), (2,3), (4,5), (6,7), (8,9), (10,11), (12,13), (14,15)
Quarterfinals (r2): winners from r1, paired as (0,1), (2,3), (4,5), (6,7)
Semifinals (r3): winners from r2, paired as (0,1), (2,3)
Final (r4): winners from r3[0] vs r3[1]

IMPORTANT: Only include a winner if the match is shown as FINAL/COMPLETED on the ESPN page.
Do NOT guess or infer results for matches not shown as finished.

Return ONLY this JSON (no other text, no markdown):
{
  "r0": [16 values],
  "r1": [8 values],
  "r2": [4 values],
  "r3": [2 values],
  "r4": [1 value],
  "champion": "string or null"
}

Each value is either a team name string (exact spelling) or null if not yet played/not found on the page.`;

async function fetchESPNPage(): Promise<string> {
  const res = await fetch(ESPN_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    next: { revalidate: 0 }, // always fresh
  });

  if (!res.ok) throw new Error(`ESPN fetch failed: ${res.status} ${res.statusText}`);

  const html = await res.text();

  // Strip scripts, styles, and HTML tags to get readable text
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
    .slice(0, 20000); // cap at 20k chars to stay within token limits

  if (text.length < 500) {
    throw new Error('ESPN page returned too little content — may be blocked or JS-only');
  }

  return text;
}

export async function syncResults(): Promise<{ success: boolean; message: string; changes: number }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    // Step 1: Fetch the ESPN schedule page directly
    const pageText = await fetchESPNPage();

    // Step 2: Pass the page content to Claude to extract results.
    // No web_search tool needed — Claude is just parsing text we provide.
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: PARSE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here is the text content from the ESPN World Cup schedule page. Extract all completed match results and return the JSON.\n\n---\n${pageText}\n---`,
        },
      ],
    });

    // Extract text from response
    let jsonText = '';
    for (const block of response.content) {
      if (block.type === 'text') jsonText += block.text;
    }

    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`No JSON found in response. Got: ${jsonText.slice(0, 300)}`);
    }

    const newResults: Results = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(newResults.r0) || newResults.r0.length !== 16) {
      throw new Error('Invalid results structure returned');
    }

    // Validate R32: each winner must be one of the two teams in that match
    for (let i = 0; i < 16; i++) {
      const winner = newResults.r0[i];
      if (winner !== null) {
        const { home, away } = ROUND_OF_32[i];
        if (winner !== home && winner !== away) {
          console.warn(`Sync: invalid r0[${i}] winner "${winner}" (expected ${home} or ${away}) — clearing`);
          newResults.r0[i] = null;
        }
      }
    }

    // Additive merge — only fill in null slots, never overwrite existing results
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

    const message = `Synced from ESPN. ${changes} result(s) updated.`;
    await addSyncLog({ timestamp: new Date().toISOString(), success: true, message, changes });
    return { success: true, message, changes };

  } catch (error) {
    const message = `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    await addSyncLog({ timestamp: new Date().toISOString(), success: false, message, changes: 0 });
    return { success: false, message, changes: 0 };
  }
}
