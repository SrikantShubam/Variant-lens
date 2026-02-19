/**
 * AUDIT LOGGER - Organization-Level Query Tracking
 * 
 * Lightweight audit logger for tracking variant analysis requests.
 * Designed for research reproducibility and usage transparency.
 * 
 * Current: Console + in-memory buffer (for serverless/edge).
 * Future: Plug in database, file system, or external service.
 */

import db from './db';

export interface AuditEntry {
  timestamp: string;
  requestId: string;
  hgvs: string;
  gene: string;
  residue: number;
  ip: string;
  status: 'success' | 'error' | 'rate_limited';
  processingMs: number;
  evidenceSources: {
    clinvar: boolean;
    structure: boolean;
    literature: boolean;
  };
  errorCode?: string;
  route?: string;
}

/**
 * Generate a unique request ID for correlation.
 */
function generateRequestId(): string {
  return `vl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Log an audit entry. Persists to SQLite.
 */
export function logAuditEntry(entry: Omit<AuditEntry, 'requestId' | 'timestamp'>): AuditEntry {
  const fullEntry: AuditEntry = {
    ...entry,
    requestId: generateRequestId(),
    timestamp: new Date().toISOString(),
  };

  // Console output (structured JSON for log aggregation)
  console.log(`[AUDIT] ${JSON.stringify(fullEntry)}`);

  try {
    const stmt = db.prepare(`
      INSERT INTO audit_log (
        timestamp, requestId, route, hgvs, gene, status, processingMs, metaJson
      ) VALUES (
        @timestamp, @requestId, @route, @hgvs, @gene, @status, @processingMs, @metaJson
      )
    `);

    stmt.run({
      timestamp: fullEntry.timestamp,
      requestId: fullEntry.requestId,
      route: fullEntry.route || '/api/variant',
      hgvs: fullEntry.hgvs,
      gene: fullEntry.gene,
      status: fullEntry.status,
      processingMs: fullEntry.processingMs,
      metaJson: JSON.stringify({
        residue: fullEntry.residue,
        ip: fullEntry.ip,
        evidenceSources: fullEntry.evidenceSources,
        errorCode: fullEntry.errorCode
      })
    });
  } catch (error) {
    console.error('[AuditDB] Failed to log entry:', error);
    // Don't crash the request if logging fails, but log error to stderr
  }

  return fullEntry;
}

/**
 * Get recent audit entries (for admin dashboard or export).
 */
export function getRecentAuditEntries(limit = 100): AuditEntry[] {
  try {
    const stmt = db.prepare(`
      SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?
    `);
    const rows = stmt.all(limit) as any[];

    return rows.map(row => {
      const meta = JSON.parse(row.metaJson);
      return {
        timestamp: row.timestamp,
        requestId: row.requestId,
        hgvs: row.hgvs,
        gene: row.gene,
        route: row.route,
        status: row.status as any,
        processingMs: row.processingMs,
        residue: meta.residue,
        ip: meta.ip,
        evidenceSources: meta.evidenceSources,
        errorCode: meta.errorCode,
      };
    });
  } catch (error) {
    console.error('[AuditDB] Failed to fetch entries:', error);
    return [];
  }
}

/**
 * Get usage summary statistics.
 */
export function getAuditSummary(): {
  totalQueries: number;
  successRate: number;
  topGenes: Array<{ gene: string; count: number }>;
  avgProcessingMs: number;
} {
  try {
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM audit_log');
    const total = (totalStmt.get() as any).count;

    const successStmt = db.prepare("SELECT COUNT(*) as count FROM audit_log WHERE status = 'success'");
    const successes = (successStmt.get() as any).count;

    const genesStmt = db.prepare(`
      SELECT gene, COUNT(*) as count 
      FROM audit_log 
      GROUP BY gene 
      ORDER BY count DESC 
      LIMIT 10
    `);
    const topGenes = genesStmt.all() as Array<{ gene: string; count: number }>;

    const avgStmt = db.prepare('SELECT AVG(processingMs) as avgMs FROM audit_log');
    const avgMs = (avgStmt.get() as any).avgMs || 0;

    return {
      totalQueries: total,
      successRate: total > 0 ? Math.round((successes / total) * 100) : 0,
      topGenes,
      avgProcessingMs: Math.round(avgMs),
    };
  } catch (error) {
    console.error('[AuditDB] Failed to get summary:', error);
    return {
      totalQueries: 0,
      successRate: 0,
      topGenes: [],
      avgProcessingMs: 0,
    };
  }
}

/**
 * Export audit log as CSV string (for download/archival).
 */
export function exportAuditCSV(): string {
  const header = 'timestamp,requestId,hgvs,gene,residue,ip,status,processingMs,clinvar,structure,literature,errorCode';
  const entries = getRecentAuditEntries(10000); // Limit CSV export size for now
  
  const rows = entries.map(e => 
    [
      e.timestamp,
      e.requestId,
      `"${e.hgvs}"`,
      e.gene,
      e.residue,
      e.ip,
      e.status,
      e.processingMs,
      e.evidenceSources?.clinvar ?? false,
      e.evidenceSources?.structure ?? false,
      e.evidenceSources?.literature ?? false,
      e.errorCode || '',
    ].join(',')
  );
  return [header, ...rows].join('\n');
}
