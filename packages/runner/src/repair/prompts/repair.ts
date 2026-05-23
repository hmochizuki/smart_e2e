import type { ErrorClassification } from '@smart-e2e/shared';

export const REPAIR_SYSTEM_PROMPT = `あなたは Playwright E2E テストの自動修復エキスパートです。
入力された失敗テストを、分類カテゴリに沿った方針で完全に書き直してください。

- precondition: 既存データの有無に応じて分岐する「両パターン対応」スクリプトに書き換える
- ui_change: 失敗時のスクリーンショット/DOM から推測できる新セレクタに置換する

出力は次の JSON のみ。説明・コードフェンス・前後の解説は禁止:
{"script":"<完全な単一の Playwright テストファイル文字列>"}

スクリプトは test() を1つだけ含み、import 文も含めること。
`;

export const buildRepairUserPrompt = (input: {
  classification: ErrorClassification;
  script: string;
  errorMessage: string | null;
  errorStack: string | null;
  domSnapshot: string | null;
  consoleMessages: ReadonlyArray<string>;
}): string => {
  const sections = [
    `## 分類: ${input.classification}`,
    '',
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
