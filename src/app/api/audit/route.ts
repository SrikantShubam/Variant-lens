/**
 * AUDIT API ROUTE - Admin endpoint for audit log access
 * 
 * Provides read-only access to audit data for organization admins.
 * GET /api/audit              → Summary stats (JSON)
 * GET /api/audit?format=csv   → Full audit log as CSV
 * GET /api/audit?format=json  → Recent entries as JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRecentAuditEntries, getAuditSummary, exportAuditCSV } from '@/lib/audit-logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // Strict Security Check
  const expectedKey = process.env.ADMIN_API_KEY;
  if (!expectedKey) {
    // Fail closed if server is misconfigured
    console.error('[Config] CRITICAL: ADMIN_API_KEY is not set. Refusing to serve audit traffic.');
    return new NextResponse('Service Misconfigured', { status: 503 });
  }

  const authHeader = request.headers.get('x-admin-api-key');
  if (!authHeader || authHeader !== expectedKey) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const format = request.nextUrl.searchParams.get('format') || 'summary';
  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 100;

  switch (format) {
    case 'csv': {
      const csv = exportAuditCSV();
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="variantlens-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    case 'json': {
      const entries = getRecentAuditEntries(limit);
      return NextResponse.json({
        count: entries.length,
        entries,
      });
    }

    default: {
      // Summary view
      const summary = getAuditSummary();
      return NextResponse.json({
        ...summary,
        exportFormats: {
          csv: '/api/audit?format=csv',
          json: '/api/audit?format=json&limit=100',
        },
      });
    }
  }
}
