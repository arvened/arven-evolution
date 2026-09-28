import { randomUUID } from 'node:crypto';
import { DISCLAIMER, type AuditReport, type Finding } from '../domain/types.ts';
import { validateProfile } from '../questionnaire/validate.ts';
import { assessAiAct } from './aiAct.ts';
import { assessGdpr } from './gdpr.ts';
import { SEVERITY_WEIGHT, summarise } from './scoring.ts';

export const ENGINE_VERSION = '0.1.0';

const STATUS_ORDER: Record<Finding['status'], number> = { gap: 0, unknown: 1, met: 2 };

function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] ||
      a.id.localeCompare(b.id),
  );
}

export interface RunAuditOptions {
  auditId?: string;
  now?: Date;
}

/** Validates the questionnaire and runs every engine. Pure apart from id and timestamp generation. */
export function runAudit(input: unknown, options: RunAuditOptions = {}): AuditReport {
  const profile = validateProfile(input);
  const aiAct = assessAiAct(profile);
  const gdpr = assessGdpr(profile);
  const findings = sortFindings([...aiAct.findings, ...gdpr.findings]);

  return {
    auditId: options.auditId ?? randomUUID(),
    companyName: profile.company.name,
    createdAt: (options.now ?? new Date()).toISOString(),
    engineVersion: ENGINE_VERSION,
    aiAct: {
      applicable: aiAct.applicable,
      classifications: aiAct.classifications,
      summary: summarise(aiAct.findings),
    },
    gdpr: {
      applicable: gdpr.applicable,
      summary: summarise(gdpr.findings),
    },
    overall: summarise(findings),
    findings,
    disclaimer: DISCLAIMER,
  };
}
