/**
 * Literature Search Integration Tests
 * 
 * Phase-2 Priority 2: Variant-Specific Literature Discovery
 * 
 * CONSTRAINTS:
 * - Discovery only: Count + Links
 * - Transparency: Must return exact search query used
 * - No interpretation: No summarizing content
 */

import { searchPubMed, PubMedResult } from '../lib/pubmed-client';

// ==========================================
// TEST CLASS 1: Well-Known Variant (Positive Control)
// ==========================================
describe('PubMed: Well-Known Variants', () => {
  
  test('JAK2 V617F finds papers', async () => {
    const result = await searchPubMed('JAK2', 'p.V617F');
    
    expect(result).not.toBeNull();
    expect(result?.count).toBeGreaterThan(10); // Should have many
    expect(result?.papers.length).toBeGreaterThan(0);
    expect(result?.query).toContain('JAK2');
    expect(result?.query).toContain('V617F');
  });

  test('BRAF V600E finds papers', async () => {
    const result = await searchPubMed('BRAF', 'p.V600E');
    
    expect(result).not.toBeNull();
    expect(result?.count).toBeGreaterThan(10);
  });
});

// ==========================================
// TEST CLASS 2: Rare Variant (Negative Control)
// ==========================================
describe('PubMed: Rare Variants', () => {
  
  test('Rare variant returns 0 count (not null)', async () => {
    // Using a fictional/rare variant
    const result = await searchPubMed('OBSCN', 'p.R4831H');
    
    expect(result).not.toBeNull(); // Should return empty result, not null
    expect(result?.count).toBe(0);
    expect(result?.papers).toHaveLength(0);
    // Query must still be present for transparency
    expect(result?.query).toBeDefined(); 
  });
});

// ==========================================
// TEST CLASS 3: Query Transparency (Critical)
// ==========================================
describe('PubMed: Query Transparency', () => {
  
  test('Result includes exact search query', async () => {
    const gene = 'TP53';
    const variant = 'p.R175H';
    const result = await searchPubMed(gene, variant);
    
    // Check query construction logic
    // Expect: "TP53"[Title/Abstract] AND ("p.R175H"[Title/Abstract] OR "R175H"[Title/Abstract])
    expect(result?.query).toContain(gene);
    expect(result?.query).toContain(variant);
    expect(result?.query).toContain('R175H'); // Short form
  });
});

// ==========================================
// TEST CLASS 4: Paper Data Structure
// ==========================================
describe('PubMed: Paper Data', () => {
  
  test('Papers have required fields', async () => {
    const result = await searchPubMed('JAK2', 'p.V617F');
    
    if (result && result.papers.length > 0) {
      const paper = result.papers[0];
      expect(paper).toHaveProperty('pmid');
      expect(paper).toHaveProperty('title');
      expect(paper).toHaveProperty('authors');
      expect(paper).toHaveProperty('source');
      expect(paper).toHaveProperty('pubDate');
      
      // Validation: No content summary
      expect(paper).not.toHaveProperty('summary');
      expect(paper).not.toHaveProperty('chatGptSummary');
    }
  });
});

console.log(`
╔════════════════════════════════════════════════════════════╗
║              LITERATURE SEARCH TESTS                       ║
╠════════════════════════════════════════════════════════════╣
║ Test 1: Known variants find papers (JAK2 V617F)            ║
║ Test 2: Rare variants return 0 count (explicit absence)    ║
║ Test 3: Query is returned in result (Transparency)         ║
║ Test 4: Paper data contains metadata ONLY (No summary)     ║
╚════════════════════════════════════════════════════════════╝

Run with: npx tsx src/validation/literature-tests.ts (after client impl)
`);
