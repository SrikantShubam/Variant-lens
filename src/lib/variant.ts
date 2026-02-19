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
  return ONE_TO_THREE[oneLetter] || oneLetter;
}

const VALID_AA = new Set(Object.values(AMINO_ACIDS));

export interface ParsedVariant {
  gene: string;
  ref: string;
  pos: number;
  alt: string;
  transcript?: string;
  type: 'missense' | 'nonsense' | 'silent' | 'deletion' | 'insertion' | 'unknown';
}

// Helper to extract protein part from potentially transcript-prefixed string
// e.g. "NM_004333.6:p.Val600Glu" -> "Val600Glu"
// e.g. "p.V600E" -> "V600E"
export function extractProteinPart(input: string): string | null {
  const m = input.match(/(?:p\.)?([A-Za-z]{1,3})(\d+)([A-Za-z]{1,3}|\*|Ter)/i);
  if (!m) return null;
  return `${m[1]}${m[2]}${m[3]}`;
}

export function parseHGVS(hgvs: string): ParsedVariant {
  if (!hgvs || typeof hgvs !== 'string') {
    throw new Error('Invalid HGVS format: empty input');
  }

  if (hgvs.includes(':c.') && !hgvs.includes(':p.')) {
    throw new Error('Protein HGVS required. Nucleotide HGVS (c.) not supported.');
  }

  const cleanInput = hgvs.trim();
  const transcriptMatch = cleanInput.match(/(NM_\d+(?:\.\d+)?)/i);
  const transcript = transcriptMatch ? transcriptMatch[1].toUpperCase() : undefined;
  const cleanChange = extractProteinPart(cleanInput);

  if (!cleanChange) {
    throw new Error('Invalid HGVS format. Expected protein change (e.g. p.Val600Glu or V600E)');
  }

  const match = cleanChange.match(/^([A-Za-z]+)(\d+)([A-Za-z*]+|Ter|del|ins|dup|fs)$/i);
  if (!match) {
    throw new Error('Invalid HGVS format. Expected protein change (e.g. p.Val600Glu or V600E)');
  }

  const [, refRaw, posStr, altRaw] = match;
  let gene = 'UNKNOWN';
  const geneMatch = cleanInput.match(/^([A-Z0-9]+):/i);
  if (geneMatch && !geneMatch[1].toUpperCase().startsWith('NM_')) {
    gene = geneMatch[1].toUpperCase();
  }

  const pos = parseInt(posStr, 10);
  if (['del', 'ins', 'dup', 'fs'].includes(altRaw)) {
    return {
      gene,
      ref: convertAA(refRaw),
      pos,
      alt: altRaw,
      transcript,
      type: altRaw === 'del' ? 'deletion' : altRaw === 'ins' ? 'insertion' : 'unknown',
    };
  }

  const ref = convertAA(refRaw);
  const alt = convertAA(altRaw);

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

  const normalized = `${parsed.gene}:p.${parsed.ref}${parsed.pos}${parsed.alt}`;
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

function convertAA(aa: string): string {
  if (aa.length === 1) return aa.toUpperCase();

  const upper = aa.charAt(0).toUpperCase() + aa.slice(1).toLowerCase();
  const oneLetter = AMINO_ACIDS[upper];

  if (!oneLetter) {
    throw new Error(`Invalid amino acid code: ${aa}`);
  }

  return oneLetter;
}
