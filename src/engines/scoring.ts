import type { Finding, ScoreSummary, Severity } from '../domain/types.ts';

/**
 * Transparent scoring rule, intentionally simple so that anyone can recompute it by hand:
 *
 *   score          = sum(weight of "met" findings) / sum(weight of all findings) * 100
 *   answerCoverage = findings that are not "unknown" / all findings * 100
 *   verdict        = critical_issues            if any critical finding is a gap
 *                    gaps_found                 if any finding is a gap or unknown
 *                    no_gaps_on_declared_facts  otherwise
 *
 * "unknown" is never counted as met. A high score on low coverage is therefore impossible.
 */
export const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 8, high: 4, medium: 2, low: 1 };

export function summarise(findings: Finding[]): ScoreSummary {
  const counts = { met: 0, gap: 0, unknown: 0 };
  const gapsBySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  let total = 0;
  let met = 0;

  for (const f of findings) {
    counts[f.status] += 1;
    const w = SEVERITY_WEIGHT[f.severity];
    total += w;
    if (f.status === 'met') met += w;
    if (f.status === 'gap') gapsBySeverity[f.severity] += 1;
  }

  const n = findings.length;
  const score = total === 0 ? 100 : Math.round((met / total) * 1000) / 10;
  const answerCoverage = n === 0 ? 100 : Math.round(((n - counts.unknown) / n) * 1000) / 10;

  let verdict: ScoreSummary['verdict'] = 'no_gaps_on_declared_facts';
  if (gapsBySeverity.critical > 0) verdict = 'critical_issues';
  else if (counts.gap > 0 || counts.unknown > 0) verdict = 'gaps_found';

  return { score, answerCoverage, counts, gapsBySeverity, verdict };
}
