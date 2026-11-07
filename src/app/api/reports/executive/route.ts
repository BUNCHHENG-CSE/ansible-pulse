import { NextRequest, NextResponse } from 'next/server';
import { orchestrator } from '@/lib/scanner/orchestrator';
import { SecurityLinter } from '@/lib/analytics/security-linter';
import { ReportGenerator } from '@/lib/analytics/report-generator';

export async function GET(request: NextRequest) {
  orchestrator.ensureInitialized();
  if (!orchestrator.cachedSecurity) {
    orchestrator.cachedSecurity = SecurityLinter.auditAssets(orchestrator.cachedAssets);
  }

  const format = request.nextUrl.searchParams.get('format') || 'markdown';

  if (format.toLowerCase() === 'html') {
    const html = ReportGenerator.generateHtml(
      orchestrator.cachedSummary!,
      orchestrator.cachedRisks,
      orchestrator.cachedClusters,
      orchestrator.cachedSecurity
    );
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    });
  } else if (format.toLowerCase() === 'json') {
    return NextResponse.json({
      summary: orchestrator.cachedSummary,
      security: orchestrator.cachedSecurity,
      top_risks: orchestrator.cachedRisks.slice(0, 10),
      duplicate_clusters: orchestrator.cachedClusters
    });
  } else {
    const md = ReportGenerator.generateMarkdown(
      orchestrator.cachedSummary!,
      orchestrator.cachedRisks,
      orchestrator.cachedClusters,
      orchestrator.cachedSecurity
    );
    return new NextResponse(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8'
      }
    });
  }
}
