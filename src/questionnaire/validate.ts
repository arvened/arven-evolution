import {
  AI_ROLES,
  ANNEX_III_AREAS,
  GDPR_ROLES,
  type CompanyProfile,
} from './types.ts';

/**
 * Strict validator for the questionnaire.
 *
 * Unknown keys are rejected on purpose: a typo such as "dpoApointed" would otherwise be
 * silently ignored and the requirement reported as "unknown" instead of "met".
 */

export class ValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Invalid questionnaire: ${issues.length} issue(s)\n- ${issues.join('\n- ')}`);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

type FieldSpec =
  | { kind: 'string'; required?: boolean; pattern?: RegExp }
  | { kind: 'boolean'; required?: boolean }
  | { kind: 'integer'; required?: boolean; min?: number }
  | { kind: 'enum'; values: readonly string[]; required?: boolean }
  | { kind: 'enumArray'; values: readonly string[]; required?: boolean }
  | { kind: 'object'; fields: Record<string, FieldSpec>; required?: boolean }
  | { kind: 'array'; item: Record<string, FieldSpec>; required?: boolean; minItems?: number };

const bool = (required = false): FieldSpec => ({ kind: 'boolean', required });

const booleans = (...keys: string[]): Record<string, FieldSpec> =>
  Object.fromEntries(keys.map((k) => [k, bool()]));

const PROHIBITED_PRACTICES = booleans(
  'subliminalOrManipulativeTechniques',
  'exploitsVulnerabilities',
  'socialScoring',
  'crimePredictionBasedSolelyOnProfiling',
  'untargetedFacialImageScraping',
  'emotionRecognitionAtWorkOrEducation',
  'biometricCategorisationOfSensitiveTraits',
  'realTimeRemoteBiometricIdForLawEnforcement',
);

const AI_CONTROLS = booleans(
  'riskManagementSystem',
  'dataGovernance',
  'technicalDocumentation',
  'automaticLogging',
  'instructionsForUse',
  'humanOversightDesign',
  'accuracyRobustnessCybersecurity',
  'qualityManagementSystem',
  'conformityAssessment',
  'euDeclarationOfConformity',
  'ceMarking',
  'euDatabaseRegistration',
  'postMarketMonitoring',
  'seriousIncidentReporting',
  'authorisedRepresentative',
  'article6_3AssessmentDocumented',
  'usedAccordingToInstructions',
  'humanOversightAssigned',
  'inputDataRelevance',
  'operationMonitoring',
  'logsRetainedSixMonths',
  'workersRepresentativesInformed',
  'affectedPersonsInformed',
  'fundamentalRightsImpactAssessment',
  'aiInteractionDisclosure',
  'syntheticContentMachineReadableMarking',
  'deepfakeDisclosure',
  'aiGeneratedPublicInterestTextDisclosure',
  'emotionOrBiometricSystemDisclosure',
  'gpaiTechnicalDocumentation',
  'gpaiDownstreamProviderInformation',
  'gpaiCopyrightPolicy',
  'gpaiTrainingContentSummary',
  'gpaiSystemicRiskMeasures',
);

const AI_SYSTEM: Record<string, FieldSpec> = {
  id: { kind: 'string', required: true, pattern: /^[A-Za-z0-9._-]{1,64}$/ },
  name: { kind: 'string', required: true },
  description: { kind: 'string' },
  role: { kind: 'enum', values: AI_ROLES, required: true },
  euNexus: bool(true),
  prohibitedPractices: { kind: 'object', fields: PROHIBITED_PRACTICES },
  annexIProductSafetyComponent: bool(),
  annexIIIAreas: { kind: 'enumArray', values: ANNEX_III_AREAS },
  ...booleans(
    'performsProfiling',
    'claimsArticle6_3Exemption',
    'makesOrAssistsDecisionsAboutPersons',
    'interactsDirectlyWithPersons',
    'generatesSyntheticContent',
    'producesDeepfakes',
    'publishesAiTextOnPublicInterestMatters',
    'aiTextUnderHumanEditorialResponsibility',
    'usesEmotionRecognitionOrBiometricCategorisation',
    'isGeneralPurposeAiModel',
    'gpaiModelWithSystemicRisk',
    'deployerIsPublicBodyOrPublicService',
    'usedInWorkplace',
  ),
  controls: { kind: 'object', fields: AI_CONTROLS },
};

const GDPR: Record<string, FieldSpec> = {
  processesPersonalData: bool(true),
  role: { kind: 'enum', values: GDPR_ROLES, required: true },
  dataSubjectsInEu: bool(true),
  isPublicAuthority: bool(),
  processing: {
    kind: 'object',
    fields: booleans(
      'specialCategoryData',
      'criminalOffenceData',
      'largeScale',
      'systematicMonitoringCoreActivity',
      'publicAreaMonitoring',
      'automatedDecisionsWithSignificantEffects',
      'extensiveProfiling',
      'childrenConsentForOnlineServices',
      'usesProcessors',
      'usesSubProcessors',
      'transfersOutsideEea',
      'occasionalOnly',
    ),
  },
  controls: {
    kind: 'object',
    fields: booleans(
      'lawfulBasisDocumented',
      'specialCategoryConditionDocumented',
      'privacyNoticePublished',
      'dataSubjectRightsProcedure',
      'automatedDecisionSafeguards',
      'privacyByDesignAndDefault',
      'processorAgreements',
      'recordsOfProcessing',
      'securityMeasures',
      'breachNotificationProcedure',
      'dpiaCompleted',
      'dpoAppointed',
      'transferMechanism',
      'euRepresentativeAppointed',
      'parentalConsentMechanism',
      'controllerContracts',
      'subProcessorAuthorisation',
      'breachNotificationToController',
    ),
  },
};

const PROFILE: Record<string, FieldSpec> = {
  company: {
    kind: 'object',
    required: true,
    fields: {
      name: { kind: 'string', required: true },
      country: { kind: 'string', required: true, pattern: /^[A-Z]{2}$/ },
      establishedInEu: bool(true),
      employees: { kind: 'integer', required: true, min: 0 },
    },
  },
  aiLiteracyProgramme: bool(),
  aiSystems: { kind: 'array', item: AI_SYSTEM, required: true },
  gdpr: { kind: 'object', fields: GDPR },
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function checkObject(value: unknown, fields: Record<string, FieldSpec>, path: string, issues: string[]): void {
  if (!isPlainObject(value)) {
    issues.push(`${path || '<root>'}: expected an object`);
    return;
  }
  for (const key of Object.keys(value)) {
    if (!(key in fields)) issues.push(`${path ? `${path}.` : ''}${key}: unknown field`);
  }
  for (const [key, spec] of Object.entries(fields)) {
    checkField(value[key], spec, path ? `${path}.${key}` : key, issues);
  }
}

function checkField(value: unknown, spec: FieldSpec, path: string, issues: string[]): void {
  if (value === undefined || value === null) {
    if (spec.required) issues.push(`${path}: required`);
    return;
  }
  switch (spec.kind) {
    case 'string':
      if (typeof value !== 'string' || value.trim() === '') issues.push(`${path}: expected a non-empty string`);
      else if (spec.pattern && !spec.pattern.test(value)) issues.push(`${path}: invalid format`);
      return;
    case 'boolean':
      if (typeof value !== 'boolean') issues.push(`${path}: expected true or false`);
      return;
    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value)) issues.push(`${path}: expected an integer`);
      else if (spec.min !== undefined && value < spec.min) issues.push(`${path}: must be >= ${spec.min}`);
      return;
    case 'enum':
      if (typeof value !== 'string' || !spec.values.includes(value))
        issues.push(`${path}: expected one of ${spec.values.join(', ')}`);
      return;
    case 'enumArray':
      if (!Array.isArray(value)) {
        issues.push(`${path}: expected an array`);
        return;
      }
      value.forEach((v, i) => {
        if (typeof v !== 'string' || !spec.values.includes(v))
          issues.push(`${path}[${i}]: expected one of ${spec.values.join(', ')}`);
      });
      return;
    case 'object':
      checkObject(value, spec.fields, path, issues);
      return;
    case 'array':
      if (!Array.isArray(value)) {
        issues.push(`${path}: expected an array`);
        return;
      }
      if (spec.minItems !== undefined && value.length < spec.minItems)
        issues.push(`${path}: at least ${spec.minItems} item(s) required`);
      value.forEach((item, i) => checkObject(item, spec.item, `${path}[${i}]`, issues));
      return;
  }
}

export function validateProfile(input: unknown): CompanyProfile {
  const issues: string[] = [];
  checkObject(input, PROFILE, '', issues);

  if (issues.length === 0) {
    const profile = input as CompanyProfile;
    const seen = new Set<string>();
    profile.aiSystems.forEach((s, i) => {
      if (seen.has(s.id)) issues.push(`aiSystems[${i}].id: duplicate id "${s.id}"`);
      seen.add(s.id);
    });
  }

  if (issues.length > 0) throw new ValidationError(issues);
  return input as CompanyProfile;
}
