import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FusionConfigError, loadFusionConfig, resolveFusion } from '../src/fusion/config.ts';
import { AnthropicProvider } from '../src/fusion/providers/anthropic.ts';
import { GeminiProvider } from '../src/fusion/providers/gemini.ts';
import { postJson } from '../src/fusion/providers/http.ts';
import { OpenAiCompatibleProvider } from '../src/fusion/providers/openaiCompatible.ts';
import { ProviderError, type FetchLike, type ProviderConfig } from '../src/fusion/providers/types.ts';

interface Captured {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function mockFetch(responses: Array<{ status: number; body: unknown }>, captured: Captured[] = []): FetchLike {
  let i = 0;
  return async (url, init) => {
    captured.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    const r = responses[Math.min(i++, responses.length - 1)] as { status: number; body: unknown };
    return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), { status: r.status });
  };
}

const cfg = (c: Partial<ProviderConfig>): ProviderConfig => ({ id: 't', kind: 'anthropic', model: 'model-x', apiKeyEnv: 'K', euHosted: false, ...c });
const req = { system: 'sys', user: 'hello' };

describe('provider adapters: request shape and response parsing', () => {
  it('Anthropic Messages API', async () => {
    const cap: Captured[] = [];
    const p = new AnthropicProvider(cfg({ temperature: 0 }), 'secret', mockFetch([{ status: 200, body: { content: [{ type: 'text', text: '{"ok":1}' }], usage: { input_tokens: 11, output_tokens: 7 } } }], cap));
    const r = await p.complete(req);
    assert.deepEqual(r, { text: '{"ok":1}', inputTokens: 11, outputTokens: 7 });
    assert.equal(cap[0]?.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(cap[0]?.headers['x-api-key'], 'secret');
    assert.equal(cap[0]?.headers['anthropic-version'], '2023-06-01');
    assert.equal(cap[0]?.body.system, 'sys');
    assert.equal(cap[0]?.body.temperature, 0);
    assert.deepEqual(cap[0]?.body.messages, [{ role: 'user', content: 'hello' }]);
  });

  it('omits temperature when not configured', async () => {
    const cap: Captured[] = [];
    const p = new AnthropicProvider(cfg({}), 'k', mockFetch([{ status: 200, body: { content: [], usage: {} } }], cap));
    const r = await p.complete(req);
    assert.equal('temperature' in (cap[0]?.body ?? {}), false);
    assert.deepEqual(r, { text: '', inputTokens: null, outputTokens: null });
  });

  it('OpenAI-compatible chat completions', async () => {
    const cap: Captured[] = [];
    const p = new OpenAiCompatibleProvider(
      cfg({ kind: 'openai_compatible', baseUrl: 'https://api.example.eu/v1/', jsonMode: true, maxTokensField: 'max_completion_tokens', maxOutputTokens: 100 }),
      'secret',
      mockFetch([{ status: 200, body: { choices: [{ message: { content: 'hi' } }], usage: { prompt_tokens: 5, completion_tokens: 2 } } }], cap),
    );
    assert.deepEqual(await p.complete(req), { text: 'hi', inputTokens: 5, outputTokens: 2 });
    assert.equal(cap[0]?.url, 'https://api.example.eu/v1/chat/completions');
    assert.equal(cap[0]?.headers.authorization, 'Bearer secret');
    assert.equal(cap[0]?.body.max_completion_tokens, 100);
    assert.deepEqual(cap[0]?.body.response_format, { type: 'json_object' });
    assert.deepEqual(cap[0]?.body.messages, [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hello' },
    ]);
  });

  it('OpenAI-compatible requires a base URL', () => {
    assert.throws(() => new OpenAiCompatibleProvider(cfg({ kind: 'openai_compatible' }), 'k', mockFetch([])), ProviderError);
  });

  it('Gemini generateContent', async () => {
    const cap: Captured[] = [];
    const p = new GeminiProvider(
      cfg({ kind: 'gemini', model: 'gem/x' }),
      'secret',
      mockFetch([{ status: 200, body: { candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4 } } }], cap),
    );
    assert.deepEqual(await p.complete(req), { text: 'ab', inputTokens: 3, outputTokens: 4 });
    assert.equal(cap[0]?.url, 'https://generativelanguage.googleapis.com/v1beta/models/gem%2Fx:generateContent');
    assert.equal(cap[0]?.headers['x-goog-api-key'], 'secret');
    assert.deepEqual(cap[0]?.body.systemInstruction, { parts: [{ text: 'sys' }] });
  });

  it('Gemini reports a block reason when there is no candidate content', async () => {
    const p = new GeminiProvider(cfg({ kind: 'gemini' }), 'k', mockFetch([{ status: 200, body: { promptFeedback: { blockReason: 'SAFETY' } } }]));
    await assert.rejects(p.complete(req), /SAFETY/);
  });
});

