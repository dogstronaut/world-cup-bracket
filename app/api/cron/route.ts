import { NextRequest, NextResponse } from 'next/server';
import { syncResults } from '@/lib/sync';

export async function GET(request: NextRequest) {
  // Verify cron secret if configured
  if (process.env.CRON_SECRET) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  try {
    const result = await syncResults();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Cron sync failed' }, { status: 500 });
  }
}
