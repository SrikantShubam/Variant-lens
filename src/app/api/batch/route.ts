import { NextRequest, NextResponse } from 'next/server';
import { batchRateLimiter } from '@/lib/rate-limit';
import { parseHGVS } from '@/lib/variant';

// In-memory job store (replace with Redis in production)
const jobs = new Map<string, {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  variants: string[];
  results?: any[];
  error?: string;
  createdAt: number;
}>();

const BATCH_LIMIT = 20;

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.ip || 'unknown';
    const allowed = await batchRateLimiter.check(ip);
    
    if (!allowed) {
      const retryAfter = batchRateLimiter.getRetryAfter(ip);
      return NextResponse.json(
        { error: 'Batch rate limit exceeded', retryAfter },
        { 
          status: 429,
          headers: { 'Retry-After': String(retryAfter) }
        }
      );
    }

    const body = await request.json();
    const { variants, email } = body;

    // Validate
    if (!variants || !Array.isArray(variants)) {
      return NextResponse.json(
        { error: 'Missing required field: variants (array)' },
        { status: 400 }
      );
    }

    if (variants.length > BATCH_LIMIT) {
      return NextResponse.json(
        { error: `Max ${BATCH_LIMIT} variants allowed per batch` },
        { status: 400 }
      );
    }

    // Validate all variants
    const validatedVariants: string[] = [];
    for (const v of variants) {
      try {
        parseHGVS(v);
        validatedVariants.push(v);
      } catch (error) {
        return NextResponse.json(
          { error: `Invalid HGVS in batch: ${v}`, details: (error as Error).message },
          { status: 400 }
        );
      }
    }

    // Create job
    const jobId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    jobs.set(jobId, {
      status: 'pending',
      variants: validatedVariants,
      createdAt: Date.now(),
    });

    // Process asynchronously
    processBatch(jobId, validatedVariants);

    return NextResponse.json({
      jobId,
      status: 'pending',
      pollUrl: `/api/batch/${jobId}/status`,
      variantsCount: validatedVariants.length,
    }, { status: 202 });

  } catch (error) {
    console.error('Batch API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processBatch(jobId: string, variants: string[]) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = 'processing';

  try {
    const { AgentOrchestrator } = await import('@/lib/agents');
    const orchestrator = new AgentOrchestrator();
    
    const results = [];
    
    for (const variant of variants) {
      try {
        const result = await orchestrator.analyze(variant);
        results.push({
          variant,
          status: 'success',
          ...result,
        });
      } catch (error) {
        results.push({
          variant,
          status: 'error',
          error: (error as Error).message,
        });
      }
    }

    job.status = 'completed';
    job.results = results;

    // Cleanup after 1 hour
    const timer = setTimeout(() => jobs.delete(jobId), 60 * 60 * 1000);
    if (timer.unref) timer.unref();

  } catch (error) {
    job.status = 'failed';
    job.error = (error as Error).message;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const job = jobs.get(params.jobId);
  
  if (!job) {
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404 }
    );
  }

  const response: any = {
    jobId: params.jobId,
    status: job.status,
    variantsCount: job.variants.length,
    createdAt: job.createdAt,
  };

  if (job.status === 'completed') {
    response.results = job.results;
    response.downloadUrl = `/api/batch/${params.jobId}/download`;
  }

  if (job.status === 'failed') {
    response.error = job.error;
  }

  return NextResponse.json(response);
}
