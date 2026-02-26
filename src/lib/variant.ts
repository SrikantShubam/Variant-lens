// Amino acid 3-letter to 1-letter mapping
export const AMINO_ACIDS: Record<string, string> = {
  Ala: 'A',
  Cys: 'C',
  Asp: 'D',
  Glu: 'E',
  Phe: 'F',
  Gly: 'G',
  His: 'H',
  Ile: 'I',
  Lys: 'K',
  Leu: 'L',
  Met: 'M',
  Asn: 'N',
  Pro: 'P',
  Gln: 'Q',
  Arg: 'R',
  Ser: 'S',
  Thr: 'T',
  Val: 'V',
  Trp: 'W',
  Tyr: 'Y',
  Ter: '*',
  Stop: '*',
};

const ONE_TO_THREE: Record<string, string> = Object.entries(AMINO_ACIDS).reduce(
  (acc, [three, one]) => {
    acc[one] = three;
    return acc;
  },
  {} as Record<string, string>
);

export function toThreeLetter(oneLetter: string): string {
  const upper = oneLetter.toUpperCase();
  if (upper === '*' || upper === 'X') return 'Ter';
  return ONE_TO_THREE[upper] || oneLetter;
}

const VALID_AA = new Set(Object.values(AMINO_ACIDS));
const GENE_ALIASES: Record<string, string> = {
  ABCC7: 'CFTR',
};

export interface ParsedVariant {
  gene: string;
  ref: string;
  pos: number;
  alt: string;
  transcript?: string;
  type: 'missense' | 'nonsense' | 'silent' | 'deletion' | 'insertion' | 'duplication' | 'frameshift' | 'unknown';
}

// Helper to extract protein part from potentially transcript-prefixed string
// e.g. "NM_004333.6:p.Val600Glu" -> "Val600Glu"
// e.g. "p.V600E" -> "V600E"
export function extractProteinPart(input: string): string | null {
  const aaPattern = '([A-Za-z]{1,3})(\\d+)([A-Za-z]{1,3}fs\\*?\\d*|[A-Za-z]{1,3}|\\*|Ter|del|ins|dup|fs)';
  const tokenTail = '(?=$|[^A-Za-z0-9])';

  // Case 1: starts directly with p.XnnnY
  const startWithProteinMarker = input.match(new RegExp(`^p\\.${aaPattern}${tokenTail}`, 'i'));
  if (startWithProteinMarker) {
    return `${startWithProteinMarker[1]}${startWithProteinMarker[2]}${startWithProteinMarker[3]}`;
  }

  // Case 2: appears after ":" or "(" with optional p. marker
  const withDelimiter = input.match(new RegExp(`[:(](?:p\\.)?${aaPattern}${tokenTail}`, 'i'));
  if (withDelimiter) {
    return `${withDelimiter[1]}${withDelimiter[2]}${withDelimiter[3]}`;
  }

  // Fallback: plain token only when the entire input is just the variant (e.g., "V600E").
  const bareToken = input.match(/^([A-Za-z]{1,3})(\d+)([A-Za-z]{1,3}|\*|Ter|del|ins|dup|fs)$/i);
  if (bareToken) {
    return `${bareToken[1]}${bareToken[2]}${bareToken[3]}`;
  }

  return null;
}

