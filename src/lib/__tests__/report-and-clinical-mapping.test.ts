import { describe, expect, it } from '@jest/globals';
import { buildEvidenceCoverage } from '../uniprot-curator';
import { buildSmartSummary, generateMarkdown } from '../report-utils';
import { HonestReportData } from '../types/honest-response';

const BASE_CURATED = {
  gene: 'NDUFAF6',
  uniprotId: 'Q330K2',
  proteinName: 'Complex I assembly factor',
  proteinLength: 333,
  domains: [],
  functionalSites: [],
  variantPosition: 178,
  variantInDomain: null,
  nearFunctionalSite: false,
  distanceToNearestSite: null,
};

describe('Clinical mapping and markdown safety', () => {
  it('maps conflicting ClinVar significance to uncertain', async () => {
    const coverage = await buildEvidenceCoverage(
      BASE_CURATED,
      null,
      {
        significance: 'Conflicting classifications of pathogenicity',
        reviewStatus: 'criteria provided, conflicting classifications',
        stars: 1,
        clinvarId: '123456',
        url: 'https://example.org',
        conditions: [],
      },
      {
        count: 1,
        query: 'NDUFAF6 A178P',
        papers: [],
      }
    );

    expect(coverage.clinical.status).toBe('uncertain');
  });

  it('keeps raw ClinVar significance wording in markdown output', async () => {
    const coverage = await buildEvidenceCoverage(
      BASE_CURATED,
      null,
      {
        significance: 'Conflicting classifications of pathogenicity',
        reviewStatus: 'criteria provided, conflicting classifications',
        stars: 1,
        clinvarId: '123456',
        url: 'https://example.org',
        conditions: [],
      },
      {
        count: 1,
        query: 'NDUFAF6 A178P',
        papers: [],
      }
    );

    const data: HonestReportData = {
      variant: {
        hgvs: 'NDUFAF6:p.A178P',
        gene: 'NDUFAF6',
        residue: 178,
      },
      coverage,
      unknowns: { items: [], severity: 'minor' },
      curatedInfo: BASE_CURATED,
      timestamp: '2026-02-26T00:00:00.000Z',
    };

    const md = generateMarkdown(data);
    expect(md).toContain('**Variant Lens Report**');
    expect(md).toContain('**Clinical Snapshot**');
    expect(md).toContain('**Structural View**');
    expect(md).toContain('\u2022 Quick context:');
    expect(md).toContain('Conflicting classifications of pathogenicity');
    expect(md).not.toContain('PATHOGENIC (');
  });

  it('builds smart summary from nearby functional site context', () => {
    const summary = buildSmartSummary({
      nearFunctionalSite: true,
      distanceToNearestSite: 1,
      functionalSites: [{ description: 'zinc-binding Cys176' }],
      variantInDomain: 'DNA-binding domain',
      hgvs: 'TP53:p.R175H',
      structure: { status: 'experimental' },
    });
    expect(summary).toContain('Adjacent to zinc-binding Cys176');
  });
});
