import { describe, expect, it } from 'vitest';
import { extractJsonObject, tryParseJson } from '../../src/repair/jsonExtract.js';

describe('extractJsonObject', () => {
  it('プレーンな JSON 文字列をそのまま返す', () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
  });

  it('コードフェンス付き JSON から中身を取り出す', () => {
    const got = extractJsonObject('```json\n{"a":1}\n```');
    expect(got).toBe('{"a":1}');
  });

  it('JSON が含まれない場合 null', () => {
    expect(extractJsonObject('no json here')).toBeNull();
  });

  it('複数 JSON 混在は素朴に最初の { から最後の } を返す (既知の制約)', () => {
    // 仕様: 最終的に tryParseJson が JSON.parse 失敗で undefined にする想定
    const got = extractJsonObject('{"a":1} text {"b":2}');
    // 最初の { から最後の } まで丸ごと返るため、それ単体は有効 JSON ではない
    expect(got).toBe('{"a":1} text {"b":2}');
    expect(tryParseJson('{"a":1} text {"b":2}')).toBeUndefined();
  });
});

describe('tryParseJson', () => {
  it('有効 JSON はオブジェクトに戻る', () => {
    const got = tryParseJson('{"x":2}');
    expect(got).toEqual({ x: 2 });
  });

  it('複数 JSON 混在は JSON.parse 失敗で undefined になる (既知の制約)', () => {
    // jsonExtract の素朴な切り出しで「最初の { から最後の } まで」が選ばれ、
    // 中間の文字列が JSON として無効になるため undefined。
    // 上位は LLMResponseInvalidError として扱う想定。
    expect(tryParseJson('{"a":1} noise {"b":2}')).toBeUndefined();
  });

  it('全くの非 JSON は undefined', () => {
    expect(tryParseJson('hi there')).toBeUndefined();
  });
});
