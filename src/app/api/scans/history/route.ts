import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10', 10);

  try {
    const runs = await prisma.scanRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    const formatted = runs.map(r => ({
      scan_id: r.id,
      created_at: r.createdAt.toISOString(),
      total_repos: r.totalReposScanned,
      total_playbooks: r.totalPlaybooks,
      total_roles: r.totalRoles,
      total_tasks: r.totalTasks,
      duplicate_clusters: r.duplicateClustersCount,
      high_risk_assets: r.highRiskAssetsCount,
      zombie_core_assets: r.zombieCoreAssetsCount,
      health_score: r.overallHealthScore,
      status: r.status
    }));

    return NextResponse.json({
      history: formatted,
      count: formatted.length
    });
  } catch (err: any) {
    return NextResponse.json({
      history: [],
      count: 0,
      error: err.message
    });
  }
}
