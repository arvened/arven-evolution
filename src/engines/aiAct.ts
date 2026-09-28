import type { AiSystemClassification, Finding, Severity } from '../domain/types.ts';
import type { AiSystem, AnnexIIIArea, CompanyProfile, ProhibitedPractices } from '../questionnaire/types.ts';
import { requirement, type RequirementInput } from './common.ts';

/**
 * Rule engine for Regulation (EU) 2024/1689 (Artificial Intelligence Act).
 *
 * Scope of this prototype:
 *   - Art. 2 territorial nexus (simplified to one declared flag)
 *   - Art. 4 AI literacy
 *   - Art. 5 prohibited practices
 *   - Art. 6 high-risk classification (Annex I product route, Annex III areas, Art. 6(3) derogation)
 *   - Provider obligations for high-risk systems (Art. 9-17, 22, 43, 47-49, 72, 73)
 *   - Deployer obligations for high-risk systems (Art. 26, 27)
 *   - Transparency obligations (Art. 50)
 *   - General-purpose AI model obligations (Art. 53-55)
 *
 * Deliberately NOT covered: application dates (they are being amended by the Digital Omnibus
 * package and must be checked against the Official Journal), sector-specific Annex I procedures,
 * national rules, sandboxes, and the detailed content of each obligation.
 */

const REG = 'Regulation (EU) 2024/1689';

const PROHIBITED: Record<keyof ProhibitedPractices, { ref: string; text: string }> = {
  subliminalOrManipulativeTechniques: {
    ref: 'Art. 5(1)(a)',
    text: 'Subliminal, manipulative or deceptive techniques that materially distort behaviour and cause significant harm',
  },
  exploitsVulnerabilities: {
    ref: 'Art. 5(1)(b)',
    text: 'Exploiting vulnerabilities due to age, disability or a specific social or economic situation',
  },
  socialScoring: {
    ref: 'Art. 5(1)(c)',
    text: 'Social scoring leading to detrimental or unfavourable treatment',
  },
  crimePredictionBasedSolelyOnProfiling: {
    ref: 'Art. 5(1)(d)',
    text: 'Assessing the risk of a person committing a criminal offence based solely on profiling or personality traits',
  },
  untargetedFacialImageScraping: {
    ref: 'Art. 5(1)(e)',
    text: 'Creating or expanding facial recognition databases through untargeted scraping of facial images',
  },
  emotionRecognitionAtWorkOrEducation: {
    ref: 'Art. 5(1)(f)',
    text: 'Inferring emotions in the workplace or in education institutions (outside medical or safety reasons)',
  },
  biometricCategorisationOfSensitiveTraits: {
    ref: 'Art. 5(1)(g)',
    text: 'Biometric categorisation to infer race, political opinions, trade union membership, religious or philosophical beliefs, sex life or sexual orientation',
  },
  realTimeRemoteBiometricIdForLawEnforcement: {
    ref: 'Art. 5(1)(h)',
    text: 'Real-time remote biometric identification in publicly accessible spaces for law enforcement (outside the exceptions of Art. 5(1)(h) and 5(2)-(7))',
  },
};

const ANNEX_III_LABEL: Record<AnnexIIIArea, string> = {
  biometrics: 'Annex III(1) biometrics',
  critical_infrastructure: 'Annex III(2) critical infrastructure',
  education: 'Annex III(3) education and vocational training',
  employment: 'Annex III(4) employment and workers management',
  essential_services_public_benefits: 'Annex III(5)(a) public assistance benefits and services',
  essential_services_creditworthiness: 'Annex III(5)(b) creditworthiness and credit scoring',
  essential_services_insurance_life_health: 'Annex III(5)(c) life and health insurance risk and pricing',
  essential_services_emergency_triage: 'Annex III(5)(d) emergency calls and triage',
  law_enforcement: 'Annex III(6) law enforcement',
  migration_border: 'Annex III(7) migration, asylum and border control',
  justice_democracy: 'Annex III(8) administration of justice and democratic processes',
};

interface Ctx {
  system: AiSystem;
  findings: Finding[];
  rationale: string[];
}

function add(ctx: Ctx, input: Omit<RequirementInput, 'subjectId'>): void {
  ctx.findings.push(requirement('EU_AI_ACT', { ...input, subjectId: ctx.system.id }));
}

