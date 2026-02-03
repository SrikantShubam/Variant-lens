
import { resolveStructure } from './structure';
import { normalizeVariant } from './variant';

async function testBackend() {
  const hgvs = 'TP53:p.R175H';
  console.log(`Testing backend logic for: ${hgvs}`);

  try {
    const { parsed } = normalizeVariant(hgvs);
    console.log(`Parsed Gene: ${parsed.gene}`);
    
    console.log('Resolving structure...');
    const structure = await resolveStructure(parsed.gene, parsed.pos);
    console.log('Structure Result:', JSON.stringify(structure, null, 2));

  } catch (error) {
    console.error('BACKEND FAILURE:', error);
  }
}

testBackend();
