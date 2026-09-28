import type { CompanyProfile, AiSystem } from '../src/questionnaire/types.ts';

export function profile(overrides: Partial<CompanyProfile> = {}): CompanyProfile {
  return {
    company: { name: 'Test Co (fictional)', country: 'PL', establishedInEu: true, employees: 10 },
    aiSystems: [],
    ...overrides,
  };
}

export function system(overrides: Partial<AiSystem> = {}): AiSystem {
  return { id: 'sys-1', name: 'Test system', role: 'provider', euNexus: true, ...overrides };
}

export const ids = (findings: { id: string }[]) => findings.map((f) => f.id).sort();