const isProvider = (s: AiSystem) => s.role === 'provider' || s.role === 'provider_and_deployer';
const isDeployer = (s: AiSystem) => s.role === 'deployer' || s.role === 'provider_and_deployer';

function assessProhibited(ctx: Ctx): boolean {
  const practices = ctx.system.prohibitedPractices ?? {};
  let found = false;
  for (const key of Object.keys(PROHIBITED) as (keyof ProhibitedPractices)[]) {
    if (practices[key] !== true) continue;
    found = true;
    const p = PROHIBITED[key];
    ctx.rationale.push(`Declared prohibited practice: ${p.ref}`);
    ctx.findings.push({
      id: `AIA-ART5-${key}`,
      framework: 'EU_AI_ACT',
      reference: `${REG}, ${p.ref}`,
      requirement: `Prohibited practice must not be placed on the market, put into service or used: ${p.text}`,
      appliesBecause: 'The questionnaire declares that the system performs this practice.',
      status: 'gap',
      severity: 'critical',
      recommendation:
        'Stop placing on the market, putting into service or using this functionality and obtain legal advice immediately. ' +
        'If you believe a narrow exception written into Art. 5 applies, document the legal basis for it.',
      subjectId: ctx.system.id,
    });
  }
  return found;
}

interface HighRiskResult {
  highRisk: boolean;
  annexIIIApplies: boolean;
  exemptionApplies: boolean;
}

function assessClassification(ctx: Ctx): HighRiskResult {
  const s = ctx.system;
  const areas = s.annexIIIAreas ?? [];
  const annexI = s.annexIProductSafetyComponent === true;
  const annexIII = areas.length > 0;

  if (annexI) ctx.rationale.push('Safety component of a product covered by Annex I requiring third-party conformity assessment (Art. 6(1)).');
  for (const area of areas) ctx.rationale.push(`Listed in ${ANNEX_III_LABEL[area]} (Art. 6(2)).`);

  let exemptionApplies = false;
  if (annexIII && s.claimsArticle6_3Exemption === true) {
    if (s.performsProfiling === true) {
      ctx.rationale.push('Art. 6(3) exemption claimed but not available: the system performs profiling of natural persons.');
      ctx.findings.push({
        id: 'AIA-ART6-3-PROFILING',
        framework: 'EU_AI_ACT',
        reference: `${REG}, Art. 6(3), last subparagraph`,
        requirement: 'An Annex III system that performs profiling of natural persons is always high-risk.',
        appliesBecause: 'The system is listed in Annex III, performs profiling and the provider claims the Art. 6(3) exemption.',
        status: 'gap',
        severity: 'critical',
        recommendation: 'Withdraw the exemption claim and apply all high-risk obligations to this system.',
        subjectId: s.id,
      });
    } else if (!annexI) {
      exemptionApplies = true;
      ctx.rationale.push(
        'Art. 6(3) exemption claimed (no significant risk; narrow procedural, preparatory or pattern-detection task). Validity must be confirmed by legal review.',
      );
    }
  }

  const highRisk = annexI || (annexIII && !exemptionApplies);
  return { highRisk, annexIIIApplies: annexIII && !exemptionApplies, exemptionApplies };
}

function assessExemptionDuties(ctx: Ctx): void {
  const c = ctx.system.controls ?? {};
  add(ctx, {
    id: 'AIA-ART6-4-DOCUMENTATION',
    reference: `${REG}, Art. 6(4)`,
    requirement: 'Document the assessment that the Annex III system is not high-risk before placing it on the market.',
    appliesBecause: 'Provider claims the Art. 6(3) exemption for an Annex III system.',
    severity: 'high',
    recommendation: 'Write down which Art. 6(3) condition applies and why, and keep it available for national authorities.',
    control: c.article6_3AssessmentDocumented,
  });
  add(ctx, {
    id: 'AIA-ART49-2-REGISTRATION',
    reference: `${REG}, Art. 49(2)`,
    requirement: 'Register the system in the EU database even though it is considered not high-risk.',
    appliesBecause: 'Provider claims the Art. 6(3) exemption for an Annex III system.',
    severity: 'medium',
    recommendation: 'Register the provider and the system in the EU database under Art. 49(2).',
    control: c.euDatabaseRegistration,
  });
}

