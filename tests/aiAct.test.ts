import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assessAiAct } from '../src/engines/aiAct.ts';
import { ids, profile, system } from './helpers.ts';

const HIGH_RISK_PROVIDER_IDS = [
  'AIA-ART9-RISK-MGMT',
  'AIA-ART10-DATA-GOV',
  'AIA-ART11-TECH-DOC',
  'AIA-ART12-LOGGING',
  'AIA-ART13-INSTRUCTIONS',
  'AIA-ART14-OVERSIGHT',
  'AIA-ART15-ACCURACY',
  'AIA-ART17-QMS',
  'AIA-ART43-CONFORMITY',
  'AIA-ART47-DOC',
  'AIA-ART48-CE',
  'AIA-ART72-PMM',
  'AIA-ART73-INCIDENTS',
];

describe('AI Act: scope', () => {
  it('marks a system without EU nexus as out of scope and adds no findings', () => {
    const r = assessAiAct(profile({ aiSystems: [system({ euNexus: false, annexIIIAreas: ['employment'] })] }));
    assert.equal(r.applicable, false);
    assert.equal(r.classifications[0]?.riskClass, 'out_of_scope');
    assert.equal(r.findings.length, 0);
  });

  it('adds the Art. 4 AI literacy requirement once when at least one system is in scope', () => {
    const r = assessAiAct(profile({ aiLiteracyProgramme: true, aiSystems: [system({ id: 'a' }), system({ id: 'b' })] }));
    const literacy = r.findings.filter((f) => f.id === 'AIA-ART4-LITERACY');
    assert.equal(literacy.length, 1);
    assert.equal(literacy[0]?.status, 'met');
  });

  it('classifies a system with no triggers as minimal risk', () => {
    const r = assessAiAct(profile({ aiSystems: [system()] }));
    assert.equal(r.classifications[0]?.riskClass, 'minimal_risk');
    assert.deepEqual(ids(r.findings), ['AIA-ART4-LITERACY']);
  });
});

describe('AI Act: prohibited practices (Art. 5)', () => {
  it('flags each declared practice as a critical gap and stops further assessment of that system', () => {
    const r = assessAiAct(
      profile({
        aiSystems: [system({ prohibitedPractices: { socialScoring: true, untargetedFacialImageScraping: true }, annexIIIAreas: ['employment'] })],
      }),
    );
    assert.equal(r.classifications[0]?.riskClass, 'prohibited');
    const art5 = r.findings.filter((f) => f.id.startsWith('AIA-ART5-'));
    assert.equal(art5.length, 2);
    assert.ok(art5.every((f) => f.status === 'gap' && f.severity === 'critical'));
    assert.ok(!r.findings.some((f) => f.id === 'AIA-ART9-RISK-MGMT'), 'high-risk duties are not listed for a prohibited system');
  });

  it('ignores practices declared as false', () => {
    const r = assessAiAct(profile({ aiSystems: [system({ prohibitedPractices: { socialScoring: false } })] }));
    assert.equal(r.classifications[0]?.riskClass, 'minimal_risk');
  });
});

describe('AI Act: high-risk classification (Art. 6)', () => {
  it('applies all provider obligations and EU database registration to an Annex III system', () => {
    const r = assessAiAct(profile({ aiSystems: [system({ annexIIIAreas: ['education'] })] }));
    assert.equal(r.classifications[0]?.riskClass, 'high_risk');
    const found = ids(r.findings);
    for (const id of HIGH_RISK_PROVIDER_IDS) assert.ok(found.includes(id), `missing ${id}`);
    assert.ok(found.includes('AIA-ART49-1-REGISTRATION'));
    assert.ok(!found.includes('AIA-ART22-AUTH-REP'), 'EU-established provider needs no authorised representative');
  });

  it('treats an Annex I product safety component as high-risk without Annex III registration', () => {
    const r = assessAiAct(profile({ aiSystems: [system({ annexIProductSafetyComponent: true })] }));
    assert.equal(r.classifications[0]?.riskClass, 'high_risk');
    assert.ok(!ids(r.findings).includes('AIA-ART49-1-REGISTRATION'));
  });

  it('accepts the Art. 6(3) exemption without profiling and requires documentation and registration instead', () => {
    const r = assessAiAct(
      profile({
        aiSystems: [system({ annexIIIAreas: ['employment'], claimsArticle6_3Exemption: true, performsProfiling: false, controls: { article6_3AssessmentDocumented: true } })],
      }),
    );
    assert.notEqual(r.classifications[0]?.riskClass, 'high_risk');
    const found = ids(r.findings);
    assert.ok(found.includes('AIA-ART6-4-DOCUMENTATION'));
    assert.ok(found.includes('AIA-ART49-2-REGISTRATION'));
    assert.ok(!found.includes('AIA-ART9-RISK-MGMT'));
    assert.equal(r.findings.find((f) => f.id === 'AIA-ART6-4-DOCUMENTATION')?.status, 'met');
  });

  it('rejects the Art. 6(3) exemption when the system profiles people', () => {
    const r = assessAiAct(
      profile({ aiSystems: [system({ annexIIIAreas: ['employment'], claimsArticle6_3Exemption: true, performsProfiling: true })] }),
    );
    assert.equal(r.classifications[0]?.riskClass, 'high_risk');
    const f = r.findings.find((x) => x.id === 'AIA-ART6-3-PROFILING');
    assert.equal(f?.status, 'gap');
    assert.equal(f?.severity, 'critical');
    assert.ok(ids(r.findings).includes('AIA-ART9-RISK-MGMT'));
  });

  it('requires an authorised representative for a non-EU provider of a high-risk system', () => {
    const r = assessAiAct(
      profile({
        company: { name: 'X', country: 'US', establishedInEu: false, employees: 5 },
        aiSystems: [system({ annexIIIAreas: ['employment'] })],
      }),
    );
    assert.ok(ids(r.findings).includes('AIA-ART22-AUTH-REP'));
  });

  it('maps declared controls to met / gap / unknown', () => {
    const r = assessAiAct(
      profile({ aiSystems: [system({ annexIIIAreas: ['employment'], controls: { riskManagementSystem: true, dataGovernance: false } })] }),
    );
    const status = (id: string) => r.findings.find((f) => f.id === id)?.status;
    assert.equal(status('AIA-ART9-RISK-MGMT'), 'met');
    assert.equal(status('AIA-ART10-DATA-GOV'), 'gap');
    assert.equal(status('AIA-ART11-TECH-DOC'), 'unknown');
  });
});

