import { NextRequest, NextResponse } from 'next/server';
import { getSyncLog, getLastSync, getResults, saveResults, resetResults, deleteAllBrackets, getAllBrackets, deleteBracket, updateBracketName, saveRecap, getAllRecaps, deleteRecap } from '@/lib/storage';
import { syncResults } from '@/lib/sync';

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
