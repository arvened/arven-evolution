/**
 * Core domain types shared by all assessment engines.
 *
 * A finding is one legal requirement checked against the facts the company declared.
 * The engine never "proves" compliance: it compares declared facts with the rules
 * it knows and flags what is missing or unknown.
 */

export type Framework = 'EU_AI_ACT' | 'GDPR';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

/**
 * met      - the company declared that the control is in place
 * gap      - the company declared that the control is NOT in place, or a prohibited fact was declared
 * unknown  - the requirement applies but the company did not answer the question
 */
export type FindingStatus = 'met' | 'gap' | 'unknown';

export interface Finding {
  /** Stable identifier, e.g. "AIA-ART5-SOCIAL-SCORING" or "GDPR-ART35-DPIA". */
  id: string;
  framework: Framework;
  /** Legal reference, e.g. "Regulation (EU) 2024/1689, Art. 5(1)(c)". */
  reference: string;
  /** Short human-readable requirement. */
  requirement: string;
  /** Why this requirement applies to the assessed subject. */
  appliesBecause: string;
  status: FindingStatus;
  severity: Severity;
  /** What to do when status is gap or unknown. */
  recommendation: string;
  /** Which AI system this finding belongs to, if any. */
  subjectId?: string;
}

export type AiActRiskClass = 'out_of_scope' | 'prohibited' | 'high_risk' | 'transparency_obligations' | 'minimal_risk';

export interface AiSystemClassification {
  systemId: string;
  systemName: string;
  riskClass: AiActRiskClass;
  isGpaiModel: boolean;
  rationale: string[];
}

export type Verdict = 'critical_issues' | 'gaps_found' | 'no_gaps_on_declared_facts';

export interface ScoreSummary {
  /** 0-100, weighted share of applicable requirements declared as met. */
  score: number;
  /** 0-100, share of applicable requirements the company actually answered. */
  answerCoverage: number;
  counts: Record<FindingStatus, number>;
  gapsBySeverity: Record<Severity, number>;
  verdict: Verdict;
}

export interface AuditReport {
  auditId: string;
  companyName: string;
  createdAt: string;
  engineVersion: string;
  aiAct: {
    applicable: boolean;
    classifications: AiSystemClassification[];
    summary: ScoreSummary;
  };
  gdpr: {
    applicable: boolean;
    summary: ScoreSummary;
  };
  overall: ScoreSummary;
  findings: Finding[];
  disclaimer: string;
}

export const DISCLAIMER =
  'This report is an automated self-assessment based solely on the facts declared in the questionnaire. ' +
  'It is not legal advice and not a conformity assessment. Findings must be reviewed by a qualified lawyer ' +
  'before any decision or public statement about compliance is made.';
