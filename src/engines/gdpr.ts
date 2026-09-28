import type { Finding, Severity } from '../domain/types.ts';
import type { CompanyProfile, GdprProfile } from '../questionnaire/types.ts';
import { requirement } from './common.ts';

/**
 * Rule engine for Regulation (EU) 2016/679 (GDPR).
 *
 * Covers the core accountability obligations that can be checked from declared facts.
 * It does not evaluate whether a chosen lawful basis is valid, whether a DPIA is of good
 * quality, or national derogations (for example the age threshold under Art. 8).
 */

const REG = 'Regulation (EU) 2016/679';

interface Rule {
  id: string;
  article: string;
  requirement: string;
  appliesBecause: string;
  severity: Severity;
  recommendation: string;
  control: boolean | undefined;
}

export interface GdprResult {
  applicable: boolean;
  findings: Finding[];
}

function controllerRules(company: CompanyProfile['company'], g: GdprProfile): Rule[] {
  const p = g.processing ?? {};
  const c = g.controls ?? {};
  const rules: Rule[] = [];
  const why = 'The company acts as a controller of personal data.';

  rules.push({ id: 'GDPR-ART6-LAWFUL-BASIS', article: 'Art. 5(2) and Art. 6', requirement: 'Lawful basis identified and documented for each processing purpose', appliesBecause: why, severity: 'high', recommendation: 'Map every processing purpose to one of the Art. 6(1) bases and record the reasoning.', control: c.lawfulBasisDocumented });

  if (p.specialCategoryData === true) {
    rules.push({ id: 'GDPR-ART9-CONDITION', article: 'Art. 9(2)', requirement: 'Condition for processing special category data identified and documented', appliesBecause: 'Special category data is processed.', severity: 'high', recommendation: 'Identify the Art. 9(2) condition (for example explicit consent) in addition to the Art. 6 basis.', control: c.specialCategoryConditionDocumented });
  }

  rules.push({ id: 'GDPR-ART13-NOTICE', article: 'Art. 12, 13 and 14', requirement: 'Privacy information provided to data subjects in a concise, transparent form', appliesBecause: why, severity: 'high', recommendation: 'Publish a privacy notice containing every element of Art. 13 (and Art. 14 when data is obtained from third parties).', control: c.privacyNoticePublished });
  rules.push({ id: 'GDPR-ART15-22-RIGHTS', article: 'Art. 12 and 15-21', requirement: 'Procedure to handle data subject requests within one month', appliesBecause: why, severity: 'high', recommendation: 'Set up an intake channel, identity verification and a tracked process for access, rectification, erasure, restriction, portability and objection requests.', control: c.dataSubjectRightsProcedure });

  if (p.automatedDecisionsWithSignificantEffects === true) {
    rules.push({ id: 'GDPR-ART22-ADM', article: 'Art. 22', requirement: 'Safeguards for solely automated decisions with legal or similarly significant effects', appliesBecause: 'Solely automated decisions with significant effects are made.', severity: 'high', recommendation: 'Confirm an Art. 22(2) ground applies and provide human intervention, the right to contest and meaningful information about the logic involved.', control: c.automatedDecisionSafeguards });
  }

  rules.push({ id: 'GDPR-ART25-BY-DESIGN', article: 'Art. 25', requirement: 'Data protection by design and by default', appliesBecause: why, severity: 'medium', recommendation: 'Build data minimisation, pseudonymisation and privacy-friendly defaults into systems and processes.', control: c.privacyByDesignAndDefault });

  if (p.usesProcessors === true) {
    rules.push({ id: 'GDPR-ART28-DPA', article: 'Art. 28(3)', requirement: 'Written data processing agreements with every processor', appliesBecause: 'Processors process personal data on behalf of the company.', severity: 'high', recommendation: 'Sign agreements containing all Art. 28(3) clauses with each processor, including cloud and AI vendors.', control: c.processorAgreements });
  }

  const ropaExempt =
    company.employees < 250 && p.occasionalOnly === true && p.specialCategoryData !== true && p.criminalOffenceData !== true;
  if (!ropaExempt) {
    rules.push({ id: 'GDPR-ART30-ROPA', article: 'Art. 30(1)', requirement: 'Records of processing activities maintained', appliesBecause: company.employees >= 250 ? 'The company has 250 or more employees.' : 'The Art. 30(5) exemption does not apply (processing is not only occasional, or involves special category or criminal data).', severity: 'medium', recommendation: 'Maintain a record of processing activities with the content required by Art. 30(1).', control: c.recordsOfProcessing });
  }

  rules.push({ id: 'GDPR-ART32-SECURITY', article: 'Art. 32', requirement: 'Appropriate technical and organisational security measures', appliesBecause: why, severity: 'high', recommendation: 'Document a risk-based security programme: access control, encryption, backups, testing of measures.', control: c.securityMeasures });
  rules.push({ id: 'GDPR-ART33-34-BREACH', article: 'Art. 33 and 34', requirement: 'Breach procedure: notify the supervisory authority within 72 hours and data subjects when the risk is high', appliesBecause: why, severity: 'high', recommendation: 'Write and test a breach response procedure, including a breach register.', control: c.breachNotificationProcedure });

  const dpiaTriggers: string[] = [];
  if (p.automatedDecisionsWithSignificantEffects === true || p.extensiveProfiling === true) dpiaTriggers.push('systematic and extensive evaluation of personal aspects (Art. 35(3)(a))');
  if (p.largeScale === true && (p.specialCategoryData === true || p.criminalOffenceData === true)) dpiaTriggers.push('large-scale processing of special category or criminal data (Art. 35(3)(b))');
  if (p.publicAreaMonitoring === true && p.largeScale === true) dpiaTriggers.push('large-scale systematic monitoring of a publicly accessible area (Art. 35(3)(c))');
  if (dpiaTriggers.length > 0) {
    rules.push({ id: 'GDPR-ART35-DPIA', article: 'Art. 35', requirement: 'Data protection impact assessment carried out before processing', appliesBecause: `DPIA trigger: ${dpiaTriggers.join('; ')}.`, severity: 'high', recommendation: 'Carry out a DPIA; consult the supervisory authority under Art. 36 if high residual risk remains.', control: c.dpiaCompleted });
  }

  if (p.childrenConsentForOnlineServices === true) {
    rules.push({ id: 'GDPR-ART8-CHILDREN', article: 'Art. 8', requirement: 'Parental consent obtained and verified for children below the national age threshold (13-16)', appliesBecause: 'Information society services are offered directly to children on the basis of consent.', severity: 'high', recommendation: 'Implement age assurance and parental consent verification per the applicable national threshold.', control: c.parentalConsentMechanism });
  }

  if (!company.establishedInEu && g.dataSubjectsInEu) {
    rules.push({ id: 'GDPR-ART27-REPRESENTATIVE', article: 'Art. 27', requirement: 'Representative designated in the EU', appliesBecause: 'The controller is not established in the EU but processes data of people in the EU.', severity: 'medium', recommendation: 'Designate a representative in a Member State where data subjects are, unless the occasional low-risk exemption of Art. 27(2) applies.', control: c.euRepresentativeAppointed });
  }

  return rules;
}

