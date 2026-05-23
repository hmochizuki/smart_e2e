// 軽量 unified diff。LCS は使わず、行ベースのナイーブ実装。
// 履歴の人間可読性が目的で、適用 (patch) 用途ではない。
const FILE_HEADER = (label: string): string => `--- ${label}\n+++ ${label}\n`;

export const simpleUnifiedDiff = (before: string, after: string, label = 'script'): string => {
  const a = before.split('\n');
  const b = after.split('\n');
  const max = Math.max(a.length, b.length);
  const lines: string[] = [];
  for (let i = 0; i < max; i += 1) {
    const left = a[i];
    const right = b[i];
    if (left === right) {
      if (left !== undefined) lines.push(` ${left}`);
      continue;
    }
    if (left !== undefined) lines.push(`-${left}`);
    if (right !== undefined) lines.push(`+${right}`);
  }
  if (lines.length === 0) return '';
  return `${FILE_HEADER(label)}${lines.join('\n')}\n`;
};
