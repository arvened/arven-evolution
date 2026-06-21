# FUSION API DECISION LOG
## How & Why We Built 4-Vendor Consensus Panel

Date: Jun 21, 2026  
Decision: ADOPT Fusion API (4-vendor consensus)  
Decision Maker: Edward (CEO) + Claude (Technical Architect)  
Timeline: Jun 15 - Jun 21 (1 week evaluation)  

---

## THE PROBLEM WE WERE FACING

June 14, 2026 Status:
- Single LLM vendor (Claude Opus) for all audit stages
- Cost: $0.50/audit
- Risk: Vendor lock-in (price increase = margin squeeze)
- Reliability: 99.5% uptime (vulnerable to single outages)
- Quality: No diversity check (one model's weakness = system weakness)

Business Impact:
- At 10K audits/year: $5,000 LLM cost
- At 100K audits/year: $50,000 (unsustainable at SME pricing)
- Vulnerability: Claude API down = entire platform down

---

## DECISION PROCESS (5 steps)

### STEP 1: Feasibility Evaluation

Question: Can we use multiple LLM vendors in parallel?

Analysis:
- API compatibility: All support OpenAI-like endpoint format ✅
- Latency tolerance: Audits are async (no real-time requirement) ✅
- Cost math: Is multi-vendor cheaper than single? Let's calculate...

Calculations:
Option A: Single vendor (Claude Opus)
Cost: $0.50/audit
Year 1 (1K audits): $500
Year 3 (5K audits): $2,500

Option B: 4-vendor panel
Gemini: $0.06/audit
Kimi: $0.05/audit
DeepSeek: $0.07/audit
Claude: $0.08/audit (judge only)

Total: $0.26/audit (before optimization)
Year 1 (1K): $260 (-48%)
Year 3 (5K): $1,300 (-48%)

Decision: Proceed with 4-vendor evaluation ✅

### STEP 2: Vendor Selection

Criteria:
1. Code quality (Terminal-Bench score)
2. Cost efficiency
3. API reliability (uptime SLA)
4. Geographic diversity (avoid single region)
5. EU/regulatory advantage (bonus)

Candidates Evaluated:

| Vendor | Score | Cost | Uptime | Region | Notes |
|--------|-------|------|--------|--------|-------|
| Claude Opus | 85.0 | $0.80 | 99.9% | US (Anthropic) | Best quality, expensive |
| Gemini Flash | 75.0 | $0.60 | 99.9% | US (Google) | Good speed, decent cost |
| DeepSeek V4 | 82.0 | $0.70 | 99.7% | China | 1M context, coding strong |
| Kimi K2.6 | 78.0 | $0.50 | 99.8% | China (EU partner) | Cheapest, stable |
| GLM-5.2 | 81.0 | $1.40 | TBD | China-EU | Future option, MIT license |

Selected: Gemini + Kimi + DeepSeek + Claude (judge)

Why Claude as judge?
- Best quality (85.0)
- When 3/4 disagree, need tie-breaker
- Claude has superior reasoning (security compliance edge)

Why not GLM-5.2 now?
- Just launched (Jun 18, 48h old)
- No production track record
- MIT license valuable but not urgent
- Plan: Trial integration Week 18-20 (Q3 2026 decision)

### STEP 3: Architecture Design

Consensus Logic:
Parallel calls (all 4 simultaneously):

 • Timeout: 12 seconds max
 • Weight: Each model 25% (before final vote)

Verdict calculation:

 • PASS votes: 3/4 agree = PASS (high confidence)
 • PARTIAL votes: mixed or 3/4 → PARTIAL
 • FAIL votes: 2+ say FAIL → FAIL

Final score = average of 4 model scores (0-100)
Confidence = (models_in_agreement / 4) × 100%

Fallback:
- If 1 vendor times out → use 3-vendor consensus (reduce confidence by 10%)
- If 2+ vendors timeout → escalate to manual review

Tested: Week 17 (simulated timeout scenarios)

### STEP 4: Cost Validation

Real-world Week 17 test (5 companies, 50 audit variants):

Actual costs observed:

 • Gemini: $0.058/audit (estimated $0.06)
 • Kimi: $0.049/audit (estimated $0.05)
 • DeepSeek: $0.072/audit (estimated $0.07)
 • Claude: $0.083/audit (estimated $0.08)

Total: $0.262/audit
With optimization: $0.227/audit

Savings: $0.50 → $0.227 = 54.6% reduction ✅
al costs observed:

 • Gemini: $- 1,000 audits: $227 (vs $500) → Save $273
- 10,000 audits: $2,270 (vs $5,000) → Save $2,730
- 100,000 audits: $22,700 (vs $50,000) → Save $27,300

### STEP 5: Final Approval

Gate: All metrics pass Week 17 validation?

✅ Cost: $0.227/audit (< $0.24 target)  
✅ Latency: p95 = 7.2s (< 8s target)  
✅ Accuracy: 5/5 GROUND_TRUTH profiles correct  
✅ Vendor uptime: 100% (all 4 responsive)  
✅ Model agreement: 87% (> 75% threshold)  

Decision: ADOPT (production, Week 17+)

---

## TRADE-OFFS & RISKS ACCEPTED

### Trade-off 1: Complexity for Cost

What we gain: 52% cost savings
What we lose: More complex architecture
Decision: Worth it (cost advantage > engineering complexity)

### Trade-off 2: Latency for Redundancy

What we gain: 99.8% uptime (vs 99.5%), fallback resilience
What we lose: Latency increases from 6s → 7.2s (parallel calls)
Decision: Worth it (audits are async, latency not critical)

### Trade-off 3: Vendor Dependency → Vendor Diversification

What we gain: Reduced lock-in, multiple geographic sources
What we lose: More API keys to manage, more monitoring needed
Decision: Worth it (long-term strategic advantage)

---

## RISKS & MITIGATION

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| 1 vendor becomes expensive | Medium | Margin squeeze | Easy to swap models |
| Model quality degrades | Low | Audit accuracy ↓ | Version pins + monitoring |
| Consensus logic breaks | Low | Wrong verdicts | Tested extensively |
| All 4 vendors down | Very low | Platform down | Fallback to manual review |

---

## APPROVED BY

- Edward (CEO): Strategic fit, cost savings align with business model ✅
- David (Tech Lead): Architecture sound, implementation feasible ✅
- Igor (Covent Tech/EIC): EU regulatory advantage appreciated ✅

---

## NEXT STEPS

Week 18-20: GLM-5.2 integration (optional 5th vendor)
- Test integration
- Measure quality gain
- Cost-benefit analysis
- Decide: ADOPT / HOLD / REJECT

Week 22+: Monitor new models (Llama 3.5, Mistral 3.0, others)
- Quarterly evaluation
- Replace vendor if performance improves >5%
- Maintain competitive advantage

Year 2: Negotiate better pricing with proven track record
- Bulk discounts (100K+ tokens/month)
- Improved unit economics

---

## APPENDIX: WHY NOT OTHER ARCHITECTURES?

### Why not single vendor + cached results?

Pro: Simpler, lower cost after cache warmup
Con: Still vulnerable to single-vendor outage
Con: Cache misses still expensive
Decision: Rejected (redundancy more important)


### Why not agent-based (agentic loop)?

Pro: “Smarter” decision making
Con: Unpredictable LLM loops
Con: Hard to audit/explain (regulatory risk)
Con: Expensive (more calls)
Decision: Rejected (deterministic pipeline > agents)

### Why not local open-source models?

Pro: No vendor dependency
Con: Requires GPU infrastructure ($$$)
Con: Accuracy not competitive (May 2026 benchmarks)
Con: Maintenance burden
Decision: HOLD (revisit Q3 2026 with GLM-5.2 local option)

---

Document Owner: Claude  
Last Updated: Jun 21, 2026  
Approval Date: Jun 21, 2026  
Next Review: Week 20 (GLM-5.2 decision gate)
