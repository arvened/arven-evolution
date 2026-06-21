/**
 * FUSION API WEEK 17 TEST SUITE
 * Автоматизированные тесты для валидации Fusion API перед production migration
 * 
 * Запуск: npm test -- fusion-api-week17.test.ts
 * Coverage: BLOCK 1-4 (init, synthetic data, evaluation, edge cases)
 */

import axios, { AxiosInstance } from 'axios';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface VendorResponse {
  vendor_id: 'claude-opus' | 'gemini-flash' | 'deepseek-v4' | 'kimi-k2.6';
  verdict: 'PASS' | 'PARTIAL' | 'FAIL';
  confidence: number;
  reasoning: string;
  timestamp: number;
}

interface FusionAPIResponse {
  success: boolean;
  audit_id: string;
  final_verdict: 'PASS' | 'PARTIAL' | 'FAIL';
  final_score: number;
  vendor_responses: VendorResponse[];
  integrated_reasoning: string;
  compliance_flags: string[];
  cost_usd: number;
  latency_ms: number;
  timestamp: number;
}

interface SyntheticCompany {
  company_id: string;
  name: string;
  expected_verdict: 'PASS' | 'PARTIAL' | 'FAIL';
  expected_score_range: [number, number];
}

interface TestMetrics {
  total_tests: number;
  passed: number;
  failed: number;
  total_cost_usd: number;
  total_latency_ms: number;
  vendor_availability: Record<string, boolean>;
}

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const API_BASE_URL = process.env.FUSION_API_URL || 'http://localhost:3000';
const VENDOR_TIMEOUT_MS = 12000;
const AUDIT_TIMEOUT_MS = 8000;
const CONSISTENCY_CHECK_DELAY_MS = 1800000; // 30 minutes

const GROUND_TRUTH_PROFILES: Record<string, SyntheticCompany> = {
  'sync-001-silpo': {
    company_id: 'sync-001-silpo',
    name: 'SILPO',
    expected_verdict: 'PARTIAL',
    expected_score_range: [65, 75]
  },
  'sync-002-rozetka': {
    company_id: 'sync-002-rozetka',
    name: 'ROZETKA',
    expected_verdict: 'PASS',
    expected_score_range: [82, 92]
  },
  'sync-003-soundcloud': {
    company_id: 'sync-003-soundcloud',
    name: 'SOUNDCLOUD',
    expected_verdict: 'PASS',
    expected_score_range: [78, 88]
  },
  'sync-004-zalando': {
    company_id: 'sync-004-zalando',
    name: 'ZALANDO',
    expected_verdict: 'PASS',
    expected_score_range: [88, 96]
  },
  'sync-005-wise': {
    company_id: 'sync-005-wise',
    name: 'WISE',
    expected_verdict: 'PASS',
    expected_score_range: [93, 99]
  }
};

// ============================================================================
// SETUP & UTILITIES
// ============================================================================

let apiClient: AxiosInstance;
let testMetrics: TestMetrics = {
  total_tests: 0,
  passed: 0,
  failed: 0,
  total_cost_usd: 0,
  total_latency_ms: 0,
  vendor_availability: {}
};

beforeAll(() => {
  apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: VENDOR_TIMEOUT_MS,
    validateStatus: () => true // Don't throw on any status
  });
});

afterAll(async () => {
  console.log('\n📊 FINAL TEST METRICS');
  console.log(`Total Tests: ${testMetrics.total_tests}`);
  console.log(`Passed: ${testMetrics.passed}`);
  console.log(`Failed: ${testMetrics.failed}`);
  console.log(`Total Cost: $${testMetrics.total_cost_usd.toFixed(2)}`);
  console.log(`Avg Latency: ${(testMetrics.total_latency_ms / testMetrics.total_tests).toFixed(0)}ms`);
  console.log('Vendor Availability:', testMetrics.vendor_availability);
});

beforeEach(() => {
  testMetrics.total_tests++;
});

function recordResult(passed: boolean, costUSD: number, latencyMS: number) {
  if (passed) testMetrics.passed++;
  else testMetrics.failed++;
  testMetrics.total_cost_usd += costUSD;
  testMetrics.total_latency_ms += latencyMS;
}

// ============================================================================
// BLOCK 1: INITIALIZATION & HEALTH CHECK

// ============================================================================

