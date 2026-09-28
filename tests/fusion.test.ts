import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { ResolvedFusion } from '../src/fusion/config.ts';
import {
  ARTICLE_13_CHECKLIST,
  consensus,
  extractJson,
  normalise,
  parseVotes,
  reviewPrivacyNotice,
  ReviewError,
  type Vote,
} from '../src/fusion/privacyNotice.ts';
import type { CompletionResult, LlmProvider, ProviderConfig } from '../src/fusion/providers/types.ts';

const NOTICE = readFileSync(new URL('../examples/privacy-notice-sample.txt', import.meta.url), 'utf8');

/** A model reply that answers every checklist item; overrides change individual items. */
function reply(overrides: Record<string, { status: string; evidence?: string | null }> = {}): string {
  return JSON.stringify({
    items: ARTICLE_13_CHECKLIST.map((i) => ({
      id: i.id,
      status: overrides[i.id]?.status ?? 'absent',
      evidence: overrides[i.id]?.evidence ?? null,
      comment: '',
    })),
  });
}

const CONTROLLER_QUOTE = 'Example Home Goods OÜ, Tartu mnt 1, 10111 Tallinn, Estonia, is the controller of your personal data.';

function fakeProvider(id: string, behaviour: () => Promise<CompletionResult>, cfg: Partial<ProviderConfig> = {}): LlmProvider {
  return {
    config: { id, kind: 'anthropic', model: `${id}-model`, apiKeyEnv: 'X', euHosted: false, ...cfg },
    complete: behaviour,
  };
}

const ok = (text: string, inputTokens: number | null = 1000, outputTokens: number | null = 500) => async (): Promise<CompletionResult> => ({
  text,
  inputTokens,
  outputTokens,
});

function fusion(providers: LlmProvider[], extra: Partial<ResolvedFusion> = {}): ResolvedFusion {
  return { providers, skipped: [], agreementThreshold: 0.75, minSuccessfulProviders: 2, ...extra };
}

const vote = (status: Vote['status']): Vote => ({ providerId: 'p', status, evidence: null, evidenceVerified: false, comment: '', downgraded: false });

describe('fusion: parsing model replies', () => {
  it('extracts JSON from code fences and surrounding prose', () => {
    assert.deepEqual(extractJson('Here you go:\n```json\n{"items":[]}\n```\nThanks'), { items: [] });
    assert.deepEqual(extractJson('prefix {"a":{"b":1}} suffix'), { a: { b: 1 } });
    assert.throws(() => extractJson('no json here'));
  });

  it('normalises quotes, dashes, case and whitespace', () => {
    assert.equal(normalise('  The  “Controller” –\nis   HERE '), 'the "controller" - is here');
  });

  it('accepts a "present" vote only when the quote is really in the notice', () => {
    const votes = parseVotes(
      'm',
      reply({
        controller_identity: { status: 'present', evidence: CONTROLLER_QUOTE.toUpperCase() },
        dpo_contact: { status: 'present', evidence: 'Our DPO is Jane Doe, dpo@example.invalid' },
        retention_period: { status: 'present', evidence: null },
      }),
      NOTICE,
    );
    const byId = Object.fromEntries(votes.map((v, i) => [ARTICLE_13_CHECKLIST[i]?.id, v]));
    assert.equal(byId.controller_identity?.status, 'present');
    assert.equal(byId.controller_identity?.evidenceVerified, true);
    assert.equal(byId.dpo_contact?.status, 'unclear', 'invented quote is downgraded');
    assert.equal(byId.dpo_contact?.downgraded, true);
    assert.equal(byId.retention_period?.status, 'unclear', 'present without evidence is downgraded');
  });

  it('treats missing items and invalid statuses as unclear', () => {
    const votes = parseVotes('m', JSON.stringify({ items: [{ id: 'recipients', status: 'maybe' }] }), NOTICE);
    assert.equal(votes.length, ARTICLE_13_CHECKLIST.length);
    assert.ok(votes.every((v) => v.status === 'unclear'));
    assert.match(votes[0]?.comment ?? '', /missing from model reply/);
  });

  it('rejects a reply without an items array', () => {
    assert.throws(() => parseVotes('m', '{"result": "fine"}', NOTICE), /items/);
  });
});

