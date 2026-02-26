import * as fs from 'fs';
import { GOLDEN_CASES } from './golden-cases';

interface CompactSnapshot {
  normalizedHgvs?: string;
  gene?: string;
  transcript?: string;
  variantType?: string;
  significance?: string;
  clinicalStatus?: string;
  clinicalSignificance?: string;
  clinvarStars?: number;
  clinvarId?: string;
  domainAnnotated?: boolean;
  domainName?: string;
  structureStatus?: string;
  structureId?: string;
  literatureCount?: number;
  unknownCount?: number;
}

interface GoldenResult {
  id: number;
  hgvs: string;
  ok: boolean;
  status: number;
  checks: string[];
  error?: string;
  durationMs: number;
  snapshot?: CompactSnapshot;
  payload?: unknown;
}

function assert(condition: boolean, message: string, checks: string[]) {
  checks.push(`${condition ? 'PASS' : 'FAIL'}: ${message}`);
  return condition;
}

function parsePayload(text: string): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

function summarizePayload(payload: any): CompactSnapshot | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  return {
    normalizedHgvs: payload?.variant?.normalizedHgvs,
    gene: payload?.variant?.gene,
    transcript: payload?.variant?.transcript,
    variantType: payload?.variant?.variantType,
    significance: payload?.variant?.significance,
    clinicalStatus: payload?.coverage?.clinical?.status,
    clinicalSignificance: payload?.coverage?.clinical?.significance,
    clinvarStars: payload?.coverage?.clinical?.stars,
    clinvarId: payload?.coverage?.clinical?.clinvarId,
    domainAnnotated: payload?.coverage?.domain?.inAnnotatedDomain,
    domainName: payload?.coverage?.domain?.domainName,
    structureStatus: payload?.coverage?.structure?.status,
    structureId: payload?.coverage?.structure?.id,
    literatureCount: payload?.coverage?.literature?.variantSpecificCount,
    unknownCount: Array.isArray(payload?.unknowns?.items) ? payload.unknowns.items.length : undefined,
  };
}

function failedChecks(checks: string[]): string[] {
  return checks.filter((c) => c.startsWith('FAIL:'));
}

function parseCaseIdFilter(input: string | undefined): Set<number> | null {
  if (!input) return null;
  const ids = input
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return ids.length > 0 ? new Set(ids) : null;
}

