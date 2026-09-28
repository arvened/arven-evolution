import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { ARTICLE_13_CHECKLIST } from '../src/fusion/privacyNotice.ts';
import type { ResolvedFusion } from '../src/fusion/config.ts';
import type { LlmProvider } from '../src/fusion/providers/types.ts';
import { createApp, type AppOptions } from '../src/server/app.ts';
import { InMemoryAuditStore } from '../src/store/auditStore.ts';

const example = readFileSync(new URL('../examples/hr-screening-saas.json', import.meta.url), 'utf8');
const notice = readFileSync(new URL('../examples/privacy-notice-sample.txt', import.meta.url), 'utf8');

async function start(opts: Partial<AppOptions> = {}) {
  const server = createApp({ store: new InMemoryAuditStore(), fusion: null, ...opts });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}` };
}

const json = { 'content-type': 'application/json' };

describe('HTTP API', () => {
  let ctx: Awaited<ReturnType<typeof start>>;
  before(async () => {
    ctx = await start();
  });
  after(() => ctx.server.close());

  it('GET /health', async () => {
    const res = await fetch(`${ctx.url}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok', documentReview: false });
  });

  it('POST /api/audits runs an audit, then GET returns JSON and Markdown', async () => {
    const created = await fetch(`${ctx.url}/api/audits`, { method: 'POST', headers: json, body: example });
    assert.equal(created.status, 201);
    const report = (await created.json()) as { auditId: string; overall: { verdict: string } };
    assert.equal(report.overall.verdict, 'critical_issues');

    const got = await fetch(`${ctx.url}/api/audits/${report.auditId}`);
    assert.equal(got.status, 200);
    assert.equal(((await got.json()) as { auditId: string }).auditId, report.auditId);

    const md = await fetch(`${ctx.url}/api/audits/${report.auditId}/report.md`);
    assert.equal(md.status, 200);
    assert.match(md.headers.get('content-type') ?? '', /text\/markdown/);
    assert.match(await md.text(), /# Compliance self-assessment/);
  });

  it('returns 422 with the list of issues for an invalid questionnaire', async () => {
    const res = await fetch(`${ctx.url}/api/audits`, { method: 'POST', headers: json, body: JSON.stringify({ company: {} }) });
    assert.equal(res.status, 422);
    const body = (await res.json()) as { issues: string[] };
    assert.ok(body.issues.length > 0);
  });

  it('returns 400 for malformed JSON and 415 for a wrong content type', async () => {
    assert.equal((await fetch(`${ctx.url}/api/audits`, { method: 'POST', headers: json, body: '{nope' })).status, 400);
    assert.equal((await fetch(`${ctx.url}/api/audits`, { method: 'POST', body: example })).status, 415);
  });

  it('returns 404 for unknown audits and routes', async () => {
    assert.equal((await fetch(`${ctx.url}/api/audits/does-not-exist`)).status, 404);
    assert.equal((await fetch(`${ctx.url}/nope`)).status, 404);
  });

  it('returns 503 for document review when it is not configured', async () => {
    const res = await fetch(`${ctx.url}/api/reviews/privacy-notice`, { method: 'POST', headers: json, body: JSON.stringify({ text: notice }) });
    assert.equal(res.status, 503);
  });
});

describe('HTTP API: API key and document review', () => {
  let ctx: Awaited<ReturnType<typeof start>>;
  const replyText = JSON.stringify({ items: ARTICLE_13_CHECKLIST.map((i) => ({ id: i.id, status: 'absent', evidence: null })) });
  const provider = (id: string): LlmProvider => ({
    config: { id, kind: 'anthropic', model: 'm', apiKeyEnv: 'K', euHosted: true },
    complete: async () => ({ text: replyText, inputTokens: 1, outputTokens: 1 }),
  });
  const fusion: ResolvedFusion = { providers: [provider('a'), provider('b')], skipped: [], agreementThreshold: 0.75, minSuccessfulProviders: 2 };

  before(async () => {
    ctx = await start({ apiKey: 'test-key', fusion });
  });
  after(() => ctx.server.close());

  it('rejects /api requests without the key but keeps /health open', async () => {
    assert.equal((await fetch(`${ctx.url}/health`)).status, 200);
    assert.equal((await fetch(`${ctx.url}/api/audits`, { method: 'POST', headers: json, body: example })).status, 401);
    assert.equal(
      (await fetch(`${ctx.url}/api/audits`, { method: 'POST', headers: { ...json, authorization: 'Bearer wrong' }, body: example })).status,
      401,
    );
  });

  it('runs a document review with the key', async () => {
    const res = await fetch(`${ctx.url}/api/reviews/privacy-notice`, {
      method: 'POST',
      headers: { ...json, authorization: 'Bearer test-key' },
      body: JSON.stringify({ text: notice }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { items: { consensus: string }[] };
    assert.equal(body.items.length, ARTICLE_13_CHECKLIST.length);
    assert.ok(body.items.every((i) => i.consensus === 'absent'));
  });

  it('returns 400 when the review body has no text', async () => {
    const res = await fetch(`${ctx.url}/api/reviews/privacy-notice`, {
      method: 'POST',
      headers: { ...json, authorization: 'Bearer test-key' },
      body: JSON.stringify({ notice: 'x' }),
    });
    assert.equal(res.status, 400);
  });
});
