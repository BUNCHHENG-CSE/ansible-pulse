import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isNeonConfigured } from '@/lib/neon';

export async function GET() {
  const startTime = performance.now();
  const dbUrl = process.env.DATABASE_URL || 'file:./ansible_pulse.db';
  const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');
  const isNeon = isPostgres && (isNeonConfigured() || dbUrl.includes('neon.tech'));

  try {
    // Run simple fast query to measure latency
    const count = await prisma.scanRun.count();
    const latency = Math.round((performance.now() - startTime) * 100) / 100;

    const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');

    return NextResponse.json({
      status: 'healthy',
      connected: true,
      dialect: isNeon ? 'Neon Serverless PostgreSQL' : (isPostgres ? 'PostgreSQL' : 'SQLite (Embedded)'),
      version: isPostgres ? 'PostgreSQL 16 (Neon)' : 'SQLite 3',
      latency_ms: latency,
      active_connections: 1,
      database_url: maskedUrl,
      pool: {
        size: isPostgres ? 10 : 1,
        total: count
      }
    });
  } catch (err: any) {
    const latency = Math.round((performance.now() - startTime) * 100) / 100;
    return NextResponse.json({
      status: 'error',
      connected: false,
      dialect: isPostgres ? 'PostgreSQL (Neon)' : 'SQLite',
      latency_ms: latency,
      error: err.message
    }, { status: 200 });
  }
}
