import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { runAudit } from '../src/engines/runAudit.ts';
import { calculateRevenueSplit } from '../src/partners/revenueSplit.ts';
import { renderMarkdown } from '../src/report/markdown.ts';
import { InMemoryAuditStore } from '../src/store/auditStore.ts';

const load = (name: string): unknown => JSON.parse(readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8'));

describe('example questionnaires', () => {
  it('HR screening SaaS: high-risk system with an invalid Art. 6(3) claim', () => {
    const r = runAudit(load('hr-screening-saas.json'));
    assert.equal(r.overall.verdict, 'critical_issues');
    assert.equal(r.aiAct.classifications.find((c) => c.systemId === 'cv-screener')?.riskClass, 'high_risk');
    assert.equal(r.aiAct.classifications.find((c) => c.systemId === 'support-chatbot')?.riskClass, 'transparency_obligations');
    assert.ok(r.findings.some((f) => f.id === 'GDPR-ART35-DPIA' && f.status === 'gap'));
  });

  it('online shop: minimal risk and no gaps on declared facts', () => {
    const r = runAudit(load('online-shop-minimal-risk.json'));
    assert.equal(r.overall.verdict, 'no_gaps_on_declared_facts');
    assert.equal(r.overall.score, 100);
    assert.equal(r.aiAct.classifications[0]?.riskClass, 'minimal_risk');
  });

  it('workplace emotion monitoring: prohibited practice', () => {
    const r = runAudit(load('workplace-emotion-monitoring.json'));
    assert.equal(r.aiAct.classifications[0]?.riskClass, 'prohibited');
    assert.equal(r.findings[0]?.id, 'AIA-ART5-emotionRecognitionAtWorkOrEducation', 'critical gaps are listed first');
  });

  it('is deterministic for the same input, id and time', () => {
    const opts = { auditId: 'fixed', now: new Date('2026-01-01T00:00:00Z') };
    assert.deepEqual(runAudit(load('hr-screening-saas.json'), opts), runAudit(load('hr-screening-saas.json'), opts));
  });

  it('renders every actionable finding in the Markdown report', () => {
    const r = runAudit(load('hr-screening-saas.json'));
    const md = renderMarkdown(r);
    const actionable = r.findings.filter((f) => f.status !== 'met').length;
    const rows = md.split('\n').filter((l) => /^\| \d+ \|/.test(l)).length;
    assert.equal(rows, actionable);
    assert.match(md, /not legal advice/);
  });
});

describe('audit store', () => {
  it('evicts the oldest report beyond the limit', () => {
    const store = new InMemoryAuditStore(2);
    for (const id of ['a', 'b', 'c']) store.save(runAudit(load('online-shop-minimal-risk.json'), { auditId: id }));
    assert.equal(store.size(), 2);
    assert.equal(store.get('a'), undefined);
    assert.ok(store.get('c'));
  });
});

describe('partner revenue split', () => {
  it('computes a 15% fee split 50/50 by default', () => {
    assert.deepEqual(calculateRevenueSplit({ revenue: 10_000 }), { revenue: 10_000, successFee: 1500, partnerEarnings: 750, arvenEarnings: 750 });
  });

  it('keeps shares summing exactly to the fee with odd cents', () => {
    const r = calculateRevenueSplit({ revenue: 0.33, feeRate: 1, partnerShare: 0.5 });
    assert.equal(Math.round((r.partnerEarnings + r.arvenEarnings) * 100), Math.round(r.successFee * 100));
  });

  it('rejects invalid inputs', () => {
    assert.throws(() => calculateRevenueSplit({ revenue: -1 }), RangeError);
    assert.throws(() => calculateRevenueSplit({ revenue: 1, feeRate: 2 }), RangeError);
    assert.throws(() => calculateRevenueSplit({ revenue: 1, partnerShare: Number.NaN }), RangeError);
  });
});
