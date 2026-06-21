2 optional integration (5th panel member)
 • Local inference evaluation (if EIC grant funding allows)

MONITORING & METRICS

Dashboard Queries
-- Weekly cost report
SELECT 
  DATE(created_at) as date,
  COUNT(*) as audit_count,
  AVG(cost_usd) as avg_cost,
  AVG(latency_ms) as avg_latency,
  AVG(agreement_percentage) as avg_agreement
FROM fusion_api_calls
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at);

-- Model performance comparison
SELECT 
  model,
  COUNT(*) as calls,
  AVG(response_quality) as avg_quality,
  AVG(latency_ms) as avg_latency,
  ROUND(100 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM model_performance
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY model;
KPIs

|KPI            |Target|Actual (Week 17)|Status|
|---------------|------|----------------|------|
|Cost per audit |≤$0.24|$0.227          |✅     |
|Latency p95    |<8s   |7.2s            |✅     |
|Vendor uptime  |99.5% |100%            |✅     |
|Model agreement|>75%  |87%             |✅     |
|Error rate     |<0.1% |0%              |✅     |
TROUBLESHOOTING

Issue: One vendor timing out

Solution: Fallback circuit breaker automatically switches to next vendor. No user-facing impact.

Issue: High latency (>10s)

Solution: Check which model is slow. Increase timeout or reduce context window. Consider removing slow model from panel.

Issue: Disagreement between models (>25%)

Solution: Normal for edge cases. Escalate to human review. Track disagreement patterns to improve prompts.

Issue: Cost higher than expected

Solution: Review token usage per model. Optimize prompts to reduce input tokens. Consider caching frequently-used contexts.

FUTURE: GLM-5.2 INTEGRATION

Q3 2026 plan:
Current: 4-vendor panel (Gemini, Kimi, DeepSeek, Claude judge)
Future:  5-vendor panel (+ GLM-5.2)

Changes:
- Add GLM client library (zai-sdk)
- Update consensus voting (5 models, still majority rule)
- Panel weights: adjust to 20% each (vs 25% now)
- Cost impact: +$0.12/audit (minor)
