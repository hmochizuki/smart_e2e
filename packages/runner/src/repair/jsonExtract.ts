// LLM 出力からの JSON 抽出。コードフェンス対応 + 先頭の最初の '{' から末尾の '}' までを取る。
//
// 注意: 最初の '{' から最後の '}' までを切り出す素朴な実装。
// プロンプトで「JSON のみ出力」を強制している前提で、複数 JSON 混在や
// 本文中に '}' を含む文字列リテラルが来るケースは想定外。
// 失敗時は undefined を返し、上位で LLMResponseInvalidError として扱う。
export const extractJsonObject = (raw: string): string | null => {
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(raw);
  const source = fenced?.[1] ?? raw;
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return source.slice(start, end + 1);
};

export const tryParseJson = (raw: string): unknown => {
  const candidate = extractJsonObject(raw);
  if (candidate === null) return undefined;
  try {
    const parsed: unknown = JSON.parse(candidate);
    return parsed;
  } catch {
    return undefined;
  }
};
