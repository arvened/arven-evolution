import type { Finding, FindingStatus, Framework, Severity } from '../domain/types.ts';

export function statusOf(declared: boolean | undefined): FindingStatus {
  if (declared === true) return 'met';
  if (declared === false) return 'gap';
  return 'unknown';
}

export interface RequirementInput {
  id: string;
  reference: string;
  requirement: string;
  appliesBecause: string;
  severity: Severity;
  recommendation: string;
  control: boolean | undefined;
  subjectId?: string;
}

export function requirement(framework: Framework, input: RequirementInput): Finding {
  const finding: Finding = {
    id: input.id,
    framework,
    reference: input.reference,
    requirement: input.requirement,
    appliesBecause: input.appliesBecause,
    status: statusOf(input.control),
    severity: input.severity,
    recommendation: input.recommendation,
  };
  if (input.subjectId !== undefined) finding.subjectId = input.subjectId;
  return finding;
}
