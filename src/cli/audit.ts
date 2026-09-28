import { readFileSync, writeFileSync } from 'node:fs';
import { runAudit } from '../engines/runAudit.ts';
import { ValidationError } from '../questionnaire/validate.ts';
import { renderMarkdown } from '../report/markdown.ts';

/**
 * Usage:
 *   npm run audit -- <questionnaire.json> [--json] [--out <file>]
 */
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--out');
if (!file) {
  console.error('Usage: npm run audit -- <questionnaire.json> [--json] [--out <file>]');
  process.exit(2);
}

try {
  const report = runAudit(JSON.parse(readFileSync(file, 'utf8')));
  const output = args.includes('--json') ? JSON.stringify(report, null, 2) : renderMarkdown(report);
  const outIdx = args.indexOf('--out');
  if (outIdx !== -1 && args[outIdx + 1]) {
    writeFileSync(args[outIdx + 1] as string, output);
    console.error(`Report written to ${args[outIdx + 1]} (verdict: ${report.overall.verdict}, score: ${report.overall.score})`);
  } else {
    console.log(output);
  }
  process.exit(report.overall.verdict === 'critical_issues' ? 1 : 0);
} catch (err) {
  if (err instanceof ValidationError) {
    console.error(err.message);
    process.exit(2);
  }
  throw err;
}
