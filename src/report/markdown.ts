import type { AuditReport, Finding, ScoreSummary } from '../domain/types.ts';

const VERDICT_TEXT: Record<ScoreSummary['verdict'], string> = {
  critical_issues: 'Critical issues found',
  gaps_found: 'Gaps or unanswered requirements found',
  no_gaps_on_declared_facts: 'No gaps on the declared facts',
};

const RISK_TEXT = {
  out_of_scope: 'Out of scope',
  prohibited: 'PROHIBITED practice',
  high_risk: 'High-risk',
  transparency_obligations: 'Transparency obligations (Art. 50)',
  minimal_risk: 'Minimal risk',
} as const;

const STATUS_TEXT: Record<Finding['status'], string> = { gap: 'GAP', unknown: 'UNKNOWN', met: 'MET' };

const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function summaryBlock(title: string, applicable: boolean, s: ScoreSummary): string {
  if (!applicable) return `### ${title}\n\nNot applicable on the declared facts.\n`;
  return [
    `### ${title}`,
    '',
    `- Verdict: **${VERDICT_TEXT[s.verdict]}**`,
    `- Score: **${s.score} / 100** (weighted share of applicable requirements declared as met)`,
    `- Answer coverage: ${s.answerCoverage}% of applicable requirements answered`,
    `- Met: ${s.counts.met} | Gaps: ${s.counts.gap} | Unknown: ${s.counts.unknown}`,
    `- Gaps by severity: critical ${s.gapsBySeverity.critical}, high ${s.gapsBySeverity.high}, medium ${s.gapsBySeverity.medium}, low ${s.gapsBySeverity.low}`,
    '',
  ].join('\n');
}

export function renderMarkdown(report: AuditReport): string {
  const lines: string[] = [];
  lines.push(`# Compliance self-assessment: ${report.companyName}`);
  lines.push('');
  lines.push(`Audit ID: \`${report.auditId}\` | Created: ${report.createdAt} | Engine: v${report.engineVersion}`);
  lines.push('');
  lines.push(`> ${report.disclaimer}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(summaryBlock('Overall', true, report.overall));
  lines.push(summaryBlock('EU AI Act', report.aiAct.applicable, report.aiAct.summary));
  lines.push(summaryBlock('GDPR', report.gdpr.applicable, report.gdpr.summary));

  if (report.aiAct.classifications.length > 0) {
    lines.push('## AI system classification');
    lines.push('');
    for (const c of report.aiAct.classifications) {
      lines.push(`### ${c.systemName} (\`${c.systemId}\`)`);
      lines.push('');
      lines.push(`Risk class: **${RISK_TEXT[c.riskClass]}**${c.isGpaiModel ? ' + general-purpose AI model obligations' : ''}`);
      lines.push('');
      for (const r of c.rationale) lines.push(`- ${r}`);
      lines.push('');
    }
  }

  const actionable = report.findings.filter((f) => f.status !== 'met');
  lines.push('## Action list');
  lines.push('');
  if (actionable.length === 0) {
    lines.push('No gaps or unanswered requirements on the declared facts.');
  } else {
    lines.push('| # | Status | Severity | Requirement | Reference | System | What to do |');
    lines.push('|---|---|---|---|---|---|---|');
    actionable.forEach((f, i) => {
      lines.push(
        `| ${i + 1} | ${STATUS_TEXT[f.status]} | ${f.severity} | ${esc(f.requirement)} | ${esc(f.reference)} | ${f.subjectId ?? 'company'} | ${esc(f.recommendation)} |`,
      );
    });
  }
  lines.push('');

  const met = report.findings.filter((f) => f.status === 'met');
  if (met.length > 0) {
    lines.push('## Requirements declared as met');
    lines.push('');
    for (const f of met) lines.push(`- ${f.requirement} (${f.reference})${f.subjectId ? ` [${f.subjectId}]` : ''}`);
    lines.push('');
  }

  return lines.join('\n');
}
