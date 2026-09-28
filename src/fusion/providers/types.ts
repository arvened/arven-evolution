export type ProviderKind = 'anthropic' | 'openai_compatible' | 'gemini';

export interface ProviderConfig {
  /** Free label used in reports, e.g. "claude", "deepseek", "mistral-eu". */
  id: string;
  kind: ProviderKind;
  /** Model identifier exactly as the vendor API expects it. Not hardcoded in the code on purpose. */
  model: string;
  /** Name of the environment variable holding the API key. The key itself never goes into config files. */
  apiKeyEnv: string;
  /** Required for openai_compatible (e.g. https://api.mistral.ai/v1); optional override for others. */
  baseUrl?: string;
  /** Operator's declaration that inference runs in the EU/EEA. Used when requireEuHosting is on. */
  euHosted: boolean;
  /** Prices in USD per million tokens, taken from the vendor's price list. Optional: cost is reported as unknown without them. */
  inputUsdPerMTok?: number;
  outputUsdPerMTok?: number;
  timeoutMs?: number;
  maxOutputTokens?: number;
  /** Sent only when set. Some models reject a temperature parameter. */
  temperature?: number;
  /** openai_compatible only: some models require max_completion_tokens instead of max_tokens. */
  maxTokensField?: 'max_tokens' | 'max_completion_tokens';
  /** openai_compatible only: send response_format {type: "json_object"} (only if the vendor supports it). */
  jsonMode?: boolean;
}

export interface CompletionRequest {
  system: string;
  user: string;
}

export interface CompletionResult {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface LlmProvider {
  readonly config: ProviderConfig;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

export class ProviderError extends Error {
  readonly providerId: string;
  readonly status: number | null;
  constructor(providerId: string, message: string, status: number | null = null) {
    super(`[${providerId}] ${message}`);
    this.name = 'ProviderError';
    this.providerId = providerId;
    this.status = status;
  }
}