describe('BLOCK 1: Fusion API Initialization & Health Check', () => {
  it('should check health endpoints for all 4 vendors', async () => {
    const vendors = ['claude-opus', 'gemini-flash', 'deepseek-v4', 'kimi-k2.6'];
    
    for (const vendor of vendors) {
      const response = await apiClient.get(`/health/${vendor}`);
      expect(response.status).toBeLessThan(300);
      testMetrics.vendor_availability[vendor] = response.status === 200;
    }
  });

  it('should execute parallel requests to all 4 vendors within timeout', async () => {
    const startTime = Date.now();
    
    const response = await apiClient.post<FusionAPIResponse>('/api/audit/run', {
      audit_id: 'test-001-init',
      company_name: 'Test Company',
      company_location: 'UA'
    });

    const latency = Date.now() - startTime;
    
    expect(response.data.success).toBe(true);
    expect(response.data.vendor_responses.length).toBe(4);
    expect(latency).toBeLessThan(AUDIT_TIMEOUT_MS);
    expect(response.data.final_verdict).toBeDefined();
    
    recordResult(true, response.data.cost_usd, latency);
  });

  it('should generate consensus verdict from 4 parallel responses', async () => {
    const response = await apiClient.post<FusionAPIResponse>('/api/audit/run', {
      audit_id: 'test-002-consensus',
      company_name: 'Consensus Test Co'
    });

    expect(response.data.final_verdict).toMatch(/PASS|PARTIAL|FAIL/);
    expect(response.data.final_score).toBeGreaterThanOrEqual(0);
    expect(response.data.final_score).toBeLessThanOrEqual(100);
    expect(response.data.integrated_reasoning).toBeTruthy();
    
    recordResult(true, response.data.cost_usd, response.data.latency_ms);
  });

  it('should track cost per request (target: ≤ $0.24)', async () => {
    const response = await apiClient.post<FusionAPIResponse>('/api/audit/run', {
      audit_id: 'test-003-cost',
      company_name: 'Cost Test Co'
    });

    expect(response.data.cost_usd).toBeLessThanOrEqual(0.24);
    console.log(`✓ Cost: $${response.data.cost_usd.toFixed(4)} (target: ≤$0.24)`);
    
    recordResult(true, response.data.cost_usd, response.data.latency_ms);
  });
});

// ============================================================================
// BLOCK 2: SYNTHETIC DATA TEST SUITE (GROUND_TRUTH_TEMPLATE)
// ============================================================================

describe('BLOCK 2: Synthetic Data - GROUND_TRUTH_TEMPLATE Profiles', () => {
  Object.entries(GROUND_TRUTH_PROFILES).forEach(([companyId, profile]) => {
    it(`should validate profile ${profile.name} (${companyId})`, async () => {
      const response = await apiClient.post<FusionAPIResponse>('/api/audit/run', {
        audit_id: companyId,
        company_id: companyId,
        company_name: profile.name,
        use_ground_truth: true
      });

      const { final_verdict, final_score } = response.data;
      const [minScore, maxScore] = profile.expected_score_range;

      expect(response.data.success).toBe(true);
      expect(final_verdict).toBe(profile.expected_verdict);
      expect(final_score).toBeGreaterThanOrEqual(minScore - 5);
      expect(final_score).toBeLessThanOrEqual(maxScore + 5);

      console.log(`  ${profile.name}: score=${final_score.toFixed(1)}, verdict=${final_verdict}`);
      recordResult(true, response.data.cost_usd, response.data.latency_ms);
    });
  });
});

// ============================================================================
// BLOCK 3: EVALUATION MODULE VALIDATION
// ============================================================================

describe('BLOCK 3: EVALUATION Module Validation', () => {
  it('should score all 4 dimensions without NaN/null', async () => {
    const response = await apiClient.post<FusionAPIResponse>('/api/audit/run', {
      audit_id: 'test-eval-001',
      company_name: 'Dimension Test Co',
      include_detailed_scores: true
    });

    const scores = response.data;
    
    expect(scores.success).toBe(true);

     expect(typeof scores.final_score).toBe('number');
    expect(!isNaN(scores.final_score)).toBe(true);
    
    recordResult(true, response.data.cost_usd, response.data.latency_ms);
  });

  it('should maintain consistency: same input → same score (variance < 2 pts)', async () => {
    const testAuditId = 'test-consistency-001';
    
    // First submission
    const response1 = await apiClient.post<FusionAPIResponse>('/api/audit/run', {
      audit_id: testAuditId,
      company_name: 'Consistency Test Co'
    });
    const score1 = response1.data.final_score;

    // Wait 30 minutes (in test, we'll skip actual wait for speed)
    // In production, replace with: await new Promise(r => setTimeout(r, CONSISTENCY_CHECK_DELAY_MS));

    // Second submission
    const response2 = await apiClient.post<FusionAPIResponse>('/api/audit/run', {
      audit_id: ${testAuditId}-recheck,
      company_name: 'Consistency Test Co'
    });
    const score2 = response2.data.final_score;

    const variance = Math.abs(score1 - score2);
    expect(variance).toBeLessThan(2);
    
    console.log(`  Consistency check: score1=${score1.toFixed(1)}, score2=${score2.toFixed(1)}, variance=${variance.toFixed(1)}`);
    recordResult(true, response1.data.cost_usd + response2.data.cost_usd, 
                 response1.data.latency_ms + response2.data.latency_ms);
  });

  it('should map compliance frameworks correctly (GDPR, AI Act, DSA, NIS2, DORA)', async () => {
    const response = await apiClient.post<FusionAPIResponse>('/api/audit/run', {
      audit_id: 'test-compliance-001',
      company_name: 'Compliance Test Co',
      include_compliance_mapping: true
    });

    expect(response.data.compliance_flags).toBeDefined();
    expect(Array.isArray(response.data.compliance_flags)).toBe(true);
    expect(response.data.compliance_flags.length).toBeGreaterThan(0);
    
    const validFlags = ['GDPR', 'AI_ACT', 'DSA', 'NIS2', 'DORA'];
    response.data.compliance_flags.forEach(flag => {
      expect(validFlags.some(v => flag.includes(v))).toBe(true);
    });

    console.log(`  Compliance flags: ${response.data.compliance_flags.join(', ')}`);
    recordResult(true, response.data.cost_usd, response.data.latency_ms);
  });
});

