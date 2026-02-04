
import fs from 'fs';
import path from 'path';

function loadEnv() {
  try {
    const envPath = path.resolve('.env.local');
    const constent = fs.readFileSync(envPath, 'utf-8');
    const match = constent.match(/GEMINI_API_KEY=(.+)/);
    if (match) process.env.GEMINI_API_KEY = match[1].trim();
  } catch (e) {
    console.error("Could not read .env.local", e);
  }
}
loadEnv();

async function testGemma() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API Key found in .env.local");
    return;
  }

  const model = 'gemma-3-27b-it';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  console.log(`Testing Gemma Direct: ${model}`);
  
  const body = {
    contents: [{ role: 'user', parts: [{ text: 'Return a JSON object with one key "message" and value "hello". Do not use markdown.' }] }],
    generationConfig: { 
      temperature: 0.1 
      // Note: No responseMimeType
    } 
  };

  try {
    const res = await fetch(url, { 
      method: 'POST', 
      body: JSON.stringify(body), 
      headers: {'Content-Type': 'application/json'} 
    });
    
    console.log('HTTP Status:', res.status);
    const text = await res.text();
    console.log('--- RAW RESPONSE ---');
    console.log(text);
    console.log('--------------------');
    
  } catch (e) {
    console.error("Fetch Error:", e);
  }
}

testGemma();
