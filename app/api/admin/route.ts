import { NextRequest, NextResponse } from 'next/server';
import { getSyncLog, getLastSync, getResults, saveResults, resetResults, deleteAllBrackets, getAllBrackets, deleteBracket, updateBracketName, saveRecap, getAllRecaps, deleteRecap } from '@/lib/storage';
import { syncResults } from '@/lib/sync';
import { generateAndPostRecap } from '@/lib/recapGen';

function checkAuth(request: NextRequest) {
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${process.env.ADMIN_PASSWORD}`;
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const [syncLog, lastSync, results, brackets, recaps] = await Promise.all([getSyncLog(), getLastSync(), getResults(), getAllBrackets(), getAllRecaps()]);
    return NextResponse.json({ syncLog, lastSync, results, brackets, recaps });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch admin data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'reset_results') {
      await resetResults();
      return NextResponse.json({ success: true, message: 'Results reset' });
    }

    if (action === 'clean_results') {
      const results = await getResults();
      let cleared = 0;
      // r1[i] requires both r0[2i] and r0[2i+1]
      for (let i = 0; i < 8; i++) {
        if ((!results.r0[i * 2] || !results.r0[i * 2 + 1]) && results.r1[i]) {
          results.r1[i] = null; cleared++;
        }
      }
      // r2[i] requires both r1[2i] and r1[2i+1]
      for (let i = 0; i < 4; i++) {
        if ((!results.r1[i * 2] || !results.r1[i * 2 + 1]) && results.r2[i]) {
          results.r2[i] = null; cleared++;
        }
      }
      // r3[i] requires both r2[2i] and r2[2i+1]
      for (let i = 0; i < 2; i++) {
        if ((!results.r2[i * 2] || !results.r2[i * 2 + 1]) && results.r3[i]) {
          results.r3[i] = null; cleared++;
        }
      }
      // r4[0] requires both r3[0] and r3[1]
      if ((!results.r3[0] || !results.r3[1]) && results.r4[0]) {
        results.r4[0] = null; cleared++;
      }
      if (!results.r3[0] || !results.r3[1]) {
        if (results.champion) { results.champion = null; cleared++; }
      }
      await saveResults(results);
      return NextResponse.json({ success: true, message: `Cleaned ${cleared} invalid result(s)` });
    }

    if (action === 'delete_all_brackets') {
      await deleteAllBrackets();
      return NextResponse.json({ success: true, message: 'All brackets deleted' });
    }

    if (action === 'rename_bracket') {
      const { id, name } = body;
      if (!id || !name?.trim()) return NextResponse.json({ error: 'Missing id or name' }, { status: 400 });
      await updateBracketName(id, name.trim());
      return NextResponse.json({ success: true, message: `Renamed to "${name.trim()}"` });
    }

    if (action === 'delete_bracket') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Missing bracket id' }, { status: 400 });
      await deleteBracket(id);
      return NextResponse.json({ success: true, message: 'Bracket deleted' });
    }

    if (action === 'override_result') {
      const { round, index, winner } = body;
      const results = await getResults();
      const roundKey = round as 'r0' | 'r1' | 'r2' | 'r3' | 'r4';
      results[roundKey][index] = winner || null;
      // Sync champion with r4[0]
      if (round === 'r4' && index === 0) {
        results.champion = winner || null;
      }
      await saveResults(results);
      return NextResponse.json({ success: true, message: `Updated ${round}[${index}] = ${winner || 'null'}` });
    }

    if (action === 'trigger_sync') {
      const result = await syncResults();
      return NextResponse.json(result);
    }

    if (action === 'generate_recap') {
      const { date } = body;
      if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 });
      const result = await generateAndPostRecap(date);
      return NextResponse.json(result);
    }

    if (action === 'save_recap') {
      const { date, title, body: recapBody } = body;
      if (!date || !title?.trim() || !recapBody?.trim()) {
        return NextResponse.json({ error: 'Missing date, title, or body' }, { status: 400 });
      }
      await saveRecap({ date, title: title.trim(), body: recapBody.trim(), createdAt: new Date().toISOString() });
      return NextResponse.json({ success: true, message: 'Recap saved' });
    }

    if (action === 'delete_recap') {
      const { date } = body;
      if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 });
      await deleteRecap(date);
      return NextResponse.json({ success: true, message: 'Recap deleted' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Admin action failed' }, { status: 500 });
  }
}
