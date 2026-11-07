import { NextRequest, NextResponse } from 'next/server';
import { orchestrator } from '@/lib/scanner/orchestrator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    let repos: string[] = [];
    let ciLogs: string | undefined = undefined;

    if (body.use_demo || !body.repos || body.repos.length === 0) {
      repos = orchestrator.getDefaultDemoRepos();
      ciLogs = orchestrator.getDefaultCILogsDir();
    } else {
      repos = body.repos;
      ciLogs = body.ci_logs;
    }

    const summary = orchestrator.scanRepositories(repos, ciLogs);

    return NextResponse.json({
      status: 'success',
      message: `Scanned ${repos.length} repositories successfully.`,
      summary
    });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
