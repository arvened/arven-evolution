/**
 * Questionnaire: the facts a company declares about itself.
 *
 * Every control ("is X in place?") is an optional boolean:
 *   true      -> declared in place          -> finding status "met"
 *   false     -> declared NOT in place      -> finding status "gap"
 *   undefined -> not answered               -> finding status "unknown"
 *
 * Nothing is inferred: an unanswered control is never treated as met.
 */

export const ANNEX_III_AREAS = [
  'biometrics',
  'critical_infrastructure',
  'education',
  'employment',
  'essential_services_public_benefits',
  'essential_services_creditworthiness',
  'essential_services_insurance_life_health',
  'essential_services_emergency_triage',
  'law_enforcement',
  'migration_border',
  'justice_democracy',
] as const;

export type AnnexIIIArea = (typeof ANNEX_III_AREAS)[number];

export const AI_ROLES = ['provider', 'deployer', 'provider_and_deployer'] as const;
export type AiRole = (typeof AI_ROLES)[number];

export const GDPR_ROLES = ['controller', 'processor', 'controller_and_processor'] as const;
export type GdprRole = (typeof GDPR_ROLES)[number];

/**
 * Art. 5 AI Act practices. Each flag means the system does this WITHOUT falling under
 * one of the narrow exceptions written into Art. 5 itself (for example medical or safety
 * reasons for emotion recognition, or authorised law-enforcement use of real-time
 * remote biometric identification). Exceptions always require legal review.
 */
export interface ProhibitedPractices {
  subliminalOrManipulativeTechniques?: boolean;
  exploitsVulnerabilities?: boolean;
  socialScoring?: boolean;
  crimePredictionBasedSolelyOnProfiling?: boolean;
  untargetedFacialImageScraping?: boolean;
  emotionRecognitionAtWorkOrEducation?: boolean;
  biometricCategorisationOfSensitiveTraits?: boolean;
  realTimeRemoteBiometricIdForLawEnforcement?: boolean;
}

export interface AiSystemControls {
  // Provider obligations for high-risk systems (Chapter III, Section 2 and 3)
  riskManagementSystem?: boolean;
  dataGovernance?: boolean;
  technicalDocumentation?: boolean;
  automaticLogging?: boolean;
  instructionsForUse?: boolean;
  humanOversightDesign?: boolean;
  accuracyRobustnessCybersecurity?: boolean;
  qualityManagementSystem?: boolean;
  conformityAssessment?: boolean;
  euDeclarationOfConformity?: boolean;
  ceMarking?: boolean;
  euDatabaseRegistration?: boolean;
  postMarketMonitoring?: boolean;
  seriousIncidentReporting?: boolean;
  authorisedRepresentative?: boolean;
  article6_3AssessmentDocumented?: boolean;

  // Deployer obligations for high-risk systems (Art. 26, 27)
  usedAccordingToInstructions?: boolean;
  humanOversightAssigned?: boolean;
  inputDataRelevance?: boolean;
  operationMonitoring?: boolean;
  logsRetainedSixMonths?: boolean;
  workersRepresentativesInformed?: boolean;
  affectedPersonsInformed?: boolean;
  fundamentalRightsImpactAssessment?: boolean;

  // Transparency (Art. 50)
  aiInteractionDisclosure?: boolean;
  syntheticContentMachineReadableMarking?: boolean;
  deepfakeDisclosure?: boolean;
  aiGeneratedPublicInterestTextDisclosure?: boolean;
  emotionOrBiometricSystemDisclosure?: boolean;

  // General-purpose AI models (Art. 53, 55)
  gpaiTechnicalDocumentation?: boolean;
  gpaiDownstreamProviderInformation?: boolean;
  gpaiCopyrightPolicy?: boolean;
  gpaiTrainingContentSummary?: boolean;
  gpaiSystemicRiskMeasures?: boolean;
}

