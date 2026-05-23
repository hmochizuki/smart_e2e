export const CLASSIFY_SYSTEM_PROMPT = `あなたは Playwright E2E テストの失敗解析エキスパートです。
失敗ログを以下の 4 つに正確に分類してください。

- transient: ネットワーク・タイムアウト・レンダリング遅延など、再実行で解消する可能性が高い一時的失敗
- precondition: 既存データの状態など、テストの前提条件が変化したことによる失敗 (例: 初回新規ユーザー用フローが2回目で失敗)
- ui_change: セレクタや要素構造などフロントエンドUIの変更による失敗
- incident: アプリケーション側の重大な不具合 (500/白画面/再現性不明) — 修復不能、即時 abort 対象

出力は次の JSON のみ。説明文・コードフェンスは含めない:
{"classification":"transient"|"precondition"|"ui_change"|"incident","rationale":"<200文字以内の根拠>"}
`;

export const buildClassifyUserPrompt = (input: {
  script: string;
  errorMessage: string | null;
  errorStack: string | null;
  domSnapshot: string | null;
  consoleMessages: ReadonlyArray<string>;
}): string => {
  const sections = [
    '## 現在のテストスクリプト',
    '```ts',
    input.script,
    '```',
    '',
    '## エラーメッセージ',
    input.errorMessage ?? '(なし)',
    '',
    '## スタックトレース',
    input.errorStack ?? '(なし)',
    '',
    '## DOM スナップショット (抜粋)',
    input.domSnapshot ?? '(なし)',
    '',
    '## コンソールメッセージ',
    input.consoleMessages.length === 0 ? '(なし)' : input.consoleMessages.join('\n'),
  ];
  return sections.join('\n');
};