function assessProviderHighRisk(ctx: Ctx, company: CompanyProfile['company'], hr: HighRiskResult): void {
  const c = ctx.system.controls ?? {};
  const why = 'Provider of a high-risk AI system.';
  const duties: Array<[string, string, string, Severity, string, boolean | undefined]> = [
    ['AIA-ART9-RISK-MGMT', 'Art. 9', 'Risk management system established, documented and maintained across the lifecycle', 'high', 'Set up a documented, iterative risk management process covering known and foreseeable risks.', c.riskManagementSystem],
    ['AIA-ART10-DATA-GOV', 'Art. 10', 'Data governance for training, validation and testing data (relevance, representativeness, bias examination)', 'high', 'Document data sources, preparation steps and bias examination for all datasets.', c.dataGovernance],
    ['AIA-ART11-TECH-DOC', 'Art. 11 and Annex IV', 'Technical documentation drawn up before placing on the market and kept up to date', 'high', 'Prepare technical documentation following the structure of Annex IV.', c.technicalDocumentation],
    ['AIA-ART12-LOGGING', 'Art. 12', 'Automatic recording of events (logs) over the lifetime of the system', 'high', 'Implement automatic event logging that enables traceability of the system\'s functioning.', c.automaticLogging],
    ['AIA-ART13-INSTRUCTIONS', 'Art. 13', 'Transparency and instructions for use for deployers', 'medium', 'Provide instructions for use describing capabilities, limitations, accuracy and human oversight measures.', c.instructionsForUse],
    ['AIA-ART14-OVERSIGHT', 'Art. 14', 'Designed to allow effective human oversight', 'high', 'Build in measures that let natural persons monitor, interpret, override and stop the system.', c.humanOversightDesign],
    ['AIA-ART15-ACCURACY', 'Art. 15', 'Appropriate level of accuracy, robustness and cybersecurity', 'high', 'Define and test accuracy metrics, resilience to errors and protection against attacks such as data poisoning.', c.accuracyRobustnessCybersecurity],
    ['AIA-ART17-QMS', 'Art. 17', 'Quality management system', 'high', 'Establish a documented quality management system proportionate to the organisation size.', c.qualityManagementSystem],
    ['AIA-ART43-CONFORMITY', 'Art. 43', 'Conformity assessment completed before placing on the market', 'high', 'Carry out the applicable conformity assessment procedure (internal control or notified body).', c.conformityAssessment],
    ['AIA-ART47-DOC', 'Art. 47', 'EU declaration of conformity drawn up', 'medium', 'Draw up and sign the EU declaration of conformity.', c.euDeclarationOfConformity],
    ['AIA-ART48-CE', 'Art. 48', 'CE marking affixed', 'medium', 'Affix the CE marking after a successful conformity assessment.', c.ceMarking],
    ['AIA-ART72-PMM', 'Art. 72', 'Post-market monitoring system in place', 'medium', 'Set up a post-market monitoring plan that collects and analyses performance data.', c.postMarketMonitoring],
    ['AIA-ART73-INCIDENTS', 'Art. 73', 'Serious incidents reported to market surveillance authorities', 'high', 'Define a procedure to detect and report serious incidents within the legal deadlines.', c.seriousIncidentReporting],
  ];
  for (const [id, art, req, severity, rec, control] of duties) {
    add(ctx, { id, reference: `${REG}, ${art}`, requirement: req, appliesBecause: why, severity, recommendation: rec, control });
  }

  if (hr.annexIIIApplies) {
    add(ctx, {
      id: 'AIA-ART49-1-REGISTRATION',
      reference: `${REG}, Art. 49(1)`,
      requirement: 'Provider and system registered in the EU database before placing on the market',
      appliesBecause: 'Provider of a high-risk system listed in Annex III (critical infrastructure systems are registered at national level, Art. 49(5)).',
      severity: 'medium',
      recommendation: 'Register the provider and the system in the EU database.',
      control: c.euDatabaseRegistration,
    });
  }

  if (!company.establishedInEu) {
    add(ctx, {
      id: 'AIA-ART22-AUTH-REP',
      reference: `${REG}, Art. 22`,
      requirement: 'Authorised representative established in the EU appointed by written mandate',
      appliesBecause: 'Provider of a high-risk system established outside the EU.',
      severity: 'high',
      recommendation: 'Appoint an authorised representative in the EU before making the system available on the EU market.',
      control: c.authorisedRepresentative,
    });
  }
}