describe('postJson: retries and errors', () => {
  const base = { providerId: 'p', url: 'https://x', headers: { 'x-api-key': 'super-secret' }, body: {}, timeoutMs: 1000, sleep: async () => {} };

  it('retries once on 429 and then succeeds', async () => {
    const cap: Captured[] = [];
    const r = await postJson({ ...base, fetchImpl: mockFetch([{ status: 429, body: 'slow down' }, { status: 200, body: { ok: true } }], cap) });
    assert.deepEqual(r, { ok: true });
    assert.equal(cap.length, 2);
  });

  it('does not retry on 400 and never leaks the key in the error', async () => {
    const cap: Captured[] = [];
    await assert.rejects(postJson({ ...base, fetchImpl: mockFetch([{ status: 400, body: 'bad request' }], cap) }), (err: unknown) => {
      assert.ok(err instanceof ProviderError);
      assert.equal(err.status, 400);
      assert.ok(!err.message.includes('super-secret'));
      return true;
    });
    assert.equal(cap.length, 1);
  });

  it('gives up after the retry budget on repeated 503', async () => {
    const cap: Captured[] = [];
    await assert.rejects(postJson({ ...base, fetchImpl: mockFetch([{ status: 503, body: 'down' }], cap) }), /HTTP 503/);
    assert.equal(cap.length, 2);
  });

  it('times out a hanging request', async () => {
    const hanging: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      });
    await assert.rejects(postJson({ ...base, timeoutMs: 20, retries: 0, fetchImpl: hanging }), /timeout after 20 ms/);
  });

  it('rejects a non-JSON success response', async () => {
    await assert.rejects(postJson({ ...base, fetchImpl: mockFetch([{ status: 200, body: '<html>' }]) }), /not JSON/);
  });
});

describe('fusion config', () => {
  const provider = { id: 'a', kind: 'anthropic', model: 'm', apiKeyEnv: 'A_KEY', euHosted: false };

  it('returns null when no config is provided', () => {
    assert.equal(loadFusionConfig({}), null);
  });

  it('validates the config and refuses an API key pasted into apiKeyEnv', () => {
    assert.throws(() => loadFusionConfig({ FUSION_CONFIG_JSON: JSON.stringify({ providers: [{ ...provider, apiKeyEnv: 'sk-live-123' }] }) }), FusionConfigError);
    assert.throws(() => loadFusionConfig({ FUSION_CONFIG_JSON: JSON.stringify({ providers: [{ ...provider, kind: 'openai_compatible' }] }) }), /baseUrl/);
    assert.throws(() => loadFusionConfig({ FUSION_CONFIG_JSON: JSON.stringify({ providers: [provider, provider] }) }), /duplicated/);
    assert.throws(() => loadFusionConfig({ FUSION_CONFIG_JSON: JSON.stringify({ providers: [], agreementThreshold: 0.3 }) }), /agreementThreshold/);
  });

  it('skips providers without a key and non-EU providers when EU hosting is required', () => {
    const config = loadFusionConfig({
      FUSION_CONFIG_JSON: JSON.stringify({
        requireEuHosting: true,
        providers: [provider, { ...provider, id: 'eu', apiKeyEnv: 'EU_KEY', euHosted: true }, { ...provider, id: 'eu2', apiKeyEnv: 'MISSING', euHosted: true }],
      }),
    });
    assert.ok(config);
    const r = resolveFusion(config, { A_KEY: 'x', EU_KEY: 'y' }, mockFetch([]));
    assert.deepEqual(r.providers.map((p) => p.config.id), ['eu']);
    assert.deepEqual(r.skipped.map((s) => s.id), ['a', 'eu2']);
    assert.equal(r.agreementThreshold, 0.75);
    assert.equal(r.minSuccessfulProviders, 2);
  });
});
