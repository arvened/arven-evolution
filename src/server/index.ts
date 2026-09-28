import { loadFusionConfig, resolveFusion } from '../fusion/config.ts';
import { InMemoryAuditStore } from '../store/auditStore.ts';
import { createApp } from './app.ts';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const fusionConfig = loadFusionConfig();
const fusion = fusionConfig ? resolveFusion(fusionConfig) : null;

if (fusion) {
  console.log(`[arven] document review: ${fusion.providers.length} provider(s) active: ${fusion.providers.map((p) => p.config.id).join(', ') || 'none'}`);
  for (const s of fusion.skipped) console.log(`[arven] provider ${s.id} skipped: ${s.reason}`);
} else {
  console.log('[arven] document review disabled (no FUSION_CONFIG_FILE / FUSION_CONFIG_JSON)');
}
if (!process.env.ARVEN_API_KEY) console.warn('[arven] WARNING: ARVEN_API_KEY is not set, the API is open to anyone who can reach it');

const server = createApp({
  store: new InMemoryAuditStore(),
  fusion,
  ...(process.env.ARVEN_API_KEY ? { apiKey: process.env.ARVEN_API_KEY } : {}),
});

server.listen(port, host, () => console.log(`[arven] listening on http://${host}:${port}`));

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
