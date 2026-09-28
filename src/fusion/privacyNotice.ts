import type { ResolvedFusion } from './config.ts';
import type { LlmProvider } from './providers/types.ts';

/**
 * Multi-LLM review of a privacy notice against Art. 13 GDPR.
 *
 * Every configured model reviews the same text independently. The module then:
 *   1. checks that every quote a model offers as evidence really appears in the text
 *      (a "present" vote without a verifiable quote is downgraded to "unclear");
 *   2. takes the majority status per checklist item;
 *   3. marks the item "needs_human_review" when agreement is below the threshold or tied.
 *
 * The output is a review aid for a lawyer, not a legal opinion.
 */

export const ARTICLE_13_CHECKLIST = [
  { id: 'controller_identity', article: 'Art. 13(1)(a)', description: 'Identity and contact details of the controller (and of its representative, if any)' },
  { id: 'dpo_contact', article: 'Art. 13(1)(b)', description: 'Contact details of the data protection officer, where one is designated' },
  { id: 'purposes_and_legal_basis', article: 'Art. 13(1)(c)', description: 'Purposes of the processing and the legal basis for each purpose' },
  { id: 'legitimate_interests', article: 'Art. 13(1)(d)', description: 'The legitimate interests pursued, where processing is based on Art. 6(1)(f)' },
  { id: 'recipients', article: 'Art. 13(1)(e)', description: 'Recipients or categories of recipients of the personal data' },
  { id: 'international_transfers', article: 'Art. 13(1)(f)', description: 'Transfers to third countries and the safeguards relied on' },
  { id: 'retention_period', article: 'Art. 13(2)(a)', description: 'Storage period, or the criteria used to determine it' },
  { id: 'data_subject_rights', article: 'Art. 13(2)(b)', description: 'Rights of access, rectification, erasure, restriction, objection and data portability' },
  { id: 'withdraw_consent', article: 'Art. 13(2)(c)', description: 'Right to withdraw consent at any time, where processing is based on consent' },
  { id: 'complaint_right', article: 'Art. 13(2)(d)', description: 'Right to lodge a complaint with a supervisory authority' },
  { id: 'statutory_or_contractual', article: 'Art. 13(2)(e)', description: 'Whether providing data is a statutory or contractual requirement, whether it is obligatory, and consequences of not providing it' },
  { id: 'automated_decision_making', article: 'Art. 13(2)(f)', description: 'Existence of automated decision-making including profiling, the logic involved and its consequences' },
] as const;

export type ChecklistItemId = (typeof ARTICLE_13_CHECKLIST)[number]['id'];
export type VoteStatus = 'present' | 'absent' | 'unclear' | 'not_applicable';
export type ConsensusStatus = VoteStatus | 'needs_human_review';

const VOTE_STATUSES: readonly VoteStatus[] = ['present', 'absent', 'unclear', 'not_applicable'];
export const MAX_NOTICE_CHARS = 60_000;

export interface Vote {
  providerId: string;
  status: VoteStatus;
  evidence: string | null;
  evidenceVerified: boolean;
  comment: string;
  /** True when the model said "present" but its quote was not found in the text. */
  downgraded: boolean;
}

export interface ItemResult {
  id: ChecklistItemId;
  article: string;
  description: string;
  consensus: ConsensusStatus;
  majorityStatus: VoteStatus | null;
  agreement: number;
  votes: Vote[];
}

export interface ProviderRun {
  providerId: string;
  model: string;
  euHosted: boolean;
  ok: boolean;
  error?: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}

export interface NoticeReview {
  items: ItemResult[];
  providers: ProviderRun[];
  skippedProviders: { id: string; reason: string }[];
  agreementThreshold: number;
  totalCostUsd: number | null;
  costComplete: boolean;
  latencyMs: number;
  disclaimer: string;
}

export class ReviewError extends Error {
  readonly providers: ProviderRun[];
  constructor(message: string, providers: ProviderRun[] = []) {
    super(message);
    this.name = 'ReviewError';
    this.providers = providers;
  }
}

export const SYSTEM_PROMPT =
  'You are a data protection analyst. You check whether a privacy notice contains the information required by Article 13 GDPR. ' +
  'You only report what is written in the text. You never invent quotes. You answer with a single JSON object and nothing else.';

export function buildUserPrompt(noticeText: string): string {
  const checklist = ARTICLE_13_CHECKLIST.map((i) => `- ${i.id} (${i.article}): ${i.description}`).join('\n');
  return [
    'Check the privacy notice below against this checklist:',
    checklist,
    '',
    'For every checklist item return one status:',
    '- "present": the notice contains this information. Provide "evidence": an EXACT verbatim quote from the notice (max 300 characters), copied character for character.',
    '- "absent": the information is required in this context but missing.',
    '- "unclear": mentioned but incomplete or ambiguous.',
    '- "not_applicable": the text makes clear the item does not apply (for example, no consent-based processing).',
    '',
    'Answer with exactly this JSON shape:',
    '{"items":[{"id":"controller_identity","status":"present","evidence":"...","comment":"..."}]}',
    'Include every checklist id exactly once. Use null for evidence when status is not "present".',
    '',
    '<privacy_notice>',
    noticeText,
    '</privacy_notice>',
  ].join('\n');
}

/** Lowercase, unify quotes and dashes, collapse whitespace: tolerant to formatting, strict on wording. */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″«»]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract the first JSON object from a model reply (tolerates code fences and surrounding prose). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object found in model reply');
  return JSON.parse(candidate.slice(start, end + 1));
}

