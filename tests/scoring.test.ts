import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Finding } from '../src/domain/types.ts';
import { summarise } from '../src/engines/scoring.ts';

const f = (status: Finding['status'], severity: Finding['severity'], id = `${status}-${severity}-${Math.random()}`): Finding => ({
  id,
  framework: 'GDPR',
  reference: 'x',
  requirement: 'x',
  appliesBecause: 'x',
  status,
  severity,
  recommendation: 'x',
});

describe('scoring', () => {
  it('returns a perfect score and full coverage when nothing applies', () => {
    const s = summarise([]);
    assert.equal(s.score, 100);
    assert.equal(s.answerCoverage, 100);
    assert.equal(s.verdict, 'no_gaps_on_declared_facts');
  });

  it('weights findings by severity (critical 8, high 4, medium 2, low 1)', () => {
    // met: high(4) + low(1) = 5; total: 4 + 1 + 2 + 8 = 15 -> 33.3
    const s = summarise([f('met', 'high'), f('met', 'low'), f('gap', 'medium'), f('unknown', 'critical')]);
    assert.equal(s.score, 33.3);
  });

  it('never counts unknown as met and reports answer coverage', () => {
    const s = summarise([f('met', 'high'), f('unknown', 'high'), f('unknown', 'high'), f('unknown', 'high')]);
    assert.equal(s.score, 25);
    assert.equal(s.answerCoverage, 25);
    assert.equal(s.verdict, 'gaps_found');
  });

  it('returns critical_issues when any critical requirement is a gap', () => {
    const s = summarise([f('met', 'high'), f('gap', 'critical')]);
    assert.equal(s.verdict, 'critical_issues');
    assert.equal(s.gapsBySeverity.critical, 1);
  });

  it('returns no_gaps_on_declared_facts only when everything is met', () => {
    assert.equal(summarise([f('met', 'high'), f('met', 'low')]).verdict, 'no_gaps_on_declared_facts');
  });
});