function assessDeployerHighRisk(ctx: Ctx): void {
  const s = ctx.system;
  const c = s.controls ?? {};
  const areas = s.annexIIIAreas ?? [];
  const why = 'Deployer of a high-risk AI system.';

  add(ctx, { id: 'AIA-ART26-1-INSTRUCTIONS', reference: `${REG}, Art. 26(1)`, requirement: 'System used in accordance with the provider\'s instructions for use', appliesBecause: why, severity: 'medium', recommendation: 'Put technical and organisational measures in place to use the system as instructed.', control: c.usedAccordingToInstructions });
  add(ctx, { id: 'AIA-ART26-2-OVERSIGHT', reference: `${REG}, Art. 26(2)`, requirement: 'Human oversight assigned to competent, trained persons with authority', appliesBecause: why, severity: 'high', recommendation: 'Name the persons responsible for oversight and give them training and authority to intervene.', control: c.humanOversightAssigned });
  add(ctx, { id: 'AIA-ART26-4-INPUT-DATA', reference: `${REG}, Art. 26(4)`, requirement: 'Input data relevant and sufficiently representative (where the deployer controls input data)', appliesBecause: why, severity: 'medium', recommendation: 'Check that the input data you feed into the system fits its intended purpose.', control: c.inputDataRelevance });
  add(ctx, { id: 'AIA-ART26-5-MONITORING', reference: `${REG}, Art. 26(5)`, requirement: 'Operation monitored; risks and serious incidents reported to the provider and authorities', appliesBecause: why, severity: 'medium', recommendation: 'Monitor operation and define an escalation path to the provider and the market surveillance authority.', control: c.operationMonitoring });
  add(ctx, { id: 'AIA-ART26-6-LOGS', reference: `${REG}, Art. 26(6)`, requirement: 'Automatically generated logs kept for at least six months', appliesBecause: why, severity: 'medium', recommendation: 'Retain logs under your control for at least six months unless other law provides otherwise.', control: c.logsRetainedSixMonths });

  if (s.usedInWorkplace === true) {
    add(ctx, { id: 'AIA-ART26-7-WORKERS', reference: `${REG}, Art. 26(7)`, requirement: 'Workers\' representatives and affected workers informed before the system is put into use at the workplace', appliesBecause: 'High-risk system used at the workplace.', severity: 'high', recommendation: 'Inform workers\' representatives and affected workers before deployment.', control: c.workersRepresentativesInformed });
  }
  if (s.makesOrAssistsDecisionsAboutPersons === true && areas.length > 0) {
    add(ctx, { id: 'AIA-ART26-11-PERSONS', reference: `${REG}, Art. 26(11)`, requirement: 'Natural persons informed that they are subject to the use of a high-risk system', appliesBecause: 'Annex III system that makes or assists decisions about natural persons.', severity: 'medium', recommendation: 'Inform affected persons; also prepare to answer explanation requests under Art. 86.', control: c.affectedPersonsInformed });
  }

  const friaByArea = areas.includes('essential_services_creditworthiness') || areas.includes('essential_services_insurance_life_health');
  const friaByPublic = s.deployerIsPublicBodyOrPublicService === true && areas.some((a) => a !== 'critical_infrastructure');
  if (friaByArea || friaByPublic) {
    add(ctx, {
      id: 'AIA-ART27-FRIA',
      reference: `${REG}, Art. 27`,
      requirement: 'Fundamental rights impact assessment performed before first use',
      appliesBecause: friaByArea
        ? 'Deployer of a system for creditworthiness or life/health insurance pricing (Annex III(5)(b)/(c)).'
        : 'Deployer is a public body or a private entity providing public services.',
      severity: 'high',
      recommendation: 'Carry out a fundamental rights impact assessment and notify the market surveillance authority of the results.',
      control: c.fundamentalRightsImpactAssessment,
    });
  }
}