function processorRules(g: GdprProfile): Rule[] {
  const p = g.processing ?? {};
  const c = g.controls ?? {};
  const why = 'The company acts as a processor on behalf of controllers.';
  const rules: Rule[] = [
    { id: 'GDPR-ART28-3-CONTROLLER-CONTRACTS', article: 'Art. 28(3)', requirement: 'Processing governed by a contract with each controller', appliesBecause: why, severity: 'high', recommendation: 'Sign data processing agreements with every client and process data only on documented instructions.', control: c.controllerContracts },
    { id: 'GDPR-ART30-2-ROPA', article: 'Art. 30(2)', requirement: 'Records of processing activities carried out on behalf of controllers', appliesBecause: why, severity: 'medium', recommendation: 'Maintain a processor record listing controllers, categories of processing and transfers.', control: c.recordsOfProcessing },
    { id: 'GDPR-ART32-SECURITY', article: 'Art. 32', requirement: 'Appropriate technical and organisational security measures', appliesBecause: why, severity: 'high', recommendation: 'Document a risk-based security programme and make it auditable by controllers.', control: c.securityMeasures },
    { id: 'GDPR-ART33-2-NOTIFY-CONTROLLER', article: 'Art. 33(2)', requirement: 'Controller notified without undue delay after becoming aware of a breach', appliesBecause: why, severity: 'high', recommendation: 'Include breach escalation to each controller in the incident response procedure.', control: c.breachNotificationToController },
  ];
  if (p.usesSubProcessors === true) {
    rules.push({ id: 'GDPR-ART28-2-SUBPROCESSORS', article: 'Art. 28(2) and 28(4)', requirement: 'Sub-processors engaged only with controller authorisation and equivalent contractual terms', appliesBecause: 'Sub-processors are used.', severity: 'high', recommendation: 'Obtain prior authorisation, keep a sub-processor list and flow down Art. 28 obligations.', control: c.subProcessorAuthorisation });
  }
  return rules;
}

