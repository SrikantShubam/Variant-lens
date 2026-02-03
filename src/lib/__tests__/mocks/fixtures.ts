// Single source of truth for all API mock responses
export const FIXTURES = {
  PDB: {
    SEARCH: {
      result_set: [
        { identifier: "1TUP", score: 1 }
      ]
    },
    ENTRY: {
      rcsb_entry_info: {
        resolution_combined: [2.2]
      },
      rcsb_accession_info: {
        deposit_date: "1999-01-01"
      }
    },
    ASSEMBLY: {
      rcsb_assembly_info: {
        mode: "homo"
      }
    }
  },
  ALPHAFOLD: [
    {
      entryId: "AF-P04637-F1",
      gene: "TP53",
      uniprotAccession: "P04637",
      pdbUrl: "https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v4.pdb",
      cifUrl: "https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v4.cif",
      latestVersion: 4
    }
  ],
  UNIPROT: {
    primaryAccession: "P04637",
    uniProtId: "P53_HUMAN",
    genes: [{ geneName: { value: "TP53" } }],
    sequence: { sequence: "MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGP..." },
    comments: [
      { commentType: "FUNCTION", text: [{ value: "Tumor suppressor protein." }] }
    ],
    features: [
      { type: "DOMAIN", description: "P53 DNA-binding", location: { start: { value: 102 }, end: { value: 292 } } }
    ]
  },
  PUBMED: {
    SEARCH: {
      esearchresult: {
        idlist: ["12345678"]
      }
    },
    SUMMARY: {
      result: {
        "12345678": {
          title: "Structural basis of p53 mutation.",
          uid: "12345678"
        }
      }
    }
  },
  LLM: {
    // ContextAgent output (ContextSchema)
    CONTEXT: {
      gene_function: "Tumor suppressor protein involved in DNA repair and cell cycle regulation.",
      domain_context: "Mutation is located in the DNA-binding domain.",
      known_annotations: ["UniProt: Pathogenic", "ClinVar: Likely pathogenic"],
      clinvar_summary: "Classified as pathogenic by multiple submitters.",
      confidence: "high" as const
    },
    // MechanismAgent output (HypothesisSchema)
    HYPOTHESIS: {
      hypothesis: "The mutation disrupts a critical zinc-binding residue.",
      structural_basis: ["Cys242 is a zinc ligand"],
      confidence: "high" as const,
      reasoning_chain: ["Step 1: Identified zinc coordination site", "Step 2: Mutation removes key residue"]
    },
    // CriticAgent output (CriticSchema)
    CRITIQUE: {
      hallucination_flags: [] as string[],
      final_confidence: "high" as const,
      citations_validated: [] as { claim: string; source: string; valid: boolean }[],
      uncertainty_acknowledged: true
    },
    ALIGNMENT_CASES: {
      "BRCA1:p.Cys61Gly": {
        hypothesis: "The Cys61->Gly substitution removes a zinc-coordinating cysteine in the RING domain, destabilizing the binding site and impairing E3 ubiquitin ligase activity.",
        confidence: "high",
        citations: [] as any[],
        structural_basis: ["RING domain zinc coordination disrupted"]
      },
      "TP53:p.Arg175His": {
          hypothesis: "Arg175 is a DNA contact residue. Mutation to His disrupts sequence-specific DNA binding by altering electrostatic interactions.",
          confidence: "high",
          citations: [] as any[],
          structural_basis: ["Arg175-DNA contact lost"]
      },
      "CFTR:p.Phe508del": {
          hypothesis: "Deletion of Phe508 in NBD1 domain causes misfolding and ER retention, disrupting domain-domain assembly.",
          confidence: "high",
          citations: [] as any[],
          structural_basis: ["NBD1 misfolding"]
      },
      "HBB:p.Glu6Val": {
           hypothesis: "Glu6->Val creates a hydrophobic patch on hemoglobin surface, causing polymerization and sickling under low oxygen.",
           confidence: "high",
           citations: [] as any[],
           structural_basis: ["Surface hydrophobic patch"]
      },
      "BRCA1:p.Arg1699Gln": {
          hypothesis: "Arg1699 is located in the BRCT domain. Substitution to Gln alters hydrogen bonding pattern, disrupting protein-protein interactions in DNA damage response.",
          confidence: "high",
          citations: [] as any[],
          structural_basis: ["BRCT domain H-bonds disrupted"]
      },
      "TP53:p.Arg248Gln": {
          hypothesis: "Arg248 is a DNA-binding residue contacting the minor groove. Mutation to Gln eliminates positive charge required for backbone interaction.",
          confidence: "high",
          citations: [] as any[],
          structural_basis: ["DNA minor groove contact lost"]
      },
      "CFTR:p.Arg117His": {
          hypothesis: "Arg117 is in the first transmembrane helix. His substitution may alter helix packing or channel gating, but retains partial function.",
          confidence: "moderate",
          citations: [] as any[],
          structural_basis: ["TM1 helix packing"]
      },
       "AR:p.Leu702HfsTer7": {
          hypothesis: "Frameshift at Leu702 introduces premature stop codon, truncating the ligand-binding domain and preventing hormone binding.",
          confidence: "high",
          citations: [] as any[],
          structural_basis: ["LBD Truncation"]
      },
      "AR:p.Gln59Leu": {
          hypothesis: "Gln59 is in the N-terminal transactivation domain (disordered). Impact on transcriptional activity is unclear.",
          confidence: "low",
          citations: [] as any[],
          structural_basis: ["Disordered region"]
      },
      "FBN1:p.Cys1409Ser": {
          hypothesis: "Cys1409 in calcium-binding EGF-like domain. Ser substitution disrupts disulfide bond formation critical for domain folding, causing Marfan.",
          confidence: "high",
          citations: [] as any[],
          structural_basis: ["EGF disulfide bond loss"]
      }
    }
  }
};
