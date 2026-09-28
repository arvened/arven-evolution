import { dig, numOrNull, postJson } from './http.ts';
import {
  ProviderError,
  type CompletionRequest,
  type CompletionResult,
  type FetchLike,
  type LlmProvider,
  type ProviderConfig,
} from './types.ts';

/** Anthropic Messages API (POST /v1/messages). */
export class AnthropicProvider implements LlmProvider {
  readonly config: ProviderConfig;
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;

  constructor(config: ProviderConfig, apiKey: string, fetchImpl: FetchLike) {
    this.config = config;
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const base = (this.config.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '');
    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: this.config.maxOutputTokens ?? 4096,
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
    };
    if (this.config.temperature !== undefined) body.temperature = this.config.temperature;

    const json = await postJson({
      providerId: this.config.id,
      fetchImpl: this.fetchImpl,
      url: `${base}/v1/messages`,
      headers: { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      body,
      timeoutMs: this.config.timeoutMs ?? 60_000,
    });

    const blocks = dig(json, 'content');
    if (!Array.isArray(blocks)) throw new ProviderError(this.config.id, 'unexpected response shape: no content array');
    const text = blocks
      .filter((b) => dig(b, 'type') === 'text')
      .map((b) => String(dig(b, 'text') ?? ''))
      .join('');
    return {
      text,
      inputTokens: numOrNull(dig(json, 'usage', 'input_tokens')),
      outputTokens: numOrNull(dig(json, 'usage', 'output_tokens')),
    };
  }
}
