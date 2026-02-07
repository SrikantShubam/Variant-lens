export interface ViewerSiftsData {
  mapped: boolean;
  chain: string;
  pdbResidue: string;
  source: string;
}

export function getViewerConfig(sifts: ViewerSiftsData | undefined, uniprotResidue: number) {
  if (sifts?.mapped) {
    const resNum = parseInt(sifts.pdbResidue, 10);
    const valid = !isNaN(resNum);
    return {
      status: 'mapped',
      banner: {
        type: 'success',
        icon: '✓ MAPPED',
        text: `UniProt ${uniprotResidue} → PDB ${sifts.chain}:${sifts.pdbResidue} (via SIFTS)`
      },
      highlight: valid ? {
        struct_asym_id: sifts.chain,
        start_residue_number: resNum,
        end_residue_number: resNum,
        color: { r: 255, g: 0, b: 255 },
        focus: true
      } : null
    };
  } else {
    return {
      status: 'unmapped',
      banner: {
        type: 'warning',
        icon: '⚠ UNMAPPED',
        text: `SIFTS does not map UniProt ${uniprotResidue} to this PDB entry.`
      },
      highlight: null
    };
  }
}
