
import fs from 'fs';
import path from 'path';

function loadEnv() {
  try {
    const envPath = path.resolve('.env.local');
    const content = fs.readFileSync(envPath, 'utf-8');
    
    // Parse line by line to handle newlines properly
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            if (key === 'NVIDIA_API_KEY') process.env.NVIDIA_API_KEY = value;
        }
    });

  } catch (e) {
    console.error("Could not read .env.local", e);
  }
}

async function testNvidia() {
  loadEnv();
  const apiKey = process.env.NVIDIA_API_KEY;
  console.log('API Key Found:', !!apiKey);
  if (apiKey) console.log('Key Length:', apiKey.length);

  const model = 'meta/llama-3.3-70b-instruct'; // Testing this ID
  const url = 'https://integrate.api.nvidia.com/v1/chat/completions';
  
  console.log(`Testing NVIDIA: ${model}`);

  const body = {
    model: model,
    messages: [{ role: 'user', content: 'Return JSON: {"status": "ok"}' }],
    temperature: 0.2,
    max_tokens: 100,
    response_format: { type: 'json_object' }
  };

  try {
    const res = await fetch(url, { 
      method: 'POST', 
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body) 
    });
    
    console.log('HTTP Status:', res.status);
    const text = await res.text();
    console.log('--- BODY ---');
    console.log(text);
    console.log('------------');
    
  } catch (e) {
    console.error("Fetch Error:", e);
  }
}

testNvidia();
