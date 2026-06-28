import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getAllBrackets, saveBracket, getResults } from '@/lib/storage';
import { calculateScore } from '@/lib/scoring';
import { Picks } from '@/lib/types';

export async function GET() {
  try {
    const [brackets, results] = await Promise.all([getAllBrackets(), getResults()]);
    const scored = brackets.map(b => ({
      ...b,
      score: calculateScore(b.picks, results),
    }));
    // Sort by points desc
    scored.sort((a, b) => b.score.points - a.score.points || a.name.localeCompare(b.name));
    return NextResponse.json(scored);
  } catch (error) {
    console.error('GET /api/brackets error:', error);
    return NextResponse.json({ error: 'Failed to fetch brackets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, picks } = body as { name: string; picks: Picks };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (name.trim().length > 50) {
      return NextResponse.json({ error: 'Name must be 50 characters or less' }, { status: 400 });
    }
    if (!picks || !Array.isArray(picks.r0) || picks.r0.length !== 16) {
      return NextResponse.json({ error: 'Invalid picks structure' }, { status: 400 });
    }

    // Validate all picks are filled
    const rounds = ['r0', 'r1', 'r2', 'r3', 'r4'] as const;
    const sizes = [16, 8, 4, 2, 1];
    for (let r = 0; r < rounds.length; r++) {
      for (let i = 0; i < sizes[r]; i++) {
        if (!picks[rounds[r]][i]) {
          return NextResponse.json({ error: `Missing pick in ${rounds[r]}[${i}]` }, { status: 400 });
        }
      }
    }
    if (!picks.champion) {
      return NextResponse.json({ error: 'Champion pick required' }, { status: 400 });
    }

    const bracket = {
      id: uuidv4(),
      name: name.trim(),
      picks,
      createdAt: new Date().toISOString(),
    };

    await saveBracket(bracket);
    return NextResponse.json({ id: bracket.id }, { status: 201 });
  } catch (error) {
    console.error('POST /api/brackets error:', error);
    return NextResponse.json({ error: 'Failed to save bracket' }, { status: 500 });
  }
}
