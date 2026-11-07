import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20', 10);
  try {
    const risks = await prisma.riskFlag.findMany({
      orderBy: { riskScore: 'desc' },
      take: limit
    });
    return NextResponse.json({
      orm: 'Prisma ORM',
      assets: risks,
      count: risks.length
    });
  } catch (err: any) {
    return NextResponse.json({
      orm: 'Prisma ORM',
      assets: [],
      count: 0,
      error: err.message
    });
  }
}
