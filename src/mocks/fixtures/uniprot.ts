export const uniprotFixtures: Record<string, any> = {
  // TP53
  TP53: {
    primaryAccession: 'P04637',
    uniProtkbId: 'P53_HUMAN',
    organism: {
      scientificName: 'Homo sapiens',
      commonName: 'Human',
      taxonId: 9606,
    },
    proteinDescription: {
      recommendedName: {
        fullName: {
          value: 'Cellular tumor antigen p53',
        },
      },
    },
    genes: [
      {
        geneName: {
          value: 'TP53',
        },
      },
    ],
    sequence: {
      length: 393,
      mass: 43653,
      sequence: 'MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGPGEAPRMPEAAPPVAPAPAAPTPAAPAPAPSWPLSSSVPSQKTYQGSYGFRLGFLHSGTAKSVTCTYSPALNKMFCQLAKTCPVQLWVDSTPPPGTRVRAMAIYKQSQHMTEVVRRCPHHERCSDSDGLAPPQHLIRVEGNLRVEYLDDRNTFRHSVVVPYEPPEVGSDCTTIHYNYMCNSSCMGGMNRRPILTIITLEDSSGNLLGRNSFEVRVCACPGRDRRTEEENLRKKGEPHHELPPGSTKRALPNNTSSSPQPKKKPLDGEYFTLQIRGRERFEMFRELNEALELKDAQAGKEPGGSRAHSSHLKSKKGQSTSRHKKLMFKTEGPDSD',
    },
    comments: [
      {
        commentType: 'FUNCTION',
        texts: [
          {
            value: 'Acts as a tumor suppressor in many tumor types; induces growth arrest or apoptosis depending on the physiological circumstances and cell type. Involved in cell cycle regulation as a trans-activator that acts to negatively regulate cell division by controlling a set of genes required for this process.',
          },
        ],
      },
    ],
    features: [
      {
        type: 'DOMAIN',
        description: 'Transactivation',
        location: { start: { value: 1 }, end: { value: 40 } },
      },
      {
        type: 'DOMAIN',
        description: 'DNA-binding',
        location: { start: { value: 94 }, end: { value: 292 } },
      },
      {
        type: 'MUTAGEN',
        description: 'Reduced transcriptional activation activity',
        location: { start: { value: 175 }, end: { value: 175 } },
      },
    ],
  },

  // BRCA1
  BRCA1: {
    primaryAccession: 'P38398',
    uniProtkbId: 'BRCA1_HUMAN',
    organism: { scientificName: 'Homo sapiens', taxonId: 9606 },
    proteinDescription: {
      recommendedName: { fullName: { value: 'Breast cancer type 1 susceptibility protein' } },
    },
    genes: [{ geneName: { value: 'BRCA1' } }],
    sequence: { length: 1863, mass: 207721 },
    comments: [
      {
        commentType: 'FUNCTION',
        texts: [
          { value: 'E3 ubiquitin-protein ligase that specifically mediates the formation of \'Lys-6\'-linked polyubiquitin chains and plays a central role in DNA repair by facilitating cellular responses to DNA damage.' },
        ],
      },
    ],
    features: [
      {
        type: 'DOMAIN',
        description: 'RING-type',
        location: { start: { value: 1 }, end: { value: 109 } },
      },
      {
        type: 'DOMAIN',
        description: 'BRCT',
        location: { start: { value: 1650 }, end: { value: 1850 } },
      },
    ],
  },

  // CFTR
  CFTR: {
    primaryAccession: 'P13569',
    uniProtkbId: 'CFTR_HUMAN',
    organism: { scientificName: 'Homo sapiens', taxonId: 9606 },
    proteinDescription: {
      recommendedName: { fullName: { value: 'Cystic fibrosis transmembrane conductance regulator' } },
    },
    genes: [{ geneName: { value: 'CFTR' } }],
    sequence: { length: 1480, mass: 168138 },
    comments: [
      {
        commentType: 'FUNCTION',
        texts: [
          { value: 'Epithelial ion channel that plays a role in the regulation of epithelial ion and water transport and fluid homeostasis.' },
        ],
      },
    ],
    features: [
      {
        type: 'TOPO_DOM',
        description: 'Cytoplasmic',
        location: { start: { value: 1 }, end: { value: 85 } },
      },
      {
        type: 'TRANSMEM',
        description: 'Helical',
        location: { start: { value: 86 }, end: { value: 106 } },
      },
    ],
  },
};
