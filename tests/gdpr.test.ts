import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assessGdpr } from '../src/engines/gdpr.ts';
import type { GdprProfile } from '../src/questionnaire/types.ts';
import { ids, profile } from './helpers.ts';

const gdpr = (g: Partial<GdprProfile> = {}): GdprProfile => ({
  processesPersonalData: true,
  role: 'controller',
  dataSubjectsInEu: true,
  ...g,
});

describe('GDPR: scope', () => {
  it('is not applicable without a GDPR section or without personal data', () => {
    assert.equal(assessGdpr(profile()).applicable, false);
    assert.equal(assessGdpr(profile({ gdpr: gdpr({ processesPersonalData: false }) })).applicable, false);
  });

  it('is not applicable to a non-EU company with no data subjects in the EU', () => {
    const r = assessGdpr(
      profile({ company: { name: 'X', country: 'US', establishedInEu: false, employees: 5 }, gdpr: gdpr({ dataSubjectsInEu: false }) }),
    );
    assert.equal(r.applicable, false);
  });

  it('never produces duplicate finding ids', () => {
    const r = assessGdpr(
      profile({
        gdpr: gdpr({
          role: 'controller_and_processor',
          isPublicAuthority: true,
          processing: { usesProcessors: true, usesSubProcessors: true, transfersOutsideEea: true, specialCategoryData: true, largeScale: true },
        }),
      }),
    );
    const all = r.findings.map((f) => f.id);
    assert.equal(new Set(all).size, all.length);
  });
});

describe('GDPR: controller obligations', () => {
  it('always includes the core accountability requirements', () => {
    const found = ids(assessGdpr(profile({ gdpr: gdpr() })).findings);
    for (const id of ['GDPR-ART6-LAWFUL-BASIS', 'GDPR-ART13-NOTICE', 'GDPR-ART15-22-RIGHTS', 'GDPR-ART25-BY-DESIGN', 'GDPR-ART32-SECURITY', 'GDPR-ART33-34-BREACH']) {
      assert.ok(found.includes(id), `missing ${id}`);
    }
  });

  it('applies the Art. 30(5) exemption only to small, occasional, non-sensitive processing', () => {
    const small = assessGdpr(profile({ gdpr: gdpr({ processing: { occasionalOnly: true } }) }));
    assert.ok(!ids(small.findings).includes('GDPR-ART30-ROPA'));

    const sensitive = assessGdpr(profile({ gdpr: gdpr({ processing: { occasionalOnly: true, specialCategoryData: true } }) }));
    assert.ok(ids(sensitive.findings).includes('GDPR-ART30-ROPA'));

    const big = assessGdpr(profile({ company: { name: 'X', country: 'PL', establishedInEu: true, employees: 250 }, gdpr: gdpr({ processing: { occasionalOnly: true } }) }));
    assert.ok(ids(big.findings).includes('GDPR-ART30-ROPA'));
  });

  it('requires a DPIA for each Art. 35(3) trigger and not otherwise', () => {
    assert.ok(!ids(assessGdpr(profile({ gdpr: gdpr() })).findings).includes('GDPR-ART35-DPIA'));
    for (const processing of [
      { automatedDecisionsWithSignificantEffects: true },
      { extensiveProfiling: true },
      { largeScale: true, specialCategoryData: true },
      { largeScale: true, criminalOffenceData: true },
      { largeScale: true, publicAreaMonitoring: true },
    ]) {
      assert.ok(ids(assessGdpr(profile({ gdpr: gdpr({ processing }) })).findings).includes('GDPR-ART35-DPIA'), JSON.stringify(processing));
    }
  });

  it('requires a DPO only in the Art. 37(1) cases', () => {
    assert.ok(!ids(assessGdpr(profile({ gdpr: gdpr({ processing: { largeScale: true } }) })).findings).includes('GDPR-ART37-DPO'));
    assert.ok(ids(assessGdpr(profile({ gdpr: gdpr({ isPublicAuthority: true }) })).findings).includes('GDPR-ART37-DPO'));
    assert.ok(
      ids(assessGdpr(profile({ gdpr: gdpr({ processing: { largeScale: true, systematicMonitoringCoreActivity: true } }) })).findings).includes('GDPR-ART37-DPO'),
    );
  });

  it('adds conditional requirements for special data, ADM, processors, transfers, children and non-EU controllers', () => {
    const r = assessGdpr(
      profile({
        company: { name: 'X', country: 'GB', establishedInEu: false, employees: 20 },
        gdpr: gdpr({
          processing: {
            specialCategoryData: true,
            automatedDecisionsWithSignificantEffects: true,
            usesProcessors: true,
            transfersOutsideEea: true,
            childrenConsentForOnlineServices: true,
          },
        }),
      }),
    );
    const found = ids(r.findings);
    for (const id of ['GDPR-ART9-CONDITION', 'GDPR-ART22-ADM', 'GDPR-ART28-DPA', 'GDPR-CH5-TRANSFERS', 'GDPR-ART8-CHILDREN', 'GDPR-ART27-REPRESENTATIVE']) {
      assert.ok(found.includes(id), `missing ${id}`);
    }
  });
});

describe('GDPR: processor obligations', () => {
  it('applies processor duties and not controller-only duties to a pure processor', () => {
    const found = ids(assessGdpr(profile({ gdpr: gdpr({ role: 'processor', processing: { usesSubProcessors: true } }) })).findings);
    for (const id of ['GDPR-ART28-3-CONTROLLER-CONTRACTS', 'GDPR-ART30-2-ROPA', 'GDPR-ART32-SECURITY', 'GDPR-ART33-2-NOTIFY-CONTROLLER', 'GDPR-ART28-2-SUBPROCESSORS']) {
      assert.ok(found.includes(id), `missing ${id}`);
    }
    assert.ok(!found.includes('GDPR-ART13-NOTICE'));
    assert.ok(!found.includes('GDPR-ART6-LAWFUL-BASIS'));
  });
});
