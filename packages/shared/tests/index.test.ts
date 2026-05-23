import { describe, expect, it } from 'vitest';
import {
  SuiteSchema,
  RunnerEventSchema,
  parseSuite,
  MAX_REPAIR_ATTEMPTS,
  DEFAULT_STEP_TIMEOUT_MS,
  SCRIPT_MAX_CHARS,
} from '../src/index.js';

describe('public barrel', () => {
  it('exports SuiteSchema', () => {
    expect(SuiteSchema).toBeDefined();
  });

  it('exports RunnerEventSchema', () => {
    expect(RunnerEventSchema).toBeDefined();
  });

  it('exports parseSuite', () => {
    expect(typeof parseSuite).toBe('function');
  });

  it('exports constants', () => {
    expect(MAX_REPAIR_ATTEMPTS).toBe(3);
    expect(DEFAULT_STEP_TIMEOUT_MS).toBe(60_000);
    expect(SCRIPT_MAX_CHARS).toBe(100 * 1024);
  });
});