function sharedRules(g: GdprProfile): Rule[] {
  const p = g.processing ?? {};
  const c = g.controls ?? {};
  const rules: Rule[] = [];

  const dpoReasons: string[] = [];
  if (g.isPublicAuthority === true) dpoReasons.push('public authority or body (Art. 37(1)(a))');
  if (p.systematicMonitoringCoreActivity === true && p.largeScale === true) dpoReasons.push('large-scale regular and systematic monitoring as a core activity (Art. 37(1)(b))');
  if (p.largeScale === true && (p.specialCategoryData === true || p.criminalOffenceData === true)) dpoReasons.push('large-scale special category or criminal data as a core activity (Art. 37(1)(c))');
  if (dpoReasons.length > 0) {
    rules.push({ id: 'GDPR-ART37-DPO', article: 'Art. 37', requirement: 'Data protection officer designated and contact details published and communicated to the supervisory authority', appliesBecause: `DPO required: ${dpoReasons.join('; ')}.`, severity: 'high', recommendation: 'Designate a DPO with expert knowledge, publish contact details and notify the supervisory authority.', control: c.dpoAppointed });
  }

  if (p.transfersOutsideEea === true) {
    rules.push({ id: 'GDPR-CH5-TRANSFERS', article: 'Chapter V (Art. 44-49)', requirement: 'Transfer mechanism for personal data sent outside the EEA', appliesBecause: 'Personal data is transferred outside the EEA (including to cloud or AI API providers).', severity: 'high', recommendation: 'Rely on an adequacy decision, or use standard contractual clauses with a transfer impact assessment.', control: c.transferMechanism });
  }
  return rules;
}

export function assessGdpr(profile: CompanyProfile): GdprResult {
  const g = profile.gdpr;
  if (!g || !g.processesPersonalData) return { applicable: false, findings: [] };

  // Art. 3: establishment in the EU, or targeting / monitoring people in the EU (simplified).
  const inScope = profile.company.establishedInEu || g.dataSubjectsInEu;
  if (!inScope) return { applicable: false, findings: [] };

  const rules: Rule[] = [];
  if (g.role === 'controller' || g.role === 'controller_and_processor') rules.push(...controllerRules(profile.company, g));
  if (g.role === 'processor' || g.role === 'controller_and_processor') {
    const existing = new Set(rules.map((r) => r.id));
    for (const r of processorRules(g)) if (!existing.has(r.id)) rules.push(r);
  }
  rules.push(...sharedRules(g));

  return {
    applicable: true,
    findings: rules.map((r) =>
      requirement('GDPR', {
        id: r.id,
        reference: `${REG}, ${r.article}`,
        requirement: r.requirement,
        appliesBecause: r.appliesBecause,
        severity: r.severity,
        recommendation: r.recommendation,
        control: r.control,
      }),
    ),
  };
}