function assessTransparency(ctx: Ctx): boolean {
  const s = ctx.system;
  const c = s.controls ?? {};
  let applies = false;

  if (isProvider(s) && s.interactsDirectlyWithPersons === true) {
    applies = true;
    add(ctx, { id: 'AIA-ART50-1-INTERACTION', reference: `${REG}, Art. 50(1)`, requirement: 'Persons informed that they are interacting with an AI system (unless obvious)', appliesBecause: 'Provider of a system that interacts directly with natural persons.', severity: 'medium', recommendation: 'Design the system to disclose clearly that the user is interacting with AI.', control: c.aiInteractionDisclosure });
  }
  if (isProvider(s) && s.generatesSyntheticContent === true) {
    applies = true;
    add(ctx, { id: 'AIA-ART50-2-MARKING', reference: `${REG}, Art. 50(2)`, requirement: 'Synthetic audio, image, video or text outputs marked in a machine-readable format and detectable as AI-generated', appliesBecause: 'Provider of a system that generates synthetic content.', severity: 'medium', recommendation: 'Implement machine-readable marking (for example watermarking or metadata) that is effective, interoperable and robust.', control: c.syntheticContentMachineReadableMarking });
  }
  if (isDeployer(s) && s.usesEmotionRecognitionOrBiometricCategorisation === true) {
    applies = true;
    add(ctx, { id: 'AIA-ART50-3-EMOTION', reference: `${REG}, Art. 50(3)`, requirement: 'Persons exposed to emotion recognition or biometric categorisation informed of its operation', appliesBecause: 'Deployer of an emotion recognition or biometric categorisation system.', severity: 'medium', recommendation: 'Inform exposed persons and process their personal data in line with GDPR.', control: c.emotionOrBiometricSystemDisclosure });
  }
  if (isDeployer(s) && s.producesDeepfakes === true) {
    applies = true;
    add(ctx, { id: 'AIA-ART50-4-DEEPFAKE', reference: `${REG}, Art. 50(4)`, requirement: 'Deep fake content disclosed as artificially generated or manipulated', appliesBecause: 'Deployer of a system that generates or manipulates deep fake content.', severity: 'medium', recommendation: 'Label deep fake content clearly; lighter rules apply to evidently artistic or satirical works.', control: c.deepfakeDisclosure });
  }
  if (isDeployer(s) && s.publishesAiTextOnPublicInterestMatters === true && s.aiTextUnderHumanEditorialResponsibility !== true) {
    applies = true;
    add(ctx, { id: 'AIA-ART50-4-TEXT', reference: `${REG}, Art. 50(4)`, requirement: 'AI-generated text published to inform the public on matters of public interest disclosed as AI-generated', appliesBecause: 'Deployer publishes AI-generated text on public-interest matters without human editorial responsibility.', severity: 'medium', recommendation: 'Disclose AI generation, or put the text under human review and editorial responsibility.', control: c.aiGeneratedPublicInterestTextDisclosure });
  }
  return applies;
}

function assessGpai(ctx: Ctx, company: CompanyProfile['company']): void {
  const s = ctx.system;
  const c = s.controls ?? {};
  const why = 'Provider of a general-purpose AI model.';
  ctx.rationale.push('General-purpose AI model: Chapter V obligations apply to the provider.');

  add(ctx, { id: 'AIA-ART53-1A-TECHDOC', reference: `${REG}, Art. 53(1)(a) and Annex XI`, requirement: 'Technical documentation of the model, including training and testing process', appliesBecause: why, severity: 'high', recommendation: 'Draw up model documentation following Annex XI (a partial exemption exists for certain open-source models, Art. 53(2)).', control: c.gpaiTechnicalDocumentation });
  add(ctx, { id: 'AIA-ART53-1B-DOWNSTREAM', reference: `${REG}, Art. 53(1)(b) and Annex XII`, requirement: 'Information and documentation for downstream providers integrating the model', appliesBecause: why, severity: 'medium', recommendation: 'Provide downstream providers with the information listed in Annex XII.', control: c.gpaiDownstreamProviderInformation });
  add(ctx, { id: 'AIA-ART53-1C-COPYRIGHT', reference: `${REG}, Art. 53(1)(c)`, requirement: 'Policy to comply with Union copyright law, including text and data mining opt-outs', appliesBecause: why, severity: 'high', recommendation: 'Adopt and apply a copyright compliance policy that respects rights reservations.', control: c.gpaiCopyrightPolicy });
  add(ctx, { id: 'AIA-ART53-1D-SUMMARY', reference: `${REG}, Art. 53(1)(d)`, requirement: 'Publicly available summary of the content used for training', appliesBecause: why, severity: 'medium', recommendation: 'Publish a sufficiently detailed training content summary using the AI Office template.', control: c.gpaiTrainingContentSummary });

  if (s.gpaiModelWithSystemicRisk === true) {
    add(ctx, { id: 'AIA-ART55-SYSTEMIC', reference: `${REG}, Art. 55`, requirement: 'Model evaluation, systemic risk mitigation, incident reporting and cybersecurity for models with systemic risk', appliesBecause: 'General-purpose AI model with systemic risk.', severity: 'high', recommendation: 'Perform adversarial testing, assess and mitigate systemic risks, report serious incidents to the AI Office.', control: c.gpaiSystemicRiskMeasures });
  }
  if (!company.establishedInEu) {
    add(ctx, { id: 'AIA-ART54-AUTH-REP', reference: `${REG}, Art. 54`, requirement: 'Authorised representative in the EU for a general-purpose AI model provider', appliesBecause: 'Provider of a general-purpose AI model established outside the EU.', severity: 'high', recommendation: 'Appoint an authorised representative in the EU by written mandate.', control: c.authorisedRepresentative });
  }
}