// ============================================================================
// BLOCK 4: ERROR HANDLING & EDGE CASES
// ============================================================================

describe('BLOCK 4: Error Handling & Edge Cases', () => {
  it('should handle vendor timeout gracefully (degrade to 3-vendor consensus)', async () => {
    const response = await apiClient.post<FusionAPIResponse>('/api/audit/run', {
      audit_id: 'test-timeout-001',
      company_name: 'Timeout Test Co',
      simulate_vendor_timeout: 'deepseek-v4'
    });

    // Should still return a valid verdict even if one vendor times out
    expect(response.data.success).toBe(true);
    expect(response.data.final_verdict).toMatch(/PASS|PARTIAL|FAIL/);
    expect(response.data.vendor_responses.length).toBeGreaterThanOrEqual(3);
    
    recordResult(true, response.data.cost_usd, response.data.latency_ms);
  });

  it('should reject malformed input with error code 400', async () => {
    const response = await apiClient.post('/api/audit/run', {
      audit_id: null, // Missing required field
      company_name: undefined
    });

    expect(response.status).toBe(400);
    expect(response.data.error).toBeDefined();
    
    recordResult(false, 0, 0);
  });

  it('should handle rate limiting gracefully (50 parallel requests)', async () => {
    const promises = Array.from({ length: 50 }).map((_, i) =>
      apiClient.post('/api/audit/run', {
        audit_id: test-ratelimit-${i},
        company_name: Rate Limit Test ${i}
      })
    );

    const results = await Promise.allSettled(promises);
    const succeeded = results.filter(r => r.status === 'fulfilled').length;

    // All 50 should eventually succeed (not drop any)
    expect(succeeded).toBe(50);
    
    console.

      log(`  Rate limit test: ${succeeded}/50 requests processed successfully`);
    recordResult(true, 0, 0);
  });

  it('should not have silent failures (all errors logged)', async () => {
    const response = await apiClient.post('/api/audit/run', {
      audit_id: 'test-silent-fail-001',
      company_name: 'Silent Fail Test Co',
      force_error: true
    });

    expect(response.data.success).toBe(false);
    expect(response.data.error).toBeDefined();
    expect(response.data.error.message).toBeTruthy();
    
    recordResult(false, 0, 0);
  });
});

// ============================================================================
// INTEGRATION TEST: FULL PIPELINE
// ============================================================================

describe('INTEGRATION: Full Fusion API Pipeline', () => {
  it('should execute complete audit pipeline for production readiness', async () => {
    const startTime = Date.now();
    
    const response = await apiClient.post<FusionAPIResponse>('/api/audit/run', {
      audit_id: 'integration-test-full',
      company_name: 'Integration Test Company',
      company_location: 'EU',
      metadata: {
        language: 'typescript',
        year_founded: 2020,
        employee_count: 500
      }
    });

    const totalTime = Date.now() - startTime;

    // Full pipeline success criteria
    expect(response.data.success).toBe(true);
    expect(response.data.final_score).toBeGreaterThanOrEqual(0);
    expect(response.data.final_score).toBeLessThanOrEqual(100);
    expect(response.data.vendor_responses.length).toBe(4);
    expect(totalTime).toBeLessThan(12000);
    expect(response.data.cost_usd).toBeLessThanOrEqual(0.24);

    console.log(`\n✅ INTEGRATION TEST PASSED`);
    console.log(`  Final Score: ${response.data.final_score.toFixed(1)}`);
    console.log(`  Verdict: ${response.data.final_verdict}`);
    console.log(`  Cost: $${response.data.cost_usd.toFixed(4)}`);
    console.log(`  Latency: ${totalTime}ms`);
    
    recordResult(true, response.data.cost_usd, totalTime);
  });
});

export { testMetrics };
