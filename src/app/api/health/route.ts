import { NextResponse } from 'next/server';

export async function GET() {
  const health = {
    status: 'ok',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    services: {
      api: 'up',
      pdb: await checkPDB(),
      uniprot: await checkUniProt(),
      openai: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
    },
  };

  const allUp = Object.values(health.services).every(s => s === 'up' || s === 'configured');
  
  return NextResponse.json(health, {
    status: allUp ? 200 : 503,
  });
}

async function checkPDB(): Promise<string> {
  try {
    const response = await fetch('https://www.rcsb.org/robots.txt', {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

async function checkUniProt(): Promise<string> {
  try {
    const response = await fetch('https://rest.uniprot.org/uniprotkb/P04637.json', {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok ? 'up' : 'down';
  } catch {
    return 'down';
  }
}
