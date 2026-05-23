/**
 * このプロジェクトは oxlint と ESLint の二段構成
 * - oxlint: 広域構文ルール (any禁止, as禁止, import/no-cycle 等) — 高速、デフォルト
 * - ESLint: type-aware ルールのみ (no-floating-promises 等) — 型情報必要なルールに限定
 * - 重複ルールは oxlint 側に一本化し、ESLint には書かない
 * 詳細: docs/decisions/0001-tech-stack.md
 *
 * 注意: type-aware ルールは依存パッケージの dist/d.ts を見るので、
 * このプロジェクトでは turbo の lint タスクに dependsOn: ['^build'] を付けて
 * shared のビルドが先行するようにしている。
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  // projectService を使うことで tsconfig.json の include に依存しない動的解決にする。
  // 新規ファイル追加時にも parser が落ちないため、複数エージェントで並行作業しても安定。
  parserOptions: {
    projectService: true,
    tsconfigRootDir: __dirname,
    sourceType: 'module',
    ecmaVersion: 2022,
  },
  plugins: ['@typescript-eslint', 'import'],
  settings: {
    'import/resolver': {
      typescript: {
        project: [
          './packages/shared/tsconfig.json',
          './packages/runner/tsconfig.json',
          './packages/persistence/tsconfig.json',
          './packages/app/tsconfig.json',
        ],
      },
      node: true,
    },
  },
  rules: {
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/require-await': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    // workspace 境界の循環検出 (oxlint の import/no-cycle はファイル内のみ見るため ESLint 側でも担保)
    'import/no-cycle': ['error', { maxDepth: 1 }],
  },
  overrides: [
    {
      // shared は最下位レイヤなので、上位パッケージへの import を禁止
      files: ['packages/shared/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@smart-e2e/runner', '@smart-e2e/persistence', '@smart-e2e/app'],
                message: 'shared から上位パッケージを import 不可',
              },
            ],
          },
        ],
      },
    },
  ],
  ignorePatterns: [
    'node_modules',
    'dist',
    'build',
    'coverage',
    '.turbo',
    '**/*.cjs',
    '**/*.config.ts',
    '**/*.config.js',
    '**/vitest.workspace.ts',
  ],
};
