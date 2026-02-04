export type LLMProvider = {
  name: 'gemini' | 'openrouter' | 'ollama' | 'mock';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
};

export interface FallbackConfig {
  primary: LLMProvider;
  fallbacks: LLMProvider[];
  retryDelays: number[];
  circuitBreaker: {
    failureThreshold: number;
    cooldownMs: number;
  };
}

const OPENROUTER_MODELS = {
  gemini: 'meta-llama/llama-3.3-70b-instruct:free', // Re-using 'gemini' key for primary model to minimize refactoring

  llama: 'meta-llama/llama-3.1-8b-instruct:free',
  mistral: 'mistralai/mistral-7b-instruct:free',
};

export function getProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || 'mock';
  
  if (provider === 'gemini') {
    return {
      name: 'gemini',
      apiKey: process.env.GEMINI_API_KEY!,
    };
  }
  
  if (provider === 'openrouter') {
    return {
      name: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY!,
      model: OPENROUTER_MODELS.gemini,
      baseUrl: 'https://openrouter.ai/api/v1',
    };
  }

  if (provider === 'ollama') {
    return {
      name: 'ollama',
      baseUrl: process.env.LOCAL_LLM_URL || 'http://localhost:11434',
      model: 'llama3.1:8b',
    };
  }
  
  return { name: 'mock' };
}

export const LLM_CONFIG: FallbackConfig = {
  // Use Gemini (Gemma 3) as Primary for high availability
  primary: {
    name: 'gemini', // Internal name for Google AI Studio
    apiKey: process.env.GEMINI_API_KEY!,
    model: 'gemma-3-27b-it',
  },
  fallbacks: [
    {
      name: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY!,
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      baseUrl: 'https://openrouter.ai/api/v1',
    },
    {
      name: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY!,
      model: OPENROUTER_MODELS.llama,
      baseUrl: 'https://openrouter.ai/api/v1',
    },
    {
      name: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY!,
      model: OPENROUTER_MODELS.mistral,
      baseUrl: 'https://openrouter.ai/api/v1',
    },
  ],
  retryDelays: [100, 200, 400], // Exponential backoff
  circuitBreaker: {
    failureThreshold: 3,
    cooldownMs: 0, // 0 for testing (was 5 min)
  },
};

export function getFallbackConfig(): FallbackConfig {
  return LLM_CONFIG;
}

// Circuit breaker state
const circuitState: Record<string, { failures: number; openedAt: number | null }> = {};

export async function withRetry<T>(
  fn: (provider: LLMProvider) => Promise<T>,
  config: FallbackConfig = getFallbackConfig()
): Promise<T> {
  const allProviders = [config.primary, ...config.fallbacks];

  for (const provider of allProviders) {
    const key = `${provider.name}:${provider.model}`;
    const state = circuitState[key] || { failures: 0, openedAt: null };

    // Check if circuit is open (in cooldown)
    if (state.openedAt && Date.now() - state.openedAt < config.circuitBreaker.cooldownMs) {
      console.warn(`Circuit open for ${key}, skipping...`);
      continue;
    }

    for (let attempt = 0; attempt <= config.retryDelays.length; attempt++) {
      try {
        const result = await fn(provider);
        // Reset failures on success
        circuitState[key] = { failures: 0, openedAt: null };
        return result;
      } catch (error: any) {
        console.error(`Attempt ${attempt + 1} failed for ${key}:`, error.message);

        // If rate limited (429), don't retry, move to next provider
        if (error.status === 429) {
          state.failures++;
          if (state.failures >= config.circuitBreaker.failureThreshold) {
            state.openedAt = Date.now();
            console.warn(`Circuit opened for ${key}`);
          }
          circuitState[key] = state;
          break; // Move to next provider
        }

        // Wait before retry
        if (attempt < config.retryDelays.length) {
          await new Promise(r => setTimeout(r, config.retryDelays[attempt]));
        }
      }
    }
  }

  throw new Error('All LLM providers failed');
}

// Check if local Ollama is available
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const url = process.env.LOCAL_LLM_URL || 'http://localhost:11434';
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
