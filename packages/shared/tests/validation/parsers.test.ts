import { describe, expect, it } from 'vitest';
import {
  parseSuite,
  parseStep,
  parseSuiteRun,
  parseStepRun,
  parseRepairAttempt,
  parseScriptHistory,
  parseRunnerEvent,
} from '../../src/validation/parsers.js';

const id = '00000000-0000-4000-8000-000000000000';
const suiteId = '11111111-1111-4111-8111-111111111111';
const stepId = '22222222-2222-4222-8222-222222222222';
const stepRunId = '33333333-3333-4333-8333-333333333333';
const suiteRunId = '44444444-4444-4444-8444-444444444444';

describe('parseSuite', () => {
  it('valid → ok', () => {
    const r = parseSuite({
      id,
      name: 'x',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(r.ok).toBe(true);
  });

  it('invalid → err with ZodError', () => {
    const r = parseSuite({ id: 'invalid' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.issues.length).toBeGreaterThan(0);
    }
  });
});

describe('parseStep', () => {
  it('valid → ok', () => {
    const r = parseStep({
      id,
      suiteId,
      order: 0,
      name: 'step',
      script: "test('x', async () => {});",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(r.ok).toBe(true);
  });

  it('invalid → err', () => {
    const r = parseStep({});
    expect(r.ok).toBe(false);
  });
});

describe('parseSuiteRun', () => {
  it('valid → ok', () => {
    const r = parseSuiteRun({
      id,
      suiteId,
      status: 'running',
      startedAt: new Date(),
      finishedAt: null,
    });
    expect(r.ok).toBe(true);
  });
});

describe('parseStepRun', () => {
  it('valid → ok', () => {
    const r = parseStepRun({
      id,
      suiteRunId,
      stepId,
      status: 'pending',
      attempts: 1,
      startedAt: new Date(),
      finishedAt: null,
      finalScript: "test('x', async () => {});",
    });
    expect(r.ok).toBe(true);
  });
});

describe('parseRepairAttempt', () => {
  it('valid → ok', () => {
    const r = parseRepairAttempt({
      id,
      stepRunId,
      n: 1,
      classification: 'ui_change',
      errorLog: 'err',
      screenshotPath: null,
      domSnapshot: null,
      llmInputScript: "test('x', async () => {});",
      llmOutputScript: "test('y', async () => {});",
      result: 'success',
      createdAt: new Date(),
    });
    expect(r.ok).toBe(true);
  });
});

describe('parseScriptHistory', () => {
  it('valid → ok', () => {
    const r = parseScriptHistory({
      id,
      stepId,
      script: "test('x', async () => {});",
      source: 'codegen',
      sourceRepairAttemptId: null,
      createdAt: new Date(),
    });
    expect(r.ok).toBe(true);
  });
});

describe('parseRunnerEvent', () => {
  it('valid → ok', () => {
    const r = parseRunnerEvent({
      type: 'suite_started',
      suiteRunId,
      suiteId,
      startedAt: new Date(),
    });
    expect(r.ok).toBe(true);
  });

  it('invalid type → err', () => {
    const r = parseRunnerEvent({ type: 'unknown' });
    expect(r.ok).toBe(false);
  });
});
