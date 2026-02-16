// Amino acid 3-letter to 1-letter mapping
// Amino acid 3-letter to 1-letter mapping
export const AMINO_ACIDS: Record<string, string> = {
  Ala: 'A', Cys: 'C', Asp: 'D', Glu: 'E', Phe: 'F',
  Gly: 'G', His: 'H', Ile: 'I', Lys: 'K', Leu: 'L',
  Met: 'M', Asn: 'N', Pro: 'P', Gln: 'Q', Arg: 'R',
  Ser: 'S', Thr: 'T', Val: 'V', Trp: 'W', Tyr: 'Y',
  Ter: '*', Stop: '*',
};

const ONE_TO_THREE: Record<string, string> = Object.entries(AMINO_ACIDS).reduce((acc, [three, one]) => {
    acc[one] = three;
    return acc;
}, {} as Record<string, string>);

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

export function parseHGVS(hgvs: string): ParsedVariant {
  // Validate basic format
  if (!hgvs || typeof hgvs !== 'string') {
    throw new Error('Invalid HGVS format: empty input');
  }

  // Check if it's nucleotide HGVS (unsupported for now)
  if (hgvs.includes(':c.') && !hgvs.includes(':p.')) {
     throw new Error('Protein HGVS required. Nucleotide HGVS (c.) not supported.');
  }
  
  // 1. Clean the input
  let cleanInput = hgvs.trim();
  
// Helper to extract protein part from potentially transcript-prefixed string
// e.g. "NM_004333.6:p.Val600Glu" -> "Val600Glu"
// e.g. "p.V600E" -> "V600E" 
export function extractProteinPart(input: string): string | null {
  // Find the first protein-like token anywhere in the string
  // Handles: "...:p.Val600Glu", "p.V600E", "BRAF(p.Val600Glu)"
  // Matches: p. (optional) + 1/3 letters + digits + 1/3 letters or * or Ter
  const m = input.match(/(?:p\.)?([A-Za-z]{1,3})(\d+)([A-Za-z]{1,3}|\*|Ter)/);
  if (!m) return null;
  // Regex groups: 1=Ref, 2=Pos, 3=Alt
  return `${m[1]}${m[2]}${m[3]}`; 
}

export function parseHGVS(hgvs: string): ParsedVariant {
  // Validate basic format
  if (!hgvs || typeof hgvs !== 'string') {
    throw new Error('Invalid HGVS format: empty input');
  }

  // Check if it's nucleotide HGVS (unsupported for now)
  if (hgvs.includes(':c.') && !hgvs.includes(':p.')) {
     throw new Error('Protein HGVS required. Nucleotide HGVS (c.) not supported.');
  }
  
  // 1. Clean the input
  let cleanInput = hgvs.trim();
  
  // 2. Extract Transcript if present (e.g. NM_004333.4)
  const transcriptMatch = cleanInput.match(/(NM_\d+(?:\.\d+)?)/);
  const transcript = transcriptMatch ? transcriptMatch[1] : undefined;
  
  // 3. Isolate Protein Change part
  // Use robust extractor instead of slicing, which is fragile to suffix noise
  const cleanChange = extractProteinPart(cleanInput);
  
  if (!cleanChange) {
      // Fallback: try split logic if strictly formatted, but likely invalid
      throw new Error('Invalid HGVS format. Expected protein change (e.g. p.Val600Glu or V600E)');
  }

  // 4. Parse Amino Acid Change
  // Valid formats: Val600Glu, V600E, V600*, Val600Ter, Val600del
  // Regex:
  // Group 1 (Ref): [A-Za-z]+ (greedy or non-greedy? Greedy stops at digit)
  // Group 2 (Pos): \d+
  // Group 3 (Alt): [A-Za-z]+ OR * OR Ter OR del/ins/dup/fs
  
  const match = cleanChange.match(/^([A-Za-z]+)(\d+)([A-Za-z*]+|Ter|del|ins|dup|fs)$/);
  
  if (!match) {
      throw new Error('Invalid HGVS format. Expected protein change (e.g. p.Val600Glu or V600E)');
  }
  
  const [, refRaw, posStr, altRaw] = match;
  
  // Handle Gene Name extraction (Best Effort)
  // If input was "BRAF:p.V600E", we want "BRAF". 
  // If "NM_004333:V600E", we might default to transcript or UNKNOWN.
  let gene = 'UNKNOWN';
  
  // naive gene extraction: grab first word token that isn't the transcript or p. part
  // but let's stick to the previous robust regex for gene if possible, or just look at the prefix
  const prefix = cleanInput.split(':')[0]; // crude but often works for simple formats
  if (prefix && !prefix.startsWith('NM_') && !prefix.startsWith('p.')) {
      gene = prefix;
  }
  // Better: reuse the previous regex tactic for Gene if the prefix isn't a transcript
  const geneMatch = cleanInput.match(/^([A-Z0-9]+)[: ]/);
  if (geneMatch && !geneMatch[1].startsWith('NM_')) {
      gene = geneMatch[1];
  }

  const pos = parseInt(posStr, 10);
  
  // Handle special cases
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


  // Determine variant type
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
