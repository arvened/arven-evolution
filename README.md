# ARVEN Evolution

Prototype of a compliance self-assessment service for the **EU AI Act** (Regulation (EU) 2024/1689) and the **GDPR** (Regulation (EU) 2016/679).

A company fills in a structured questionnaire about itself and its AI systems. The service classifies each AI system under the AI Act, lists every obligation that applies with its legal reference, compares that list with what the company declared, and produces a prioritised action list in JSON or Markdown.

An optional module (**Fusion**) asks several LLMs to review a privacy notice against Art. 13 GDPR, checks that every quote they give actually appears in the text, and combines their answers by majority vote.

> **Status: prototype (v0.1.0).** Not used by customers, not validated by a lawyer, not a conformity assessment tool. Every report says so. See [Limitations](#limitations).

---

## What works

| Part | What it does | Tested |
|---|---|---|
| AI Act engine | Scope (Art. 2), AI literacy (Art. 4), prohibited practices (Art. 5), high-risk classification (Art. 6 incl. Annex I, Annex III and the Art. 6(3) derogation), provider duties (Art. 9-17, 22, 43, 47-49, 72, 73), deployer duties (Art. 26, 27), transparency (Art. 50), general-purpose AI models (Art. 53-55) | Unit tests |
| GDPR engine | Controller duties (Art. 6, 8, 9, 12-22, 25, 27, 28, 30, 32-35), processor duties (Art. 28, 30(2), 32, 33(2)), DPO (Art. 37), transfers (Chapter V) | Unit tests |
| Scoring | Weighted, reproducible by hand; unanswered never counts as compliant | Unit tests |
| Reports | JSON and Markdown with legal references and recommendations | Unit tests |
| HTTP API | Zero-dependency Node.js server, optional API key, body size limit | Integration tests |
| CLI | Run an audit from a JSON file | CI |
| Fusion (LLM review) | Adapters for Anthropic, Gemini and any OpenAI-compatible API (Mistral, DeepSeek, Moonshot/Kimi, Nebius, vLLM ...); quote verification; consensus; token cost | Tested with mocked HTTP only. **Not yet run against real vendor APIs.** |

84 automated tests. No runtime dependencies.

## Quick start

Requires Node.js 22.18 or newer (runs TypeScript directly, no build step).

```bash
git clone https://github.com/arvened/arven-evolution.git
cd arven-evolution

# Run an audit from the command line
node src/cli/audit.ts examples/hr-screening-saas.json

# Start the API
ARVEN_API_KEY=change-me node src/server/index.ts
```

Development tools (type checking) and tests:

```bash
npm install        # installs TypeScript and Node types only
npm run typecheck
npm test
```

Docker:

```bash
docker compose up --build
```

## API

All `/api/*` routes require `Authorization: Bearer <ARVEN_API_KEY>` when `ARVEN_API_KEY` is set.

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness, and whether document review is configured |
| POST | `/api/audits` | Body: questionnaire JSON. Returns the full report (201), or 422 with a list of validation issues |
| GET | `/api/audits/{id}` | Report as JSON |
| GET | `/api/audits/{id}/report.md` | Report as Markdown |
| POST | `/api/reviews/privacy-notice` | Body: `{"text": "..."}`. Multi-LLM Art. 13 review. 503 when not configured |

```bash
curl -X POST http://localhost:3000/api/audits \
  -H "Authorization: Bearer change-me" \
  -H "Content-Type: application/json" \
  --data @examples/hr-screening-saas.json
```

Audits are stored in memory and lost on restart (see roadmap).

## The questionnaire

Types and field descriptions: [`src/questionnaire/types.ts`](src/questionnaire/types.ts). Examples: [`examples/`](examples/) (all companies are fictional).

Every control is an optional boolean:

- `true` : declared in place, finding status **met**
- `false` : declared not in place, finding status **gap**
- not answered : finding status **unknown** (never treated as met)

Unknown fields are rejected, so a typo cannot silently turn a "yes" into "unknown".

## Scoring

```
score          = sum of weights of "met" findings / sum of weights of all applicable findings * 100
weights        = critical 8, high 4, medium 2, low 1
answerCoverage = answered findings / applicable findings * 100
verdict        = critical_issues            if any critical finding is a gap
                 gaps_found                 if any finding is a gap or unknown
                 no_gaps_on_declared_facts  otherwise
```

"No gaps on declared facts" means only that: the company's own answers show no gap for the rules this engine knows. It is not a statement of compliance.

## Fusion: multi-LLM privacy notice review

1. Copy `fusion.config.example.json` to `fusion.config.json`. Fill in model IDs from each vendor's documentation (the code deliberately hardcodes none) and, optionally, prices per million tokens from the vendor price list.
2. Put API keys in environment variables named in `apiKeyEnv`. Keys never go into the config file; the loader refuses values that look like keys.
3. Run:

```bash
FUSION_CONFIG_FILE=fusion.config.json ANTHROPIC_API_KEY=... GEMINI_API_KEY=... \
  node src/cli/reviewNotice.ts examples/privacy-notice-sample.txt
```

How the result is built:

- Each model returns a status per Art. 13 item (`present`, `absent`, `unclear`, `not_applicable`) and, for `present`, a verbatim quote.
- A `present` vote whose quote is not found in the text is downgraded to `unclear` (hallucination guard).
- The item result is the majority vote if agreement is at least `agreementThreshold` (default 0.75); otherwise, or on a tie, `needs_human_review`.
- At least `minSuccessfulProviders` (default 2) must answer, otherwise the review fails with a per-provider error list.
- `requireEuHosting: true` excludes every provider not declared `euHosted`. The declaration is yours to verify with the vendor contract.

**Data protection:** the notice text is sent to every configured vendor. Do not send documents containing personal data to vendors without a data processing agreement and a valid transfer mechanism.

## Limitations

- **Legal content is not validated by a lawyer.** Rules were written from the regulation text; they need review by a qualified EU data protection / AI lawyer before any client use.
- **Declared facts only.** The engine does not inspect code, systems or documents (except the Fusion notice review). If the answers are wrong, the report is wrong.
- **No application dates.** AI Act deadlines are being changed by the Digital Omnibus package; the engine lists obligations, not when they start to apply. Check dates against the Official Journal.
- **Simplifications:** territorial scope is one declared flag; the content and quality of each obligation (for example whether a DPIA is adequate) are not assessed; Annex I sector procedures, national laws and GDPR Art. 14 are not covered.
- **Fusion** has not been run against live vendor APIs; response formats are implemented from vendor documentation and covered by mocked tests only. No accuracy figure exists yet.
- **Storage** is in memory.

## Roadmap

1. Legal review of every rule and recommendation.
2. First live run of Fusion with real API keys; measure agreement, cost and latency on a labelled set of real privacy notices.
3. Persistent storage (PostgreSQL) behind the existing `AuditStore` interface.
4. Further frameworks as separate engines (NIS2 scope, Cyber Resilience Act, DORA).
5. Web form for the questionnaire.

## Project layout

```
src/
  questionnaire/  types and strict validation of the input
  engines/        aiAct.ts, gdpr.ts, scoring.ts, runAudit.ts
  report/         Markdown rendering
  fusion/         LLM adapters, config, privacy notice review
  partners/       partner revenue split (pure function)
  store/          in-memory audit store
  server/         HTTP API
  cli/            command-line tools
tests/            node:test suites
examples/         fictional questionnaires and a sample privacy notice
```

## License

MIT, see [LICENSE](LICENSE).
