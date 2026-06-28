import { NextResponse } from 'next/server';
import { getResults } from '@/lib/storage';

export async function GET() {
  try {
    const results = await getResults();
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
  }
}