export function parseVotes(providerId: string, replyText: string, noticeText: string): Vote[] {
  const parsed = extractJson(replyText) as { items?: unknown };
  if (!Array.isArray(parsed.items)) throw new Error('model reply has no "items" array');
  const normalisedNotice = normalise(noticeText);
  const byId = new Map<string, Record<string, unknown>>();
  for (const raw of parsed.items) {
    if (raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).id === 'string') {
      byId.set((raw as Record<string, string>).id as string, raw as Record<string, unknown>);
    }
  }

  return ARTICLE_13_CHECKLIST.map((item) => {
    const raw = byId.get(item.id);
    const declared = raw?.status;
    let status: VoteStatus = VOTE_STATUSES.includes(declared as VoteStatus) ? (declared as VoteStatus) : 'unclear';
    const evidence = typeof raw?.evidence === 'string' && raw.evidence.trim() !== '' ? raw.evidence.trim() : null;
    const evidenceVerified = evidence !== null && normalisedNotice.includes(normalise(evidence));
    let downgraded = false;
    if (status === 'present' && !evidenceVerified) {
      status = 'unclear';
      downgraded = true;
    }
    const baseComment = typeof raw?.comment === 'string' ? raw.comment : raw ? '' : 'item missing from model reply';
    const comment = downgraded ? `${baseComment} [downgraded: evidence quote not found in the notice]`.trim() : baseComment;
    return { providerId, status, evidence, evidenceVerified, comment, downgraded };
  });
}

export function consensus(votes: Vote[], threshold: number): { consensus: ConsensusStatus; majorityStatus: VoteStatus | null; agreement: number } {
  if (votes.length === 0) return { consensus: 'needs_human_review', majorityStatus: null, agreement: 0 };
  const counts = new Map<VoteStatus, number>();
  for (const v of votes) counts.set(v.status, (counts.get(v.status) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [topStatus, topCount] = sorted[0] as [VoteStatus, number];
  const tie = sorted.length > 1 && (sorted[1] as [VoteStatus, number])[1] === topCount;
  const agreement = Math.round((topCount / votes.length) * 100) / 100;
  if (tie) return { consensus: 'needs_human_review', majorityStatus: null, agreement };
  return { consensus: agreement >= threshold ? topStatus : 'needs_human_review', majorityStatus: topStatus, agreement };
}

function costOf(p: LlmProvider, inputTokens: number | null, outputTokens: number | null): number | null {
  const { inputUsdPerMTok, outputUsdPerMTok } = p.config;
  if (inputUsdPerMTok === undefined || outputUsdPerMTok === undefined || inputTokens === null || outputTokens === null) return null;
  return Math.round(((inputTokens * inputUsdPerMTok + outputTokens * outputUsdPerMTok) / 1_000_000) * 1e6) / 1e6;
}

export async function reviewPrivacyNotice(noticeText: string, fusion: ResolvedFusion, now: () => number = Date.now): Promise<NoticeReview> {
  const text = noticeText.trim();
  if (text.length < 200) throw new ReviewError('privacy notice text is too short to review (minimum 200 characters)');
  if (text.length > MAX_NOTICE_CHARS) throw new ReviewError(`privacy notice text is too long (maximum ${MAX_NOTICE_CHARS} characters)`);
  if (fusion.providers.length < fusion.minSuccessfulProviders) {
    throw new ReviewError(
      `only ${fusion.providers.length} provider(s) available, ${fusion.minSuccessfulProviders} required; skipped: ${fusion.skipped.map((s) => `${s.id} (${s.reason})`).join('; ') || 'none'}`,
    );
  }

  const user = buildUserPrompt(text);
  const started = now();
  const settled = await Promise.all(
    fusion.providers.map(async (p) => {
      const t0 = now();
      const base = { providerId: p.config.id, model: p.config.model, euHosted: p.config.euHosted };
      try {
        const res = await p.complete({ system: SYSTEM_PROMPT, user });
        const votes = parseVotes(p.config.id, res.text, text);
        const run: ProviderRun = { ...base, ok: true, latencyMs: now() - t0, inputTokens: res.inputTokens, outputTokens: res.outputTokens, costUsd: costOf(p, res.inputTokens, res.outputTokens) };
        return { run, votes };
      } catch (err) {
        const run: ProviderRun = { ...base, ok: false, error: err instanceof Error ? err.message : String(err), latencyMs: now() - t0, inputTokens: null, outputTokens: null, costUsd: null };
        return { run, votes: null };
      }
    }),
  );

  const runs = settled.map((s) => s.run);
  const successful = settled.filter((s) => s.votes !== null);
  if (successful.length < fusion.minSuccessfulProviders) {
    throw new ReviewError(`only ${successful.length} provider(s) answered successfully, ${fusion.minSuccessfulProviders} required`, runs);
  }

  const items: ItemResult[] = ARTICLE_13_CHECKLIST.map((item, idx) => {
    const votes = successful.map((s) => (s.votes as Vote[])[idx] as Vote);
    return { id: item.id, article: item.article, description: item.description, ...consensus(votes, fusion.agreementThreshold), votes };
  });

  const costs = runs.map((r) => r.costUsd);
  const costComplete = costs.every((c) => c !== null);
  const known = costs.filter((c): c is number => c !== null);

  return {
    items,
    providers: runs,
    skippedProviders: fusion.skipped,
    agreementThreshold: fusion.agreementThreshold,
    totalCostUsd: known.length > 0 ? Math.round(known.reduce((a, b) => a + b, 0) * 1e6) / 1e6 : null,
    costComplete,
    latencyMs: now() - started,
    disclaimer:
      'Automated multi-model review of the notice text against Art. 13 GDPR. It does not check whether the statements are true, ' +
      'complete for your actual processing, or compliant with Art. 14 and national law. A lawyer must review the result.',
  };
}
