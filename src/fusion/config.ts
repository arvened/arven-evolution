import { readFileSync } from 'node:fs';
import { AnthropicProvider } from './providers/anthropic.ts';
import { GeminiProvider } from './providers/gemini.ts';
import { OpenAiCompatibleProvider } from './providers/openaiCompatible.ts';
import type { FetchLike, LlmProvider, ProviderConfig, ProviderKind } from './providers/types.ts';

export interface FusionConfig {
  providers: ProviderConfig[];
  /** Exclude every provider not declared as euHosted. */
  requireEuHosting?: boolean;
  /** Minimum share of agreeing providers for a consensus result (0.5-1). Default 0.75. */
  agreementThreshold?: number;
  /** Minimum number of providers that must answer successfully. Default 2. */
  minSuccessfulProviders?: number;
}

export interface SkippedProvider {
  id: string;
  reason: string;
}

export interface ResolvedFusion {
  providers: LlmProvider[];
  skipped: SkippedProvider[];
  agreementThreshold: number;
  minSuccessfulProviders: number;
}

const KINDS: readonly ProviderKind[] = ['anthropic', 'openai_compatible', 'gemini'];

export class FusionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FusionConfigError';
  }
}

function assertConfig(raw: unknown): FusionConfig {
  if (typeof raw !== 'object' || raw === null) throw new FusionConfigError('fusion config must be a JSON object');
  const cfg = raw as Record<string, unknown>;
  if (!Array.isArray(cfg.providers)) throw new FusionConfigError('fusion config: "providers" must be an array');
  const ids = new Set<string>();
  cfg.providers.forEach((p, i) => {
    const pc = p as Record<string, unknown>;
    const where = `providers[${i}]`;
    for (const key of ['id', 'model', 'apiKeyEnv'] as const) {
      if (typeof pc[key] !== 'string' || pc[key] === '') throw new FusionConfigError(`${where}.${key} must be a non-empty string`);
    }
    if (!KINDS.includes(pc.kind as ProviderKind)) throw new FusionConfigError(`${where}.kind must be one of ${KINDS.join(', ')}`);
    if (typeof pc.euHosted !== 'boolean') throw new FusionConfigError(`${where}.euHosted must be true or false`);
    if (pc.kind === 'openai_compatible' && typeof pc.baseUrl !== 'string') throw new FusionConfigError(`${where}.baseUrl is required for openai_compatible`);
    if (typeof pc.apiKeyEnv === 'string' && /^(sk-|AIza|ghp_)/.test(pc.apiKeyEnv))
      throw new FusionConfigError(`${where}.apiKeyEnv looks like an API key; put the NAME of an environment variable here, not the key`);
    if (ids.has(pc.id as string)) throw new FusionConfigError(`${where}.id "${String(pc.id)}" is duplicated`);
    ids.add(pc.id as string);
  });
  const t = cfg.agreementThreshold;
  if (t !== undefined && (typeof t !== 'number' || t < 0.5 || t > 1)) throw new FusionConfigError('agreementThreshold must be between 0.5 and 1');
  const m = cfg.minSuccessfulProviders;
  if (m !== undefined && (typeof m !== 'number' || !Number.isInteger(m) || m < 1)) throw new FusionConfigError('minSuccessfulProviders must be a positive integer');
  return cfg as unknown as FusionConfig;
}

/**
 * Reads the fusion configuration from FUSION_CONFIG_JSON (inline JSON) or FUSION_CONFIG_FILE (path).
 * Returns null when neither is set: the document review feature is then disabled.
 */
export function loadFusionConfig(env: NodeJS.ProcessEnv = process.env): FusionConfig | null {
  if (env.FUSION_CONFIG_JSON) return assertConfig(JSON.parse(env.FUSION_CONFIG_JSON));
  if (env.FUSION_CONFIG_FILE) return assertConfig(JSON.parse(readFileSync(env.FUSION_CONFIG_FILE, 'utf8')));
  return null;
}

export function createProvider(config: ProviderConfig, apiKey: string, fetchImpl: FetchLike): LlmProvider {
  switch (config.kind) {
    case 'anthropic':
      return new AnthropicProvider(config, apiKey, fetchImpl);
    case 'openai_compatible':
      return new OpenAiCompatibleProvider(config, apiKey, fetchImpl);
    case 'gemini':
      return new GeminiProvider(config, apiKey, fetchImpl);
  }
}

export function resolveFusion(
  config: FusionConfig,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: FetchLike = fetch,
): ResolvedFusion {
  const providers: LlmProvider[] = [];
  const skipped: SkippedProvider[] = [];
  for (const pc of config.providers) {
    if (config.requireEuHosting === true && !pc.euHosted) {
      skipped.push({ id: pc.id, reason: 'excluded: requireEuHosting is on and the provider is not declared as EU-hosted' });
      continue;
    }
    const key = env[pc.apiKeyEnv];
    if (!key) {
      skipped.push({ id: pc.id, reason: `environment variable ${pc.apiKeyEnv} is not set` });
      continue;
    }
    providers.push(createProvider(pc, key, fetchImpl));
  }
  return {
    providers,
    skipped,
    agreementThreshold: config.agreementThreshold ?? 0.75,
    minSuccessfulProviders: config.minSuccessfulProviders ?? 2,
  };
}
