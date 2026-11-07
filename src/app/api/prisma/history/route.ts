import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10', 10);
  try {
    const history = await prisma.scanRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return NextResponse.json({
      orm: 'Prisma ORM',
      history,
      count: history.length
    });
  } catch (err: any) {
    return NextResponse.json({
      orm: 'Prisma ORM',
      history: [],
      count: 0,
      error: err.message
    });
  }
}
