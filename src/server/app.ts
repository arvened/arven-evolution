import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { runAudit } from '../engines/runAudit.ts';
import type { ResolvedFusion } from '../fusion/config.ts';
import { reviewPrivacyNotice, ReviewError } from '../fusion/privacyNotice.ts';
import { ValidationError } from '../questionnaire/validate.ts';
import { renderMarkdown } from '../report/markdown.ts';
import type { AuditStore } from '../store/auditStore.ts';

export interface AppOptions {
  store: AuditStore;
  /** null disables the document review endpoint. */
  fusion: ResolvedFusion | null;
  /** When set, every /api/* request must send "Authorization: Bearer <apiKey>". */
  apiKey?: string;
  maxBodyBytes?: number;
}

class HttpError extends Error {
  readonly status: number;
  readonly details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function send(res: ServerResponse, status: number, body: unknown, contentType = 'application/json; charset=utf-8'): void {
  const payload = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'content-type': contentType,
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
  });
  res.end(payload);
}

async function readJson(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const type = req.headers['content-type'] ?? '';
  if (!type.includes('application/json')) throw new HttpError(415, 'Content-Type must be application/json');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > maxBytes) throw new HttpError(413, `request body larger than ${maxBytes} bytes`);
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'request body is not valid JSON');
  }
}

function authorised(req: IncomingMessage, apiKey: string): boolean {
  const header = req.headers.authorization ?? '';
  const expected = Buffer.from(`Bearer ${apiKey}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function createApp(options: AppOptions): Server {
  const maxBody = options.maxBodyBytes ?? 1_000_000;

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = req.method ?? 'GET';

    if (method === 'GET' && path === '/health') {
      send(res, 200, { status: 'ok', documentReview: options.fusion !== null });
      return;
    }

    if (path.startsWith('/api/') && options.apiKey && !authorised(req, options.apiKey)) {
      throw new HttpError(401, 'missing or invalid API key');
    }

    if (method === 'POST' && path === '/api/audits') {
      const body = await readJson(req, maxBody);
      const report = runAudit(body);
      options.store.save(report);
      send(res, 201, report);
      return;
    }

    const auditMatch = path.match(/^\/api\/audits\/([A-Za-z0-9-]{1,64})(\/report\.md)?$/);
    if (method === 'GET' && auditMatch) {
      const report = options.store.get(auditMatch[1] as string);
      if (!report) throw new HttpError(404, 'audit not found');
      if (auditMatch[2]) send(res, 200, renderMarkdown(report), 'text/markdown; charset=utf-8');
      else send(res, 200, report);
      return;
    }

    if (method === 'POST' && path === '/api/reviews/privacy-notice') {
      if (!options.fusion) throw new HttpError(503, 'document review is not configured (set FUSION_CONFIG_FILE or FUSION_CONFIG_JSON)');
      const body = (await readJson(req, maxBody)) as { text?: unknown };
      if (typeof body?.text !== 'string') throw new HttpError(400, 'body must be {"text": "<privacy notice text>"}');
      const review = await reviewPrivacyNotice(body.text, options.fusion);
      send(res, 200, review);
      return;
    }

    throw new HttpError(404, 'not found');
  };

  return createServer((req, res) => {
    handle(req, res).catch((err: unknown) => {
      if (res.headersSent) {
        res.end();
        return;
      }
      if (err instanceof HttpError) send(res, err.status, { error: err.message, details: err.details });
      else if (err instanceof ValidationError) send(res, 422, { error: 'invalid questionnaire', issues: err.issues });
      else if (err instanceof ReviewError)
        send(res, err.providers.length > 0 ? 502 : 422, { error: err.message, providers: err.providers });
      else {
        console.error('[arven] unhandled error', err);
        send(res, 500, { error: 'internal error' });
      }
    });
  });
}
