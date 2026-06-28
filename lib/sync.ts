import Anthropic from '@anthropic-ai/sdk';
import { Results } from './types';
import { getResults, saveResults, addSyncLog } from './storage';
import { ROUND_OF_32 } from './bracket';

const SYNC_SYSTEM_PROMPT = `You are a sports data assistant for the 2026 FIFA World Cup knockout stage.
Search for "2026 FIFA World Cup knockout stage results" and return a JSON object with all completed match results.

Use ONLY these EXACT team name spellings (no variations):
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

Return ONLY this JSON (no other text, no markdown):
{
  "r0": [16 values],
  "r1": [8 values],
  "r2": [4 values],
  "r3": [2 values],
  "r4": [1 value],
  "champion": "string or null"
}

Each value is either a team name string (exact spelling from the list above) or null if the match has not been played yet.`;

export async function syncResults(): Promise<{ success: boolean; message: string; changes: number }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    // web_search_20250305 is a server-side tool — Anthropic executes the search
    // automatically and the model gets the results in its context. No client-side
    // tool-result loop needed; doing so with empty content caused hallucinations.
    const response: any = await (client.messages.create as any)({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYNC_SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [
        {
          role: 'user',
          content: 'Search for the current 2026 FIFA World Cup knockout stage results and return them as the required JSON object. Only include winners for matches that have ACTUALLY been played and completed — do NOT predict or guess future matches.',
        },
      ],
    });

    // Extract text from all content blocks
    let jsonText = '';
    for (const block of response.content) {
      if ((block as any).type === 'text') {
        jsonText += (block as any).text;
      }
    }

    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`No JSON found in response. Got: ${jsonText.slice(0, 300)}`);
    }

    const newResults: Results = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(newResults.r0) || newResults.r0.length !== 16) {
      throw new Error('Invalid results structure');
    }

    // Validate R32 results: each winner must be one of the two teams in that match.
    // This catches hallucinated results (e.g. a team that doesn't play in that slot).
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

    // Count changes vs current results
    const currentResults = await getResults();
    let changes = 0;
    const rounds = ['r0', 'r1', 'r2', 'r3', 'r4'] as const;
    for (const round of rounds) {
      for (let i = 0; i < newResults[round].length; i++) {
        if (newResults[round][i] !== currentResults[round][i]) changes++;
      }
    }
    if (newResults.champion !== currentResults.champion) changes++;

    await saveResults(newResults);

    const message = `Sync successful. ${changes} result(s) updated.`;
    await addSyncLog({ timestamp: new Date().toISOString(), success: true, message, changes });
    return { success: true, message, changes };
  } catch (error) {
    const message = `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    await addSyncLog({ timestamp: new Date().toISOString(), success: false, message, changes: 0 });
    return { success: false, message, changes: 0 };
  }
}