describe('fusion: consensus', () => {
  it('returns the majority when agreement meets the threshold', () => {
    const r = consensus([vote('present'), vote('present'), vote('present'), vote('absent')], 0.75);
    assert.deepEqual(r, { consensus: 'present', majorityStatus: 'present', agreement: 0.75 });
  });

  it('asks for human review below the threshold but still reports the majority', () => {
    const r = consensus([vote('present'), vote('present'), vote('absent')], 0.75);
    assert.equal(r.consensus, 'needs_human_review');
    assert.equal(r.majorityStatus, 'present');
    assert.equal(r.agreement, 0.67);
  });

  it('asks for human review on a tie', () => {
    const r = consensus([vote('present'), vote('absent')], 0.5);
    assert.equal(r.consensus, 'needs_human_review');
    assert.equal(r.majorityStatus, null);
  });
});

describe('fusion: reviewPrivacyNotice', () => {
  const good = reply({ controller_identity: { status: 'present', evidence: CONTROLLER_QUOTE } });

  it('combines several providers, survives one failure and computes cost', async () => {
    const priced = { inputUsdPerMTok: 3, outputUsdPerMTok: 15 };
    const result = await reviewPrivacyNotice(
      NOTICE,
      fusion([
        fakeProvider('a', ok(good), priced),
        fakeProvider('b', ok(good), priced),
        fakeProvider('c', async () => {
          throw new Error('HTTP 500');
        }),
      ]),
    );
    const controller = result.items.find((i) => i.id === 'controller_identity');
    assert.equal(controller?.consensus, 'present');
    assert.equal(controller?.agreement, 1);
    assert.equal(controller?.votes.length, 2);
    assert.equal(result.providers.find((p) => p.providerId === 'c')?.ok, false);
    // (1000 * 3 + 500 * 15) / 1e6 = 0.0105 per provider
    assert.equal(result.providers.find((p) => p.providerId === 'a')?.costUsd, 0.0105);
    assert.equal(result.totalCostUsd, 0.021);
    assert.equal(result.costComplete, false, 'failed provider has unknown cost');
  });

  it('reports cost as unknown when prices are not configured', async () => {
    const result = await reviewPrivacyNotice(NOTICE, fusion([fakeProvider('a', ok(good)), fakeProvider('b', ok(good))]));
    assert.equal(result.totalCostUsd, null);
    assert.equal(result.costComplete, false);
  });

  it('fails when fewer providers than required answer', async () => {
    const failing = async (): Promise<CompletionResult> => {
      throw new Error('down');
    };
    await assert.rejects(
      reviewPrivacyNotice(NOTICE, fusion([fakeProvider('a', ok(good)), fakeProvider('b', failing)])),
      (err: unknown) => err instanceof ReviewError && err.providers.length === 2,
    );
  });

  it('fails before calling any provider when too few are configured', async () => {
    let called = false;
    const p = fakeProvider('a', async () => {
      called = true;
      return { text: good, inputTokens: 1, outputTokens: 1 };
    });
    await assert.rejects(reviewPrivacyNotice(NOTICE, fusion([p], { skipped: [{ id: 'b', reason: 'key missing' }] })), /key missing/);
    assert.equal(called, false);
  });

  it('rejects notices that are too short or too long', async () => {
    const f = fusion([fakeProvider('a', ok(good)), fakeProvider('b', ok(good))]);
    await assert.rejects(reviewPrivacyNotice('too short', f), /too short/);
    await assert.rejects(reviewPrivacyNotice('x'.repeat(60_001), f), /too long/);
  });

  it('marks unparseable replies as failed providers', async () => {
    await assert.rejects(
      reviewPrivacyNotice(NOTICE, fusion([fakeProvider('a', ok(good)), fakeProvider('b', ok('I cannot help with that'))])),
      (err: unknown) => err instanceof ReviewError && err.providers.some((p) => p.providerId === 'b' && !p.ok),
    );
  });
});