describe('AI Act: deployer obligations (Art. 26, 27)', () => {
  it('applies Art. 26 duties, workplace information and FRIA for creditworthiness scoring', () => {
    const r = assessAiAct(
      profile({
        aiSystems: [
          system({ role: 'deployer', annexIIIAreas: ['essential_services_creditworthiness'], usedInWorkplace: true, makesOrAssistsDecisionsAboutPersons: true }),
        ],
      }),
    );
    const found = ids(r.findings);
    for (const id of ['AIA-ART26-1-INSTRUCTIONS', 'AIA-ART26-2-OVERSIGHT', 'AIA-ART26-6-LOGS', 'AIA-ART26-7-WORKERS', 'AIA-ART26-11-PERSONS', 'AIA-ART27-FRIA']) {
      assert.ok(found.includes(id), `missing ${id}`);
    }
    assert.ok(!found.includes('AIA-ART9-RISK-MGMT'), 'provider duties do not apply to a pure deployer');
  });

  it('does not require a FRIA from a private deployer outside Annex III(5)(b)/(c)', () => {
    const r = assessAiAct(profile({ aiSystems: [system({ role: 'deployer', annexIIIAreas: ['employment'] })] }));
    assert.ok(!ids(r.findings).includes('AIA-ART27-FRIA'));
  });

  it('requires a FRIA from a public body, except for critical infrastructure only', () => {
    const pub = assessAiAct(profile({ aiSystems: [system({ role: 'deployer', annexIIIAreas: ['education'], deployerIsPublicBodyOrPublicService: true })] }));
    assert.ok(ids(pub.findings).includes('AIA-ART27-FRIA'));
    const infra = assessAiAct(profile({ aiSystems: [system({ role: 'deployer', annexIIIAreas: ['critical_infrastructure'], deployerIsPublicBodyOrPublicService: true })] }));
    assert.ok(!ids(infra.findings).includes('AIA-ART27-FRIA'));
  });
});

describe('AI Act: transparency (Art. 50)', () => {
  it('applies provider and deployer transparency duties by role', () => {
    const r = assessAiAct(
      profile({
        aiSystems: [
          system({
            role: 'provider_and_deployer',
            interactsDirectlyWithPersons: true,
            generatesSyntheticContent: true,
            producesDeepfakes: true,
            usesEmotionRecognitionOrBiometricCategorisation: true,
            publishesAiTextOnPublicInterestMatters: true,
          }),
        ],
      }),
    );
    assert.equal(r.classifications[0]?.riskClass, 'transparency_obligations');
    const found = ids(r.findings);
    for (const id of ['AIA-ART50-1-INTERACTION', 'AIA-ART50-2-MARKING', 'AIA-ART50-3-EMOTION', 'AIA-ART50-4-DEEPFAKE', 'AIA-ART50-4-TEXT']) {
      assert.ok(found.includes(id), `missing ${id}`);
    }
  });

  it('does not apply provider-only duties to a pure deployer', () => {
    const r = assessAiAct(profile({ aiSystems: [system({ role: 'deployer', interactsDirectlyWithPersons: true, generatesSyntheticContent: true })] }));
    assert.equal(r.classifications[0]?.riskClass, 'minimal_risk');
  });

  it('exempts public-interest text under human editorial responsibility', () => {
    const r = assessAiAct(
      profile({ aiSystems: [system({ role: 'deployer', publishesAiTextOnPublicInterestMatters: true, aiTextUnderHumanEditorialResponsibility: true })] }),
    );
    assert.ok(!ids(r.findings).includes('AIA-ART50-4-TEXT'));
  });
});

describe('AI Act: general-purpose AI models (Art. 53-55)', () => {
  it('applies Art. 53 duties, Art. 55 for systemic risk and Art. 54 for non-EU providers', () => {
    const r = assessAiAct(
      profile({
        company: { name: 'X', country: 'US', establishedInEu: false, employees: 500 },
        aiSystems: [system({ isGeneralPurposeAiModel: true, gpaiModelWithSystemicRisk: true })],
      }),
    );
    const found = ids(r.findings);
    for (const id of ['AIA-ART53-1A-TECHDOC', 'AIA-ART53-1B-DOWNSTREAM', 'AIA-ART53-1C-COPYRIGHT', 'AIA-ART53-1D-SUMMARY', 'AIA-ART55-SYSTEMIC', 'AIA-ART54-AUTH-REP']) {
      assert.ok(found.includes(id), `missing ${id}`);
    }
    assert.equal(r.classifications[0]?.isGpaiModel, true);
  });
});
