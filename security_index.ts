export { SecurityAssessmentAPI } from './security_api';
export { SecurityAssessmentScorer, VulnerabilityPatternCatalog } from './security_scorer';
export { WebhookCallbackHandler, WebhookRetryManager, WebhookLogger } from './security_webhook';
export type {
  Vulnerability,
  ComplianceGap,
  RedTeamSimulation,
  SecurityAssessmentRequest,
  SecurityAssessmentResult,
  Recommendation,
  WebhookPayload,
  WebhookRetryConfig,
  WebhookEvent,
  ComplianceFramework,
  Pattern,
  AssessmentMetadata,
} from './security_types';

export function createSecurityModule(
  webhookUrl: string,
  webhookSecret: string
) {
  return {
    api: new SecurityAssessmentAPI(webhookUrl, webhookSecret),
    scorer: new SecurityAssessmentScorer(),
    webhook: new WebhookCallbackHandler(webhookUrl, webhookSecret),
  };
}
