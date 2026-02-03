
const PDB_URL = 'https://search.rcsb.org/rcsbsearch/v2/query';
const AF_URL = 'https://alphafold.ebi.ac.uk/api/prediction/P04637';

async function checkPDB() {
  console.log('Checking PDB API...');
  try {
    const query = {
      query: {
        type: 'terminal',
        service: 'text',
        parameters: {
          attribute: 'rcsb_polymer_entity_container_identifiers.reference_sequence_identifiers.database_accession',
          operator: 'exact_match',
          value: 'TP53', // Testing with Gene Name (incorrect ID type)
        },
      },
      return_type: 'entry',
    };

    const res = await fetch(PDB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });
    console.log(`PDB Status: ${res.status}`);
    if (!res.ok) console.error(await res.text());
    else {
        const data = await res.json();
        console.log(`PDB Result count: ${data.result_set?.length}`);
    }
  } catch (err) {
    console.error('PDB Connection Failed:', err);
  }
}

async function checkAF() {
    // Test user failure case
    const inputs = ['BRCA1', 'TP53'];
    
    for (const input of inputs) {
        if (!input) continue;
        console.log(`\nChecking AlphaFold API for '${input}'...`);
        const res = await fetch(`${AF_URL.replace('P04637', '')}${input}`);
        console.log(`Status: ${res.status}`);
        if (!res.ok) console.error(await res.text().catch(() => 'No body'));
    }
}

(async () => {
    await checkPDB();
    await checkAF();
})();
