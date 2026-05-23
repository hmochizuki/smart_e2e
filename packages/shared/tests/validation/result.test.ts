import { describe, expect, it } from 'vitest';
import { ok, err, isOk, isErr } from '../../src/validation/result.js';
import type { Result } from '../../src/validation/result.js';

describe('Result helpers', () => {
  it('ok() returns { ok: true, value }', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBe(42);
    }
  });

  it('err() returns { ok: false, error }', () => {
    const r = err('boom');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe('boom');
    }
  });

  it('isOk narrows', () => {
    const r: Result<number, string> = ok(1);
    if (isOk(r)) {
      const v: number = r.value;
      expect(v).toBe(1);
    } else {
      throw new Error('should be ok');
    }
  });

  it('isErr narrows', () => {
    const r: Result<number, string> = err('e');
    if (isErr(r)) {
      const e: string = r.error;
      expect(e).toBe('e');
    } else {
      throw new Error('should be err');
    }
  });
});
