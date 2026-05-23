import { describe, expect, it } from 'vitest';
import { byteLength, formatBytes, formatDateTime } from '../../src/lib/format.js';

describe('formatBytes', () => {
  it('1024未満は B', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
  });
  it('KB レンジ', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
  });
  it('MB レンジ', () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});

describe('byteLength', () => {
  it('ASCII は文字数と同じ', () => {
    expect(byteLength('abc')).toBe(3);
  });
  it('日本語は UTF-8 で 3 バイト', () => {
    expect(byteLength('あ')).toBe(3);
  });
});

describe('formatDateTime', () => {
  it('ISO 文字列を整形する', () => {
    const out = formatDateTime('2026-05-22T01:30:00.000Z');
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
  it('不正な文字列はそのまま返す', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
  });
});
