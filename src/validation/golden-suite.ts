import * as fs from 'fs';
import { GOLDEN_CASES } from './golden-cases';

interface GoldenResult {
  id: number;
  hgvs: string;
  ok: boolean;
  status: number;
  checks: string[];
  error?: string;
  durationMs: number;
  payload?: unknown;
}

function assert(condition: boolean, message: string, checks: string[]) {
  if (condition) {
    checks.push(`PASS: ${message}`);
  } else {
    checks.push(`FAIL: ${message}`);
  }
  return condition;
}

async function runGoldenSuite(baseUrl = 'http://localhost:3000'): Promise<void> {
  const results: GoldenResult[] = [];

  for (const testCase of GOLDEN_CASES) {
    const started = Date.now();
    const checks: string[] = [];

    try {
      const response = await fetch(`${baseUrl}/api/variant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hgvs: testCase.hgvs }),
      });

      const text = await response.text();
      const payload = text ? JSON.parse(text) : null;
      let ok = true;

      if (testCase.expected.apiShouldReject) {
        ok =
          assert(!response.ok, 'API should reject this input', checks) &&
          ok;
        if (testCase.expected.apiErrorCode) {
          ok =
            assert(
              payload?.code === testCase.expected.apiErrorCode || String(payload?.message || '').includes(testCase.expected.apiErrorCode),
              `Error code should be ${testCase.expected.apiErrorCode}`,
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
                String(payload.coverage?.domain?.domainName || '').toLowerCase().includes(testCase.expected.domainNameIncludes.toLowerCase()),
                `Domain name should include ${testCase.expected.domainNameIncludes}`,
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
  const report = [
    '# Golden Suite Report',
    '',
    `Date: ${new Date().toISOString()}`,
    `Base URL: ${baseUrl}`,
    `Total: ${results.length}`,
    `Passed: ${passCount}`,
    `Failed: ${failCount}`,
    '',
    '## Results',
    '',
    '| # | Variant | Status | API | Duration (ms) |',
    '|---|---------|--------|-----|---------------|',
    ...results.map((r) => `| ${r.id} | \`${r.hgvs}\` | ${r.ok ? 'PASS' : 'FAIL'} | ${r.status} | ${r.durationMs} |`),
    '',
    '## Check Details',
    '',
    ...results.map((r) => {
      const lines = [
        `### ${r.id}. ${r.hgvs}`,
        `- Result: ${r.ok ? 'PASS' : 'FAIL'}`,
        `- API status: ${r.status}`,
        ...(r.error ? [`- Error: ${r.error}`] : []),
        ...r.checks.map((c) => `- ${c}`),
        ...(r.payload !== undefined
          ? ['- Raw response:', '```json', JSON.stringify(r.payload, null, 2), '```']
          : []),
        '',
      ];
      return lines.join('\n');
    }),
  ].join('\n');

  fs.writeFileSync('golden_suite_report.md', report, 'utf8');
  console.log(`Golden suite complete. Passed ${passCount}/${results.length}.`);
  console.log('Report: golden_suite_report.md');
}

const baseUrlFromCli = process.argv[2] || process.env.GOLDEN_BASE_URL || 'http://localhost:3000';

runGoldenSuite(baseUrlFromCli).catch((error) => {
  console.error('Golden suite failed:', error);
  process.exitCode = 1;
});
