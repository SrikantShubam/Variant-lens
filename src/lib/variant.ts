// Amino acid 3-letter to 1-letter mapping
const AMINO_ACIDS: Record<string, string> = {
  Ala: 'A', Cys: 'C', Asp: 'D', Glu: 'E', Phe: 'F',
  Gly: 'G', His: 'H', Ile: 'I', Lys: 'K', Leu: 'L',
  Met: 'M', Asn: 'N', Pro: 'P', Gln: 'Q', Arg: 'R',
  Ser: 'S', Thr: 'T', Val: 'V', Trp: 'W', Tyr: 'Y',
  Ter: '*', Stop: '*',
};

const VALID_AA = new Set(Object.values(AMINO_ACIDS));

export interface ParsedVariant {
  gene: string;
  ref: string;
  pos: number;
  alt: string;
  type: 'missense' | 'nonsense' | 'silent' | 'deletion' | 'insertion' | 'unknown';
}

export function parseHGVS(hgvs: string): ParsedVariant {
  // Validate basic format
  if (!hgvs || typeof hgvs !== 'string') {
    throw new Error('Invalid HGVS format: empty input');
  }

  // Check for protein HGVS (must contain :p.)
  const proteinMatch = hgvs.match(/^([A-Z0-9]+):p\.([A-Za-z]+)(\d+)([A-Za-z]+|(?:del|ins|dup|fs))$/);
  
  if (!proteinMatch) {
    // Check if it's nucleotide HGVS
    if (hgvs.includes(':c.')) {
      throw new Error('Protein HGVS required (e.g., BRCA1:p.Cys61Gly). Nucleotide HGVS not supported.');
    }
    throw new Error('Invalid HGVS format. Expected: GENE:p.RefPosAlt (e.g., BRCA1:p.Cys61Gly)');
  }

  const [, gene, ref3, posStr, alt3] = proteinMatch;
  const pos = parseInt(posStr, 10);

  // Handle special cases (del, ins, dup, fs)
  if (['del', 'ins', 'dup', 'fs'].includes(alt3)) {
    return {
      gene,
      ref: convertAA(ref3),
      pos,
      alt: alt3,
      type: alt3 === 'del' ? 'deletion' : alt3 === 'ins' ? 'insertion' : 'unknown',
    };
  }

  // Convert 3-letter to 1-letter codes
  const ref = convertAA(ref3);
  const alt = convertAA(alt3);

  // Determine variant type
  let type: ParsedVariant['type'] = 'missense';
  if (alt === '*') type = 'nonsense';
  if (ref === alt) type = 'silent';

  return {
    gene,
    ref,
    pos,
    alt,
    type,
  };
}

export function normalizeVariant(hgvs: string): { normalized: string; parsed: ParsedVariant } {
  const parsed = parseHGVS(hgvs);
  
  // Validate amino acids
  if (!VALID_AA.has(parsed.ref)) {
    throw new Error(`Invalid amino acid: ${parsed.ref}`);
  }
  if (!VALID_AA.has(parsed.alt) && !['del', 'ins', 'dup', 'fs'].includes(parsed.alt)) {
    throw new Error(`Invalid amino acid: ${parsed.alt}`);
  }

  // Normalize to 1-letter format
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
  // Already 1-letter
  if (aa.length === 1) return aa.toUpperCase();
  
  // 3-letter code
  const upper = aa.charAt(0).toUpperCase() + aa.slice(1).toLowerCase();
  const oneLetter = AMINO_ACIDS[upper];
  
  if (!oneLetter) {
    throw new Error(`Invalid amino acid code: ${aa}`);
  }
  
  return oneLetter;
}