async function runGoldenSuite(baseUrl = 'http://localhost:3000', caseIdFilter: Set<number> | null = null): Promise<void> {
  const results: GoldenResult[] = [];
  const casesToRun = caseIdFilter
    ? GOLDEN_CASES.filter((testCase) => caseIdFilter.has(testCase.id))
    : GOLDEN_CASES;

  for (const testCase of casesToRun) {
    const started = Date.now();
    const checks: string[] = [];

    try {
      const response = await fetch(`${baseUrl}/api/variant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hgvs: testCase.hgvs }),
      });

      const text = await response.text();
      const payload = parsePayload(text);
      let ok = true;

      if (typeof testCase.expected.expectedStatus === 'number') {
        ok =
          assert(
            response.status === testCase.expected.expectedStatus,
            `API status should be ${testCase.expected.expectedStatus}`,
            checks
          ) && ok;
      }

      if (testCase.expected.apiShouldReject) {
        ok = assert(!response.ok, 'API should reject this input', checks) && ok;
        if (testCase.expected.apiErrorCode) {
          ok =
            assert(
              payload?.code === testCase.expected.apiErrorCode ||
                String(payload?.message || '').includes(testCase.expected.apiErrorCode),
              `Error code should be ${testCase.expected.apiErrorCode}`,
              checks
            ) && ok;
        }
        if (testCase.expected.errorContains) {
          const errorText = `${payload?.error || ''} ${payload?.message || ''}`.toLowerCase();
          ok =
            assert(
              errorText.includes(testCase.expected.errorContains.toLowerCase()),
              `Error should mention "${testCase.expected.errorContains}"`,
              checks
            ) && ok;
        }
      } else {
        ok = assert(response.ok, 'API should return 200', checks) && ok;

        if (response.ok && payload) {
          if (testCase.expected.normalized) {
            ok =
              assert(
                payload.variant?.normalizedHgvs === testCase.expected.normalized,
                `Normalized HGVS should be ${testCase.expected.normalized}`,
                checks
              ) && ok;
          }

          if (testCase.expected.transcript) {
            ok =
              assert(
                payload.variant?.transcript === testCase.expected.transcript,
                `Transcript should be ${testCase.expected.transcript}`,
                checks
              ) && ok;
          }

          if (testCase.expected.expectedGene) {
            ok =
              assert(
                payload.variant?.gene === testCase.expected.expectedGene,
                `Gene should be ${testCase.expected.expectedGene}`,
                checks
              ) && ok;
          }

          if (testCase.expected.expectedUniprotId) {
            ok =
              assert(
                payload.curatedInfo?.uniprotId === testCase.expected.expectedUniprotId,
                `UniProt should be ${testCase.expected.expectedUniprotId}`,
                checks
              ) && ok;
          }

          if (testCase.expected.mustNotGene) {
            ok =
              assert(
                payload.variant?.gene !== testCase.expected.mustNotGene,
                `Gene should not be ${testCase.expected.mustNotGene}`,
                checks
              ) && ok;
          }

          if (typeof testCase.expected.domainShouldBeAnnotated === 'boolean') {
            ok =
              assert(
                payload.coverage?.domain?.inAnnotatedDomain === testCase.expected.domainShouldBeAnnotated,
                `Domain annotation flag should be ${testCase.expected.domainShouldBeAnnotated}`,
                checks
              ) && ok;
          }

          if (testCase.expected.domainNameIncludes) {
            ok =
              assert(
                String(payload.coverage?.domain?.domainName || '')
                  .toLowerCase()
                  .includes(testCase.expected.domainNameIncludes.toLowerCase()),
                `Domain name should include ${testCase.expected.domainNameIncludes}`,
                checks
              ) && ok;
          }

          if (testCase.expected.variantType) {
            ok =
              assert(
                payload.variant?.variantType === testCase.expected.variantType,
                `variantType should be ${testCase.expected.variantType}`,
                checks
              ) && ok;
          }

          if (typeof testCase.expected.residue === 'number') {
            ok =
              assert(
                payload.variant?.residue === testCase.expected.residue,
                `residue should be ${testCase.expected.residue}`,
                checks
              ) && ok;
          }

          if (typeof testCase.expected.isValidPosition === 'boolean') {
            ok =
              assert(
                payload.variant?.isValidPosition === testCase.expected.isValidPosition,
                `isValidPosition should be ${testCase.expected.isValidPosition}`,
                checks
              ) && ok;
          }

          if (testCase.expected.clinicalShouldBePathogenicOrLikely) {
            const sig = String(payload.coverage?.clinical?.significance || '').toLowerCase();
            const status = String(payload.coverage?.clinical?.status || '').toLowerCase();
            ok =
              assert(
                sig.includes('pathogenic') || status === 'pathogenic' || status === 'likely_pathogenic',
                'ClinVar significance should be pathogenic or likely pathogenic',
                checks
              ) && ok;
          }

          if (testCase.expected.unknownSeverityDefined) {
            ok =
              assert(
                typeof payload.unknowns?.severity === 'string' && payload.unknowns.severity.length > 0,
                'unknowns severity should be defined',
                checks
              ) && ok;
          }

          if (String(payload.variant?.variantType || '') === 'stop-gain') {
            ok =
              assert(
                payload.variant?.significance === 'Pathogenic (nonsense)',
                'Stop-gain variants should return deterministic significance',
                checks
              ) && ok;
          }

          const significance = String(payload.coverage?.clinical?.significance || '').toLowerCase();
          if (significance.includes('conflicting')) {
            ok =
              assert(
                payload.coverage?.clinical?.status !== 'pathogenic',
                'Conflicting ClinVar significance must not map to pathogenic status',
                checks
              ) && ok;
          }

          if (testCase.expected.repeatCallShouldMatch) {
            const repeatStarted = Date.now();
            const repeatResponse = await fetch(`${baseUrl}/api/variant`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ hgvs: testCase.hgvs }),
            });
            const repeatText = await repeatResponse.text();
            const repeatPayload = parsePayload(repeatText);
            const repeatDuration = Date.now() - repeatStarted;

            ok =
              assert(
                repeatResponse.status === response.status,
                'Second identical call should return same status',
                checks
              ) && ok;
            ok =
              assert(
                repeatPayload?.variant?.normalizedHgvs === payload?.variant?.normalizedHgvs,
                'Second identical call should return same result',
                checks
              ) && ok;

            if (typeof testCase.expected.repeatCallMaxMs === 'number') {
              const measuredMs = Number(repeatPayload?.processingMs || repeatDuration);
              ok =
                assert(
                  Number.isFinite(measuredMs) && measuredMs <= testCase.expected.repeatCallMaxMs,
                  `processingMs for cached response should be <= ${testCase.expected.repeatCallMaxMs}ms`,
                  checks
                ) && ok;
            }
          }
        }
      }

      results.push({
        id: testCase.id,
        hgvs: testCase.hgvs,
        ok,
        status: response.status,
        checks,
        durationMs: Date.now() - started,
        payload,
        snapshot: summarizePayload(payload),
      });
    } catch (error) {
      results.push({
        id: testCase.id,
        hgvs: testCase.hgvs,
        ok: false,
        status: 0,
        checks,
        error: (error as Error).message,
        durationMs: Date.now() - started,
      });
    }
  }

  const passCount = results.filter((r) => r.ok).length;
  const failCount = results.length - passCount;
  const failures = results.filter((r) => !r.ok);
  const avgMs =
    results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.durationMs, 0) / results.length)
      : 0;

  const report = [
    '# Golden Report (Compact)',
    '',
    `Date: ${new Date().toISOString()}`,
    `Base URL: ${baseUrl}`,
    `Total: ${results.length}`,
    `Passed: ${passCount}`,
    `Failed: ${failCount}`,
    `Avg Duration (ms): ${avgMs}`,
    ...(caseIdFilter ? [`Case Filter: ${[...caseIdFilter].sort((a, b) => a - b).join(', ')}`] : []),
    '',
    '## Results',
    '',
    '| # | Variant | Status | API | ms |',
    '|---|---|---|---|---|',
    ...results.map((r) => `| ${r.id} | \`${r.hgvs}\` | ${r.ok ? 'PASS' : 'FAIL'} | ${r.status} | ${r.durationMs} |`),
    '',
    '## Failures',
    '',
    ...(failures.length === 0
      ? ['None']
      : failures.map((r) => {
          const failLines = failedChecks(r.checks);
          const snapshot = r.snapshot
            ? `- Snapshot: ${JSON.stringify(r.snapshot)}`
            : '- Snapshot: unavailable';
          return [
            `### ${r.id}. ${r.hgvs}`,
            `- API status: ${r.status}`,
            ...(r.error ? [`- Error: ${r.error}`] : []),
            ...failLines.map((f) => `- ${f}`),
            snapshot,
            '',
          ].join('\n');
        })),
    '',
    '## Token Notes',
    '',
    '- This markdown is compact by default (no full per-case raw JSON).',
    '- Full raw responses are written to `golden_report_payloads.json`.',
  ].join('\n');

  const payloadDump = results.map((r) => ({
    id: r.id,
    hgvs: r.hgvs,
    status: r.status,
    ok: r.ok,
    checks: r.checks,
    error: r.error,
    durationMs: r.durationMs,
    payload: r.payload,
  }));

  fs.writeFileSync('golden_report.md', report, 'utf8');
  fs.writeFileSync('golden_suite_report.md', report, 'utf8'); // Backward-compatible filename.
  fs.writeFileSync('golden_report_payloads.json', JSON.stringify(payloadDump, null, 2), 'utf8');
  console.log(`Golden suite complete. Passed ${passCount}/${results.length}.`);
  console.log('Compact report: golden_report.md');
  console.log('Payload dump: golden_report_payloads.json');
}

const baseUrlFromCli = process.argv[2] || process.env.GOLDEN_BASE_URL || 'http://localhost:3000';
const caseFilterInput = process.argv[3] || process.env.GOLDEN_CASE_IDS;
const caseFilter = parseCaseIdFilter(caseFilterInput);

runGoldenSuite(baseUrlFromCli, caseFilter).catch((error) => {
  console.error('Golden suite failed:', error);
  process.exitCode = 1;
});
