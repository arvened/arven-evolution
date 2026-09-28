import { ProviderError, type FetchLike } from './types.ts';

const RETRYABLE = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);

export interface PostJsonOptions {
  providerId: string;
  fetchImpl: FetchLike;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  timeoutMs: number;
  retries?: number;
  /** Test hook: replaces the real delay between retries. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * POST JSON with a timeout and a small number of retries on transient failures
 * (network errors, timeouts, 429 and 5xx).
 *
 * Error messages carry the HTTP status and a short slice of the response body, never
 * request headers, so API keys cannot leak into logs.
 */
export async function postJson(opts: PostJsonOptions): Promise<unknown> {
  const retries = opts.retries ?? 1;
  const sleep = opts.sleep ?? defaultSleep;
  let lastError = new ProviderError(opts.providerId, 'request not attempted');

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(500 * 2 ** (attempt - 1));
    const canRetry = attempt < retries;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);

    let status: number;
    let ok: boolean;
    let raw: string;
    try {
      const res = await opts.fetchImpl(opts.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...opts.headers },
        body: JSON.stringify(opts.body),
        signal: controller.signal,
      });
      status = res.status;
      ok = res.ok;
      raw = await res.text();
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      lastError = new ProviderError(
        opts.providerId,
        aborted ? `timeout after ${opts.timeoutMs} ms` : `network error: ${err instanceof Error ? err.message : String(err)}`,
      );
      if (canRetry) continue;
      throw lastError;
    } finally {
      clearTimeout(timer);
    }

    if (!ok) {
      lastError = new ProviderError(opts.providerId, `HTTP ${status}: ${raw.slice(0, 300)}`, status);
      if (canRetry && RETRYABLE.has(status)) continue;
      throw lastError;
    }

    try {
      return JSON.parse(raw) as unknown;
    } catch {
      throw new ProviderError(opts.providerId, `response is not JSON: ${raw.slice(0, 200)}`, status);
    }
  }
  throw lastError;
}

/** Reads a nested property without throwing; returns undefined when the path does not exist. */
export function dig(value: unknown, ...path: (string | number)[]): unknown {
  let cur: unknown = value;
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

export const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