export function parseHGVS(hgvs: string): ParsedVariant {
  if (!hgvs || typeof hgvs !== 'string') {
    throw new Error('Invalid HGVS format: empty input');
  }

  const cleanInput = hgvs.trim().replace(/\s+/g, '');

  if (/p\.=/i.test(cleanInput)) {
    throw new Error('Invalid HGVS format. p.= (no protein change) is not supported.');
  }

  // Guard only against truly multiple protein-variant blocks (e.g. "p.R175H p.R248Q").
  // We intentionally count explicit "p." blocks only, so valid symbols like TP53 are never miscounted.
  const explicitProteinBlocks =
    cleanInput.match(/p\.[A-Za-z]{1,3}\d+(?:[A-Za-z]{1,3}fs\*?\d*|[A-Za-z]{1,3}|\*|Ter|X|del|ins|dup|fs)/gi) || [];
  if (explicitProteinBlocks.length > 1) {
    throw new Error('Invalid HGVS format. Only one protein variant per request is supported.');
  }

  if (/^rs\d+$/i.test(cleanInput)) {
    throw new Error('dbSNP rsIDs are not supported directly. Please provide protein HGVS (e.g. BRAF:p.V600E).');
  }

  if (/:([cgmnr])\./i.test(cleanInput) && !/:p\./i.test(cleanInput)) {
    throw new Error('Protein HGVS required. Nucleotide/RNA HGVS (c., g., m., n., r.) not supported.');
  }

  if (!cleanInput.includes(':') && /^[A-Za-z0-9-]+p\./i.test(cleanInput)) {
    throw new Error(
      'Invalid HGVS format. Missing ":" between gene and protein change (e.g. NDUFAF6:p.Ala178Pro).'
    );
  }

  const transcriptMatch = cleanInput.match(/(NM_\d+(?:\.\d+)?)/i);
  const transcript = transcriptMatch ? transcriptMatch[1].toUpperCase() : undefined;
  const cleanChange = extractProteinPart(cleanInput);

  if (!cleanChange) {
    throw new Error('Invalid HGVS format. Expected protein change (e.g. p.Val600Glu or V600E)');
  }

  const match = cleanChange.match(/^([A-Za-z]+)(\d+)([A-Za-z*]+(?:\*?\d+)?|Ter|X|del|ins|dup|fs)$/i);
  if (!match) {
    throw new Error('Invalid HGVS format. Expected protein change (e.g. p.Val600Glu or V600E)');
  }

  const [, refRaw, posStr, altRaw] = match;
  let gene = 'UNKNOWN';

  // Support transcript-prefixed HGVS: NM_xxx(GENE):p.XnnnY
  const transcriptGeneMatch = cleanInput.match(/^NM_\d+(?:\.\d+)?\(([A-Z0-9-]+)\):/i);
  if (transcriptGeneMatch) {
    gene = transcriptGeneMatch[1].toUpperCase();
  } else {
    const geneMatch = cleanInput.match(/^([A-Z0-9-]+):/i);
    if (geneMatch && !geneMatch[1].toUpperCase().startsWith('NM_')) {
      gene = geneMatch[1].toUpperCase();
    }
  }
  gene = normalizeGeneSymbol(gene);

  const pos = parseInt(posStr, 10);
  const normalizedAltRaw = altRaw.toLowerCase();
  if (normalizedAltRaw.includes('fs')) {
    return {
      gene,
      ref: convertAA(refRaw),
      pos,
      alt: 'fs',
      transcript,
      type: 'frameshift',
    };
  }

  if (['del', 'ins', 'dup', 'fs'].includes(normalizedAltRaw)) {
    const typeByToken: Record<string, ParsedVariant['type']> = {
      del: 'deletion',
      ins: 'insertion',
      dup: 'duplication',
      fs: 'frameshift',
    };
    return {
      gene,
      ref: convertAA(refRaw),
      pos,
      alt: normalizedAltRaw,
      transcript,
      type: typeByToken[normalizedAltRaw] || 'unknown',
    };
  }

  const ref = convertAA(refRaw);
  const alt = convertAA(altRaw, { allowStopAliases: true });

  let type: ParsedVariant['type'] = 'missense';
  if (alt === '*') type = 'nonsense';
  if (ref === alt) type = 'silent';

  return {
    gene,
    ref,
    pos,
    alt,
    transcript,
    type,
  };
}

export function normalizeVariant(hgvs: string): { normalized: string; parsed: ParsedVariant } {
  const parsed = parseHGVS(hgvs);

  if (!VALID_AA.has(parsed.ref)) {
    throw new Error(`Invalid amino acid: ${parsed.ref}`);
  }
  if (!VALID_AA.has(parsed.alt) && !['del', 'ins', 'dup', 'fs'].includes(parsed.alt)) {
    throw new Error(`Invalid amino acid: ${parsed.alt}`);
  }

  const normalizedAlt = parsed.alt === '*' ? 'Ter' : parsed.alt;
  const normalized = `${parsed.gene}:p.${parsed.ref}${parsed.pos}${normalizedAlt}`;
  return { normalized, parsed };
}

export function validateHGVS(hgvs: string): boolean {
  try {
    parseHGVS(hgvs);
    return true;
  } catch {
    return false;
  }
}

function convertAA(
  aa: string,
  options: { allowStopAliases?: boolean } = {}
): string {
  if (aa.length === 1) {
    const upper = aa.toUpperCase();
    if (upper === '*') return '*';
    if (upper === 'X' && options.allowStopAliases) return '*';
    return upper;
  }

  const upper = aa.charAt(0).toUpperCase() + aa.slice(1).toLowerCase();
  const oneLetter = AMINO_ACIDS[upper];

  if (!oneLetter) {
    throw new Error(`Invalid amino acid code: ${aa}`);
  }

  return oneLetter;
}

function normalizeGeneSymbol(gene: string): string {
  const upper = gene.toUpperCase();
  return GENE_ALIASES[upper] || upper;
}
