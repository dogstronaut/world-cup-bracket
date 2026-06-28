import { NextRequest, NextResponse } from 'next/server';
import { getSyncLog, getLastSync, getResults, saveResults, resetResults, deleteAllBrackets } from '@/lib/storage';
import { syncResults } from '@/lib/sync';

function checkAuth(request: NextRequest) {
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${process.env.ADMIN_PASSWORD}`;
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const [syncLog, lastSync, results] = await Promise.all([getSyncLog(), getLastSync(), getResults()]);
    return NextResponse.json({ syncLog, lastSync, results });
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

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Admin action failed' }, { status: 500 });
  }
}