export interface AiActResult {
  applicable: boolean;
  classifications: AiSystemClassification[];
  findings: Finding[];
}

export function assessAiAct(profile: CompanyProfile): AiActResult {
  const findings: Finding[] = [];
  const classifications: AiSystemClassification[] = [];
  let anyInScope = false;

  for (const system of profile.aiSystems) {
    const ctx: Ctx = { system, findings, rationale: [] };
    const isGpaiModel = system.isGeneralPurposeAiModel === true;

    if (!system.euNexus) {
      classifications.push({
        systemId: system.id,
        systemName: system.name,
        riskClass: 'out_of_scope',
        isGpaiModel,
        rationale: ['No EU nexus declared: not placed on the EU market, not put into service in the EU and output not used in the EU (Art. 2(1)).'],
      });
      continue;
    }
    anyInScope = true;

    if (assessProhibited(ctx)) {
      classifications.push({ systemId: system.id, systemName: system.name, riskClass: 'prohibited', isGpaiModel, rationale: ctx.rationale });
      continue;
    }

    const hr = assessClassification(ctx);
    if (hr.exemptionApplies && isProvider(system)) assessExemptionDuties(ctx);
    if (hr.highRisk && isProvider(system)) assessProviderHighRisk(ctx, profile.company, hr);
    if (hr.highRisk && isDeployer(system)) assessDeployerHighRisk(ctx);
    const transparency = assessTransparency(ctx);
    if (isGpaiModel && isProvider(system)) assessGpai(ctx, profile.company);

    const hasCriticalClassificationIssue = ctx.findings.some(
      (f) => f.subjectId === system.id && f.id === 'AIA-ART6-3-PROFILING',
    );
    let riskClass: AiSystemClassification['riskClass'];
    if (hr.highRisk || hasCriticalClassificationIssue) riskClass = 'high_risk';
    else if (transparency) riskClass = 'transparency_obligations';
    else riskClass = 'minimal_risk';

    if (riskClass === 'minimal_risk') ctx.rationale.push('No prohibited practice, no high-risk trigger and no Art. 50 trigger declared.');
    if (transparency) ctx.rationale.push('Art. 50 transparency obligations apply.');

    classifications.push({ systemId: system.id, systemName: system.name, riskClass, isGpaiModel, rationale: ctx.rationale });
  }

  if (anyInScope) {
    findings.push(
      requirement('EU_AI_ACT', {
        id: 'AIA-ART4-LITERACY',
        reference: `${REG}, Art. 4`,
        requirement: 'Staff dealing with AI systems have a sufficient level of AI literacy',
        appliesBecause: 'The company provides or deploys at least one AI system within the scope of the AI Act.',
        severity: 'medium',
        recommendation: 'Run AI literacy training tailored to the roles, knowledge and context of the staff involved.',
        control: profile.aiLiteracyProgramme,
      }),
    );
  }

  return { applicable: anyInScope, classifications, findings };
}
