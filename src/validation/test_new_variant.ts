
async function testVariant() {
  // --- Manual Test Menu ---
  // 1. JAK2:p.V617F    (MPN Driver)
  // 2. PTEN:p.R130G    (Glioblastoma)
  // 3. ERBB2:p.L755S   (Breast Cancer)
  // 4. APC:p.R1450*    (Colorectal Truncation)
  // 5. SMO:p.W535L     (Basal Cell Carcinoma)
  // ------------------------

  const variant = 'JAK2:p.V617F'; // Change this to test others
  console.log(`Testing New Variant: ${variant}`);
  console.log('--------------------------------------------------');

  try {
    const response = await fetch('http://localhost:3000/api/variant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hgvs: variant }),
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    
    const data: any = await response.json();
    
    // Structure Status
    const struct = data.structure?.source || 'Not Found';
    console.log(`✅ Structure Source: ${struct}`);
    
    // Analysis Status
    const analysis = data.hypothesis?.text || 'No Analysis';
    console.log(`✅ Analysis Preview:`);
    console.log(analysis.substring(0, 500) + '...');
    
    if (analysis.includes('unavailable') || analysis.includes('Fallback')) {
        console.log('\n❌ RESULT: Fallback Triggered');
    } else {
        console.log('\n✅ RESULT: SUCCESS - Analysis Generated');
    }

  } catch (error) {
    console.error('Test Failed:', error);
  }
}

testVariant();
