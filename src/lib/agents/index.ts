import { ContextAgent, MechanismAgent, CriticAgent } from './agents';
import { parseHGVS } from '../variant';
import { resolveStructure } from '../structure';
import { uniprotCache, pubmedCache } from '../cache';

export interface AgentResult {
  context: any;
  hypothesis: {
    text: string;
    confidence: string;
    citations: Array<{ pmid: string; title: string }>;
    structural_basis: string[];
  };
  validation: {
    flags: string[];
    final_confidence: string;
  };
}

export class AgentOrchestrator {
  private contextAgent = new ContextAgent();
  private mechanismAgent = new MechanismAgent();
  private criticAgent = new CriticAgent();

  async analyze(hgvs: string): Promise<AgentResult> {
    try {
      // Parse variant
      const parsed = parseHGVS(hgvs);
      
      // Fetch context (with caching)
      const uniprotData = await this.fetchUniprot(parsed.gene);
      const clinvarData = await this.fetchClinvar(hgvs);
      
      // Run context agent
      const context = await this.contextAgent.run(hgvs, uniprotData, clinvarData);
      
      // Fetch structure
      const structure = await resolveStructure(uniprotData.uniprotId, parsed.pos);
      
      // Get local environment (simplified)
      const localEnv = await this.getLocalEnvironment(structure, parsed.pos);
      
      // Run mechanism agent
      const mechanismDraft = await this.mechanismAgent.run(
        hgvs,
        context,
        structure,
        localEnv
      );
      
      // Fetch citations
      const citations = await this.fetchCitations(mechanismDraft, parsed.gene);
      
      // Run critic
      const critique = await this.criticAgent.review(mechanismDraft, citations);
      
      // Apply critic feedback
      const finalHypothesis = this.applyCritique(mechanismDraft, critique);
      
      return {
        context,
        hypothesis: {
          text: finalHypothesis.hypothesis,
          confidence: critique.final_confidence,
          citations: citations.map(c => ({ pmid: c.pmid, title: c.title })),
          structural_basis: finalHypothesis.structural_basis,
        },
        validation: {
          flags: critique.hallucination_flags,
          final_confidence: critique.final_confidence,
        },
      };

    } catch (error) {
      console.error('Agent orchestration failed:', error);
      throw new Error(`Analysis timeout or failure: ${(error as Error).message}`);
    }
  }

  private async fetchUniprot(gene: string): Promise<any> {
    const cacheKey = `uniprot:${gene}`;
    const cached = uniprotCache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        `https://rest.uniprot.org/uniprotkb/search?query=gene:${gene}+AND+reviewed:true&format=json&limit=1`
      );
      
      if (!response.ok) throw new Error('UniProt fetch failed');
      
      const data = await response.json();
      const result = data.results?.[0] || {};
      
      const processed = {
        uniprotId: result.primaryAccession,
        sequence: result.sequence?.sequence,
        functions: result.comments?.filter((c: any) => c.commentType === 'FUNCTION').map((c: any) => c.text?.[0]?.value),
        domains: result.features?.filter((f: any) => f.type === 'DOMAIN').map((f: any) => ({
          name: f.description,
          start: f.location?.start?.value,
          end: f.location?.end?.value,
        })),
      };
      
      uniprotCache.set(cacheKey, processed);
      return processed;
      
    } catch (error) {
      console.error('UniProt fetch failed:', error);
      return { uniprotId: gene, sequence: null, functions: [], domains: [] };
    }
  }

  private async fetchClinvar(hgvs: string): Promise<any> {
    try {
      const response = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=clinvar&term=${encodeURIComponent(hgvs)}&retmode=json`
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      return { id: data.esearchresult?.idlist?.[0], count: data.esearchresult?.count };
      
    } catch {
      return null;
    }
  }

  private async getLocalEnvironment(structure: any, position: number): Promise<any> {
    // Simplified - would parse PDB/CIF to get residues within 8Å
    return {
      targetResidue: position,
      nearbyResidues: [],
      secondaryStructure: 'unknown',
    };
  }

  private async fetchCitations(hypothesis: any, gene: string): Promise<any[]> {
    // Search PubMed for relevant papers
    const query = `${gene} ${hypothesis.structural_basis?.[0] || ''}`.trim();
    
    try {
      const response = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=5&retmode=json`
      );
      
      if (!response.ok) return [];
      
      const data = await response.json();
      const ids = data.esearchresult?.idlist || [];
      
      // Fetch details
      if (ids.length > 0) {
        const summaryResponse = await fetch(
          `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`
        );
        
        const summaryData = await summaryResponse.json();
        return ids.map((id: string) => ({
          pmid: id,
          title: summaryData.result?.[id]?.title || 'Unknown',
        }));
      }
      
      return [];
      
    } catch {
      return [];
    }
  }

  private applyCritique(draft: any, critique: any): any {
    // If critic found issues, apply corrections
    if (critique.hallucination_flags.length > 0) {
      console.warn('Critic flags:', critique.hallucination_flags);
    }
    
    return {
      ...draft,
      confidence: critique.final_confidence,
    };
  }
}
