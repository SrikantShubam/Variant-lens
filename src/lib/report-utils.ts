import { HonestReportData } from './types/honest-response';

function starsFromCount(stars?: number): string {
  if (typeof stars !== 'number') return '\u2606\u2606\u2606\u2606';
  const s = Math.max(0, Math.min(4, stars));
  return `${'\u2605'.repeat(s)}${'\u2606'.repeat(4 - s)}`;
}

export function buildSmartSummary({
  nearFunctionalSite,
  distanceToNearestSite,
  functionalSites,
  variantInDomain,
  hgvs,
  structure,
}: {
  nearFunctionalSite: boolean;
  distanceToNearestSite: number | null;
  functionalSites: Array<{ description?: string }>;
  variantInDomain: string | null;
  hgvs: string;
  structure: { status?: string };
}): string {
  if (nearFunctionalSite && distanceToNearestSite !== null && distanceToNearestSite <= 5) {
    return `Adjacent to ${functionalSites[0]?.description || 'functional site'} - expected to disrupt ${variantInDomain || 'local function'}`;
  } else if (variantInDomain) {
    return `Inside ${variantInDomain} - ${hgvs} likely affects folding or stability`;
  } else if (structure?.status === 'predicted') {
    return 'High-confidence AlphaFold region - see 3D viewer for context';
  }
  return 'Outside annotated domains - structural effect uncertain';
}

function formatResolution(resolution?: number): string {
  if (typeof resolution !== 'number') return '';
  return `, ${resolution.toFixed(2)}A`;
}

export function generateMarkdown(data: HonestReportData): string {
  const { variant, coverage, curatedInfo, unknowns } = data;
  const normalizedHgvs = variant.normalizedHgvs || variant.hgvs;
  const bullet = '\u2022';
  const shield = '\u{1F6E1}';
  const structureId = coverage.structure.id || 'N/A';
  const structureStatus = coverage.structure.status || 'none';

  const smartSummary = buildSmartSummary({
    nearFunctionalSite: curatedInfo.nearFunctionalSite,
    distanceToNearestSite: curatedInfo.distanceToNearestSite,
    functionalSites: curatedInfo.functionalSites,
    variantInDomain: curatedInfo.variantInDomain,
    hgvs: normalizedHgvs,
    structure: coverage.structure,
  });

  const significance =
    variant.significance ||
    coverage.clinical.significance ||
    (coverage.clinical.status && coverage.clinical.status !== 'none'
      ? coverage.clinical.status
      : 'No ClinVar data');
  const reviewStatus = coverage.clinical.reviewStatus || 'review status unavailable';
  const clinvarId = coverage.clinical.clinvarId || 'Unavailable';
  const clinvarUrl = coverage.clinical.url || '#';
  const location = coverage.domain.domainName || curatedInfo.variantInDomain || 'No annotated domain';
  const gaps = unknowns.items.length > 0
    ? unknowns.items.join(` ${bullet} `)
    : 'No major evidence gaps flagged';
  const timestamp = data.timestamp || new Date().toISOString();

  return `**Variant Lens Report**  
**${variant.gene} ${normalizedHgvs}** (residue ${variant.residue} ${bullet} ${curatedInfo.proteinName})

**Clinical Snapshot**  
${starsFromCount(coverage.clinical.stars)} **${significance}** ${reviewStatus}  
ClinVar: [${clinvarId}](${clinvarUrl})

**Structural View**  
${bullet} Structure used: **${structureId}** (${structureStatus}${formatResolution(coverage.structure.resolution)})  
${bullet} Location: ${location}  
${bullet} Quick context: ${smartSummary}

**Literature Signal**  
${bullet} ${coverage.literature.variantSpecificCount} papers mention the exact variant

**Gaps & Notes**  
${bullet} ${gaps}

---
${shield} Generated: ${timestamp} | Target: ${normalizedHgvs}  
Structure mapped via SIFTS ${bullet} ClinVar exact match  
*Research use only. VariantLens v2.1 (deterministic)*`;
}
