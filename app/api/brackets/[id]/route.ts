import { NextRequest, NextResponse } from 'next/server';
import { getBracket, getResults } from '@/lib/storage';
import { calculateScore } from '@/lib/scoring';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const [bracket, results] = await Promise.all([getBracket(params.id), getResults()]);
    if (!bracket) return NextResponse.json({ error: 'Bracket not found' }, { status: 404 });
    return NextResponse.json({ ...bracket, score: calculateScore(bracket.picks, results) });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch bracket' }, { status: 500 });
  }
}
