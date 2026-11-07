import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isNeonConfigured } from '@/lib/neon';

export async function GET() {
  const start = performance.now();
  const dbUrl = process.env.DATABASE_URL || '';
  const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');
  const isNeon = isPostgres && (isNeonConfigured() || dbUrl.includes('neon.tech'));

  try {
    const [totalScans, totalAssets, totalTasks, totalClusters, totalRisks] = await Promise.all([
      prisma.scanRun.count(),
      prisma.asset.count(),
      prisma.task.count(),
      prisma.duplicateCluster.count(),
      prisma.riskFlag.count(),
    ]);

    const latency = Math.round((performance.now() - start) * 100) / 100;

    return NextResponse.json({
      status: 'healthy',
      orm: `Prisma ORM (${isNeon ? 'Neon Serverless Postgres' : (isPostgres ? 'PostgreSQL' : 'SQLite')})`,
      connected: true,
      latency_ms: latency,
      engine: 'Prisma Client JS (v6.19.3)',
      counts: {
        scan_runs: totalScans,
        assets: totalAssets,
        tasks: totalTasks,
        duplicate_clusters: totalClusters,
        risk_flags: totalRisks
      }
    });
  } catch (err: any) {
    const latency = Math.round((performance.now() - start) * 100) / 100;
    return NextResponse.json({
      status: 'offline',
      orm: 'Prisma ORM',
      connected: false,
      latency_ms: latency,
      error: err.message
    });
  }
}
