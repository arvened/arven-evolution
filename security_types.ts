export interface Vulnerability {
  pattern_id: string;
  location: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  cwe_ids: string[];
  confidence: number;
}

export interface ComplianceGap {
  requirement: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  remediation: string;
  estimated_effort_hours: number;
}

export interface RedTeamSimulation {
  simulated_breach_success_rate: number;
  most_vulnerable_layer: string;
  attack_vectors: string[];
  defense_effectiveness_score: number;
}

export interface SecurityAssessmentRequest {
  audit_id: string;
  company_name: string;
  location: string;
  codebase_url?: string;
  metadata?: Record<string, any>;
}

export interface SecurityAssessmentResult {
  audit_id: string;
  security_score: number;
  verdict: 'PASS' | 'PARTIAL' | 'FAIL';
  vulnerability_summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  compliance_gaps: ComplianceGap[];
  red_team_report: RedTeamSimulation;
  recommendations: Recommendation[];
  timestamp: Date;
  analysis_duration_seconds: number;
}

export interface Recommendation {
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  action: string;
  estimated_effort: string;
  impact: 'high' | 'medium' | 'low';
}

export interface WebhookPayload {
  audit_id: string;
  security_score: number;
  verdict: 'PASS' | 'PARTIAL' | 'FAIL';
  findings: {
    critical: Vulnerability[];
    high: Vulnerability[];
    medium: Vulnerability[];
  };
  compliance_gaps: ComplianceGap[];
  red_team_report: RedTeamSimulation;
  recommendations: Recommendation[];
  analysis_duration_seconds: number;
  timestamp: string;
}

export interface WebhookRetryConfig {
  max_retries: number;
  initial_delay_ms: number;
  max_delay_ms: number;
  backoff_multiplier: number;
  timeout_ms: number;
}

export interface WebhookEvent {
  event_id: string;
  audit_id: string;
  attempt: number;
  timestamp: Date;
  status: 'sent' | 'failed' | 'retrying' | 'abandoned';
  error?: string;
  response_code?: number;
}

export interface ComplianceFramework {
  name: 'GDPR' | 'AI_ACT' | 'DSA' | 'NIS2' | 'DORA';
  requirements: string[];
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

export interface Pattern {
  pattern_id: string;
  name: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  cwe_ids: string[];
  owasp_categories: string[];
  description: string;
  remediation: string;
  false_positive_rate: number;
}

export interface AssessmentMetadata {
  language: string;
  framework?: string;
  team_size?: number;
  codebase_size_loc?: number;
  last_security_audit?: Date;
  deployment_environment?: string;
}