export interface AiSystem {
  id: string;
  name: string;
  description?: string;
  role: AiRole;
  /** Placed on the EU market, put into service in the EU, or its output is used in the EU (Art. 2(1)). */
  euNexus: boolean;
  prohibitedPractices?: ProhibitedPractices;
  /** Safety component of a product (or itself a product) covered by Annex I law that requires third-party conformity assessment (Art. 6(1)). */
  annexIProductSafetyComponent?: boolean;
  annexIIIAreas?: AnnexIIIArea[];
  /** The system profiles natural persons (GDPR Art. 4(4) sense). Blocks the Art. 6(3) exemption. */
  performsProfiling?: boolean;
  /** The provider considers the Annex III system not high-risk under Art. 6(3). */
  claimsArticle6_3Exemption?: boolean;
  /** Used to make or assist decisions about natural persons. */
  makesOrAssistsDecisionsAboutPersons?: boolean;
  interactsDirectlyWithPersons?: boolean;
  generatesSyntheticContent?: boolean;
  producesDeepfakes?: boolean;
  publishesAiTextOnPublicInterestMatters?: boolean;
  aiTextUnderHumanEditorialResponsibility?: boolean;
  usesEmotionRecognitionOrBiometricCategorisation?: boolean;
  isGeneralPurposeAiModel?: boolean;
  gpaiModelWithSystemicRisk?: boolean;
  /** Deployer is a public body, or a private entity providing public services (Art. 27). */
  deployerIsPublicBodyOrPublicService?: boolean;
  usedInWorkplace?: boolean;
  controls?: AiSystemControls;
}

export interface GdprProcessing {
  specialCategoryData?: boolean;
  criminalOffenceData?: boolean;
  largeScale?: boolean;
  /** Regular and systematic monitoring of data subjects as a core activity. */
  systematicMonitoringCoreActivity?: boolean;
  /** Systematic monitoring of a publicly accessible area. */
  publicAreaMonitoring?: boolean;
  /** Decisions based solely on automated processing, including profiling, with legal or similarly significant effects (Art. 22). */
  automatedDecisionsWithSignificantEffects?: boolean;
  /** Systematic and extensive evaluation of personal aspects based on automated processing (Art. 35(3)(a)). */
  extensiveProfiling?: boolean;
  /** Information society services offered directly to children, relying on consent. */
  childrenConsentForOnlineServices?: boolean;
  usesProcessors?: boolean;
  usesSubProcessors?: boolean;
  transfersOutsideEea?: boolean;
  /** Processing is only occasional (relevant for the Art. 30(5) record-keeping exemption). */
  occasionalOnly?: boolean;
}

export interface GdprControls {
  lawfulBasisDocumented?: boolean;
  specialCategoryConditionDocumented?: boolean;
  privacyNoticePublished?: boolean;
  dataSubjectRightsProcedure?: boolean;
  automatedDecisionSafeguards?: boolean;
  privacyByDesignAndDefault?: boolean;
  processorAgreements?: boolean;
  recordsOfProcessing?: boolean;
  securityMeasures?: boolean;
  breachNotificationProcedure?: boolean;
  dpiaCompleted?: boolean;
  dpoAppointed?: boolean;
  transferMechanism?: boolean;
  euRepresentativeAppointed?: boolean;
  parentalConsentMechanism?: boolean;
  // Processor-side controls
  controllerContracts?: boolean;
  subProcessorAuthorisation?: boolean;
  breachNotificationToController?: boolean;
}

export interface GdprProfile {
  processesPersonalData: boolean;
  role: GdprRole;
  dataSubjectsInEu: boolean;
  isPublicAuthority?: boolean;
  processing?: GdprProcessing;
  controls?: GdprControls;
}

export interface CompanyProfile {
  company: {
    name: string;
    /** ISO 3166-1 alpha-2 */
    country: string;
    establishedInEu: boolean;
    employees: number;
  };
  /** Art. 4 AI Act: staff dealing with AI systems have sufficient AI literacy. */
  aiLiteracyProgramme?: boolean;
  aiSystems: AiSystem[];
  gdpr?: GdprProfile;
}
