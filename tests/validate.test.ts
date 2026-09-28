import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateProfile, ValidationError } from '../src/questionnaire/validate.ts';

const valid = () => ({
  company: { name: 'Test Co', country: 'PL', establishedInEu: true, employees: 3 },
  aiSystems: [{ id: 'a', name: 'A', role: 'provider', euNexus: true }],
});

function issuesOf(input: unknown): string[] {
  try {
    validateProfile(input);
    return [];
  } catch (err) {
    assert.ok(err instanceof ValidationError);
    return err.issues;
  }
}

describe('questionnaire validation', () => {
  it('accepts a minimal valid profile', () => {
    assert.deepEqual(issuesOf(valid()), []);
  });

  it('rejects a misspelled control instead of silently treating it as unanswered', () => {
    const input = valid();
    (input.aiSystems[0] as Record<string, unknown>).controls = { riskManagmentSystem: true };
    assert.deepEqual(issuesOf(input), ['aiSystems[0].controls.riskManagmentSystem: unknown field']);
  });

  it('reports missing required fields and wrong types', () => {
    const issues = issuesOf({ company: { name: '', country: 'Poland', establishedInEu: 'yes', employees: 2.5 }, aiSystems: 'none' });
    assert.ok(issues.includes('company.name: expected a non-empty string'));
    assert.ok(issues.includes('company.country: invalid format'));
    assert.ok(issues.includes('company.establishedInEu: expected true or false'));
    assert.ok(issues.includes('company.employees: expected an integer'));
    assert.ok(issues.includes('aiSystems: expected an array'));
  });

  it('rejects unknown enum values', () => {
    const input = valid();
    (input.aiSystems[0] as Record<string, unknown>).annexIIIAreas = ['employment', 'dating'];
    const issues = issuesOf(input);
    assert.equal(issues.length, 1);
    assert.match(issues[0] as string, /^aiSystems\[0\]\.annexIIIAreas\[1\]: expected one of/);
  });

  it('rejects duplicate system ids', () => {
    const input = valid();
    input.aiSystems.push({ id: 'a', name: 'B', role: 'deployer', euNexus: true });
    assert.deepEqual(issuesOf(input), ['aiSystems[1].id: duplicate id "a"']);
  });

  it('rejects non-object input', () => {
    assert.deepEqual(issuesOf(null), ['<root>: expected an object']);
    assert.deepEqual(issuesOf([]), ['<root>: expected an object']);
  });
});
