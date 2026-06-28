import { NextRequest, NextResponse } from 'next/server';
import { syncResults } from '@/lib/sync';

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const expected = `Bearer ${process.env.ADMIN_PASSWORD}`;
  if (auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await syncResults();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
