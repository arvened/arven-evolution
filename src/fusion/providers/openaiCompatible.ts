import { dig, numOrNull, postJson } from './http.ts';
import {
  ProviderError,
  type CompletionRequest,
  type CompletionResult,
  type FetchLike,
  type LlmProvider,
  type ProviderConfig,
} from './types.ts';

/**
 * Any vendor exposing an OpenAI-style POST {baseUrl}/chat/completions endpoint.
 * Examples of such endpoints: OpenAI, Mistral, DeepSeek, Moonshot (Kimi), Nebius AI Studio,
 * self-hosted vLLM / Ollama. Check each vendor's documentation for the exact base URL.
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly config: ProviderConfig;
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;

  constructor(config: ProviderConfig, apiKey: string, fetchImpl: FetchLike) {
    if (!config.baseUrl) throw new ProviderError(config.id, 'baseUrl is required for openai_compatible providers');
    this.config = config;
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const base = (this.config.baseUrl as string).replace(/\/$/, '');
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      [this.config.maxTokensField ?? 'max_tokens']: this.config.maxOutputTokens ?? 4096,
    };
    if (this.config.temperature !== undefined) body.temperature = this.config.temperature;
    if (this.config.jsonMode === true) body.response_format = { type: 'json_object' };

    const json = await postJson({
      providerId: this.config.id,
      fetchImpl: this.fetchImpl,
      url: `${base}/chat/completions`,
      headers: { authorization: `Bearer ${this.apiKey}` },
      body,
      timeoutMs: this.config.timeoutMs ?? 60_000,
    });

    const text = dig(json, 'choices', 0, 'message', 'content');
    if (typeof text !== 'string') throw new ProviderError(this.config.id, 'unexpected response shape: no choices[0].message.content');
    return {
      text,
      inputTokens: numOrNull(dig(json, 'usage', 'prompt_tokens')),
      outputTokens: numOrNull(dig(json, 'usage', 'completion_tokens')),
    };
  }
}
