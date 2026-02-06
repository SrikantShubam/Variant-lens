import { createServer as createHttpServer } from 'http';
import { NextApiRequest, NextApiResponse } from 'next';
import { POST as variantPost } from '../variant/route';
import { GET as healthGet } from '../health/route';
import { GET as readyGet } from '../ready/route';

// Mock NextRequest/NextResponse if the routes use them (App Router usually uses standard Request/Response)
// However, implementation in `src/app/api/...` usually returns NextResponse.
// Supertest expects a node http server handler.

export const createServer = () => {
  return createHttpServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method;

    try {
      let response: Response | undefined;
      
      // Basic routing logic matching what Next.js would do
      if (path === '/api/variant' && method === 'POST') {
        const body = await parseBody(req);
        // Create a standard Request object
        const request = new Request(url.toString(), {
            method: 'POST',
            body: JSON.stringify(body),
            headers: req.headers as HeadersInit
        }) as any;
        response = await variantPost(request) as Response;
      }
      else if (path === '/api/health' && method === 'GET') {
          response = await healthGet() as Response;
      }
      else if (path === '/api/ready' && method === 'GET') {
          response = await readyGet() as Response;
      }

      if (response) {
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        const json = await response.json(); // Assuming JSON response
        res.end(JSON.stringify(json));
      } else {
        res.statusCode = 404;
        res.end('Not Found');
      }
    } catch (error) {
      console.error(error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  });
};

// Helper to parse body from incoming message
const parseBody = (req: any) => {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', (chunk: any) => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch {
                resolve({});
            }
        });
    });
};
