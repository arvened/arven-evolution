import { dig, numOrNull, postJson } from './http.ts';
import {
  ProviderError,
  type CompletionRequest,
  type CompletionResult,
  type FetchLike,
  type LlmProvider,
  type ProviderConfig,
} from './types.ts';

/** Google Gemini API (POST {base}/models/{model}:generateContent). */
export class GeminiProvider implements LlmProvider {
  readonly config: ProviderConfig;
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;

  constructor(config: ProviderConfig, apiKey: string, fetchImpl: FetchLike) {
    this.config = config;
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const base = (this.config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: this.config.maxOutputTokens ?? 4096,
      responseMimeType: 'application/json',
    };
    if (this.config.temperature !== undefined) generationConfig.temperature = this.config.temperature;

    const json = await postJson({
      providerId: this.config.id,
      fetchImpl: this.fetchImpl,
      url: `${base}/models/${encodeURIComponent(this.config.model)}:generateContent`,
      headers: { 'x-goog-api-key': this.apiKey },
      body: {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: [{ text: req.user }] }],
        generationConfig,
      },
      timeoutMs: this.config.timeoutMs ?? 60_000,
    });

    const parts = dig(json, 'candidates', 0, 'content', 'parts');
    if (!Array.isArray(parts)) {
      const reason = dig(json, 'promptFeedback', 'blockReason') ?? dig(json, 'candidates', 0, 'finishReason');
      throw new ProviderError(this.config.id, `unexpected response shape${reason ? ` (${String(reason)})` : ''}`);
    }
    return {
      text: parts.map((p) => String(dig(p, 'text') ?? '')).join(''),
      inputTokens: numOrNull(dig(json, 'usageMetadata', 'promptTokenCount')),
      outputTokens: numOrNull(dig(json, 'usageMetadata', 'candidatesTokenCount')),
    };
  }
}
