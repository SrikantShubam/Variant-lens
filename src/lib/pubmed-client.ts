/**
 * PubMed API Client
 * 
 * Phase-2 Priority 2: Variant-Specific Literature Discovery
 * 
 * CONSTRAINTS:
 * - Discovery only: Count + Links
 * - Transparency: Return exact search query
 * - No interpretation: No summarization
 */

export interface PubMedPaper {
  pmid: string;
  title: string;
  authors: string[];
  source: string; // Journal
  pubDate: string;
  url: string;
}

export interface PubMedResult {
  count: number;
  query: string;
  papers: PubMedPaper[]; // Top 5 recent
}

// Cache to avoid repeated API calls
const pubmedCache = new Map<string, PubMedResult | null>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function isPlaceholderTitle(title: string | undefined, pmid: string): boolean {
  const normalized = String(title || '').trim().toLowerCase();
  if (!normalized) return true;
  return normalized === pmid.toLowerCase() || normalized === `pmid ${pmid}`.toLowerCase();
}

function stripXmlTags(input: string): string {
  return input.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function decodeBasicEntities(input: string): string {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function fetchArticleTitleFallback(pmid: string): Promise<string | null> {
  try {
    const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml`;
    const response = await fetch(efetchUrl);
    if (!response.ok) return null;

    const xml = await response.text();
    const match = xml.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/i);
    if (!match) return null;

    const title = decodeBasicEntities(stripXmlTags(match[1]));
    if (!title || isPlaceholderTitle(title, pmid)) return null;
    return title;
  } catch {
    return null;
  }
}

/**
 * Search PubMed for variant-specific papers
 */
export async function searchPubMed(
  gene: string,
  proteinChange: string
): Promise<PubMedResult | null> {
  const cacheKey = `${gene}:${proteinChange}`;
  
  if (pubmedCache.has(cacheKey)) {
    return pubmedCache.get(cacheKey) || null;
  }

  try {
    // 1. Construct Transparent Query
    // Rule: "GENE"[Title/Abstract] AND ("p.MUT"[Title/Abstract] OR "MUT"[Title/Abstract])
    const cleanChange = proteinChange.replace(/^p\./, '');
    const query = `"${gene}"[Title/Abstract] AND ("${proteinChange}"[Title/Abstract] OR "${cleanChange}"[Title/Abstract])`;
    
    // 2. Search IDs (esearch)
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=5&sort=date`;
    
    console.log(`[PubMed] Searching: ${query}`);
    
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) throw new Error(`PubMed search failed: ${searchRes.status}`);
    const searchData = await searchRes.json();
    
    const count = parseInt(searchData.esearchresult.count || '0');
    const ids = searchData.esearchresult.idlist;

    // 3. Fetch Details (esummary) - Only if count > 0
    let papers: PubMedPaper[] = [];
    if (count > 0 && ids.length > 0) {
      const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
      const summaryRes = await fetch(summaryUrl);
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        papers = [];
        for (const id of ids) {
          const doc = summaryData.result[id];
          let title = (doc?.title || '').trim();
          if (isPlaceholderTitle(title, id)) {
            title = (await fetchArticleTitleFallback(id)) || '';
          }
          if (isPlaceholderTitle(title, id)) {
            // Avoid exposing obviously broken titles such as "PMID 12345678".
            continue;
          }

          papers.push({
            pmid: id,
            title,
            authors: doc?.authors?.map((a: any) => a.name) || [],
            source: doc?.source || 'PubMed',
            pubDate: doc?.pubdate || '',
            url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`
          });
        }
      }
    }

    const result: PubMedResult = {
      count,
      query,
      papers
    };

    pubmedCache.set(cacheKey, result);
    return result;

  } catch (error) {
    console.error('[PubMed] API error:', error);
    return {
        count: 0,
        query: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        papers: []
    }
  }
}
