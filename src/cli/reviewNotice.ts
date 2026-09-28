import { readFileSync } from 'node:fs';
import { loadFusionConfig, resolveFusion } from '../fusion/config.ts';
import { reviewPrivacyNotice, ReviewError } from '../fusion/privacyNotice.ts';

/**
 * Usage:
 *   FUSION_CONFIG_FILE=fusion.config.json ANTHROPIC_API_KEY=... npm run review-notice -- <notice.txt>
 */
const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run review-notice -- <privacy-notice.txt>');
  process.exit(2);
}

const config = loadFusionConfig();
if (!config) {
  console.error('Set FUSION_CONFIG_FILE or FUSION_CONFIG_JSON (see fusion.config.example.json).');
  process.exit(2);
}

try {
  const review = await reviewPrivacyNotice(readFileSync(file, 'utf8'), resolveFusion(config));
  console.log(JSON.stringify(review, null, 2));
} catch (err) {
  if (err instanceof ReviewError) {
    console.error(`Review failed: ${err.message}`);
    for (const p of err.providers) console.error(`  ${p.providerId}: ${p.ok ? 'ok' : p.error}`);
    process.exit(1);
  }
  throw err;
}
