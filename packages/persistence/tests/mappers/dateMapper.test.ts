import { describe, expect, it } from 'vitest';
import {
  dateToEpochMs,
  epochMsToDate,
  nullableDateToEpochMs,
  epochMsToNullableDate,
  optionalToNullable,
  nullableToOptional,
  nullishToNullable,
  nullableDateInputToEpochMs,
} from '../../src/mappers/dateMapper.js';

describe('dateMapper', () => {
  describe('dateToEpochMs / epochMsToDate', () => {
    it('Date を epoch ms に変換し、戻せる', () => {
      const d = new Date('2026-05-22T01:23:45.678Z');
      const ms = dateToEpochMs(d);
      expect(ms).toBe(d.getTime());
      const back = epochMsToDate(ms);
      expect(back.toISOString()).toBe(d.toISOString());
    });
  });

  describe('nullableDateToEpochMs / epochMsToNullableDate', () => {
    it('null を null として通す', () => {
      expect(nullableDateToEpochMs(null)).toBeNull();
      expect(epochMsToNullableDate(null)).toBeNull();
    });

    it('Date <-> epoch ms 変換 (非null)', () => {
      const d = new Date('2026-01-01T00:00:00.000Z');
      const ms = nullableDateToEpochMs(d);
      expect(ms).toBe(d.getTime());
      const back = epochMsToNullableDate(ms);
      expect(back?.toISOString()).toBe(d.toISOString());
    });
  });

  describe('optionalToNullable / nullableToOptional', () => {
    it('undefined を null に', () => {
      expect(optionalToNullable(undefined)).toBeNull();
    });
    it('値はそのまま通す', () => {
      expect(optionalToNullable('a')).toBe('a');
    });
    it('null を undefined に', () => {
      expect(nullableToOptional(null)).toBeUndefined();
    });
    it('値はそのまま通す', () => {
      expect(nullableToOptional('b')).toBe('b');
    });
  });

  describe('nullishToNullable', () => {
    it('null は null', () => {
      expect(nullishToNullable(null)).toBeNull();
    });
    it('undefined も null', () => {
      expect(nullishToNullable(undefined)).toBeNull();
    });
    it('値はそのまま', () => {
      expect(nullishToNullable('x')).toBe('x');
    });
  });

  describe('nullableDateInputToEpochMs', () => {
    it('null は null', () => {
      expect(nullableDateInputToEpochMs(null)).toBeNull();
    });
    it('undefined も null', () => {
      expect(nullableDateInputToEpochMs(undefined)).toBeNull();
    });
    it('Date は ms', () => {
      const d = new Date('2026-05-23T00:00:00.000Z');
      expect(nullableDateInputToEpochMs(d)).toBe(d.getTime());
    });
  });
});
