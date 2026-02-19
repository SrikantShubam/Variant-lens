/**
 * FETCH UTILS - RESILIENCE PRIMITIVES
 * 
 * Provides a robust fetch wrapper with:
 * - Retries (Exponential backoff + Jitter)
 * - Circuit Breaker (Per-process state, fail-fast)
 * - Timeouts (AbortController)
 * - Standardized Error Handling
 */

export type FetchFailureReason = 
  | 'timeout' 
  | 'circuit_open' 
  | 'upstream_5xx' 
  | 'rate_limited' 
  | 'network_error' 
  | 'bad_response'
  | 'unknown';

export interface FetchFailure {
  unavailable: true;
  reason: FetchFailureReason;
  service: string;
  details?: string;
  statusCode?: number;
}

export type FetchResult<T> = T | FetchFailure | null;

interface CircuitBreakerState {
  failures: number;
  lastFailure: number; // timestamp
  status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  nextTry: number; // timestamp when we can try again
}

// Global per-process state
const CIRCUIT_BREAKERS = new Map<string, CircuitBreakerState>();

// Configuration
const DEFAULT_TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;
const CIRCUIT_THRESHOLD = 5; // failures to open
const CIRCUIT_COOLDOWN_MS = 30000; // 30s default cooldown
const CIRCUIT_COOLDOWN_429_MS = 60000; // 60s for rate limits

export class ServiceUnavailableError extends Error {
  constructor(public service: string, public reason: FetchFailureReason) {
    super(`Service ${service} unavailable: ${reason}`);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Get or initialize circuit breaker state
 */
function getCircuitState(service: string): CircuitBreakerState {
  if (!CIRCUIT_BREAKERS.has(service)) {
    CIRCUIT_BREAKERS.set(service, {
      failures: 0,
      lastFailure: 0,
      status: 'CLOSED',
      nextTry: 0
    });
  }
  return CIRCUIT_BREAKERS.get(service)!;
}

/**
 * Check circuit status and throw if open
 */
function checkCircuit(service: string): void {
  const state = getCircuitState(service);
  const now = Date.now();

  if (state.status === 'OPEN') {
    if (now >= state.nextTry) {
      // Cooldown over -> Half-Open (allow 1 trial)
      state.status = 'HALF_OPEN';
      console.log(`[CircuitBreaker] ${service} entering HALF_OPEN (trial request)`);
    } else {
      throw new ServiceUnavailableError(service, 'circuit_open');
    }
  }
  // HALF_OPEN allows the request to proceed. If it fails, it goes back to OPEN.
}

/**
 * Record success (resets circuit)
 */
function recordSuccess(service: string): void {
  const state = getCircuitState(service);
  if (state.failures > 0 || state.status !== 'CLOSED') {
    console.log(`[CircuitBreaker] ${service} recovered. Resetting to CLOSED.`);
    state.failures = 0;
    state.status = 'CLOSED';
    state.nextTry = 0;
  }
}

/**
 * Record failure (increments, potentially opens circuit)
 */
function recordFailure(service: string, statusCode?: number): void {
  const state = getCircuitState(service);
  state.failures++;
  state.lastFailure = Date.now();

  const isRateLimit = statusCode === 429;
  
  if (state.status === 'HALF_OPEN' || state.failures >= CIRCUIT_THRESHOLD || isRateLimit) {
    state.status = 'OPEN';
    const cooldown = isRateLimit ? CIRCUIT_COOLDOWN_429_MS : CIRCUIT_COOLDOWN_MS;
    state.nextTry = Date.now() + cooldown;
    console.warn(`[CircuitBreaker] ${service} OPENED. failures=${state.failures}, cooldown=${cooldown}ms`);
  }
}

interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  circuitBreakerKey?: string; // e.g., 'clinvar', 'pubmed'
  failOn404?: boolean; // if true, 404 throws/returns failure. if false (default), 404 returns null (not found).
}

/**
 * Robust fetch with retries, timeout, and circuit breaker.
 * 
 * Returns:
 * - Parsed JSON object (T) on success
 * - null on 404 (Not Found) - implying data absence, not system failure
 * - FetchFailure object on system failure (if configured to not throw)
 * - Throws ServiceUnavailableError if desired, or returns FetchFailure
 */
export async function fetchWithRetry<T>(
  url: string, 
  options: FetchOptions = {}
): Promise<FetchResult<T>> {
  const { 
    timeoutMs = DEFAULT_TIMEOUT_MS, 
    circuitBreakerKey = 'unknown',
    failOn404 = false,
    method = 'GET',
    ...fetchOpts 
  } = options;

  // 1. Check Circuit Breaker
  try {
    checkCircuit(circuitBreakerKey);
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      return { 
        unavailable: true, 
        reason: 'circuit_open', 
        service: circuitBreakerKey, 
        details: 'Circuit is open due to previous failures' 
      };
    }
    throw error;
  }

  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOpts,
        method,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      // Handle Success
      if (response.ok) {
        recordSuccess(circuitBreakerKey);
        // Handle empty responses/text? Assuming JSON for now based on project usage.
        if (response.status === 204) return {} as T;
        return await response.json() as T;
      }

      // Handle 404 (Not Found)
      if (response.status === 404) {
         if (failOn404) {
             throw new Error('404 Not Found');
         }
         // 404 is usually "Success" in terms of "we checked and it's not there"
         // It does NOT count as a system failure for the circuit breaker.
         recordSuccess(circuitBreakerKey); 
         return null;
      }

      // Handle 429 (Rate Limit) - Fail Fast
      if (response.status === 429) {
        recordFailure(circuitBreakerKey, 429);
        return { 
          unavailable: true, 
          reason: 'rate_limited', 
          service: circuitBreakerKey,
          statusCode: 429 
        };
      }

      // Handle 5xx (Server Errors) - Retry
      if (response.status >= 500) {
        throw new Error(`Upstream ${response.status}`);
      }
      
      // Handle 4xx (Client Errors, other than 404/429) - Don't retry, likely bug
      throw new Error(`Client Error ${response.status}`);

    } catch (error: any) {
      clearTimeout(timeoutId);
      lastError = error;

      const isAbort = error.name === 'AbortError';
      const isNetwork = error.message.includes('fetch'); // simplistic
      
      // Determine if retryable
      // Retry on: Network error, Timeout, 5xx
      // Don't retry on: 4xx (except 429 which we handled above)
      
      const shouldRetry = (isAbort || isNetwork || error.message.includes('Upstream')) && attempt <= MAX_RETRIES;

      if (shouldRetry) {
        // Jittered Backoff: base * 2^attempt + jitter
        const baseDelay = 500 * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 100;
        const delay = baseDelay + jitter;
        
        console.warn(`[FetchUtils] Attempt ${attempt} failed for ${circuitBreakerKey}: ${error.message}. Retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      } else {
        break; // Stop retrying
      }
    }
  }

  // If we get here, we exhausted retries or hit a non-retryable error
  
  // Record failure in circuit breaker
  recordFailure(circuitBreakerKey, (lastError as any)?.statusCode);

  const reason: FetchFailureReason = 
    lastError?.name === 'AbortError' ? 'timeout' :
    lastError?.message.includes('Upstream') ? 'upstream_5xx' :
    'network_error';

  return {
    unavailable: true,
    reason,
    service: circuitBreakerKey,
    details: lastError?.message
  };
}
