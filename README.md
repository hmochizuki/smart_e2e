# smart_e2e

自己修復する E2E テスト基盤ツール。Playwright で録画した操作を保存・実行し、失敗時に LLM が自動修復するまでを 1つの Tauri アプリで完結させる。

## 構成

- [docs/architecture.md](./docs/architecture.md) 全体像
- [docs/decisions/0001-tech-stack.md](./docs/decisions/0001-tech-stack.md) 技術選定 ADR

### パッケージ

| パッケージ                                         | 役目                               |
| -------------------------------------------------- | ---------------------------------- |
| [`@smart-e2e/shared`](./packages/shared)           | zod 型/スキーマ定義 (共通ドメイン) |
| [`@smart-e2e/runner`](./packages/runner)           | Playwright 実行 + LLM 自動修復     |
| [`@smart-e2e/persistence`](./packages/persistence) | SQLite + Drizzle ORM               |
| [`@smart-e2e/app`](./packages/app)                 | Tauri アプリ本体 (TS BE + React)   |

## セットアップ

前提: Node 20+, pnpm 9+, Rust toolchain (`rustup`)。

```sh
pnpm install
pnpm exec lefthook install   # 通常は pnpm install で自動実行されるが念のため
```

### Playwright ブラウザ (録画機能を使う場合は必須)

Suite 編集画面の「録画から Step を作成」 (Playwright codegen) を使うには、Playwright のブラウザバイナリを別途インストールする必要がある:

```sh
pnpm exec playwright install
```

このセットアップを忘れたまま録画を起動すると、ダイアログに「Playwright のブラウザがインストールされていません」と表示される。

## 開発ワークフロー

```sh
pnpm typecheck   # 全パッケージ型チェック
pnpm lint        # oxlint (広域) + ESLint (type-aware) を順に実行
pnpm test        # 全パッケージのテスト
pnpm build       # 全パッケージのビルド
pnpm format      # Prettier で整形
```

`pnpm lint` は二段構成:

- **oxlint**: any/as/non-null禁止、import規律など広域構文ルール (高速)
- **ESLint**: `no-floating-promises` などの type-aware ルールのみ (低速だが型必要)

詳細は [`.eslintrc.cjs`](./.eslintrc.cjs) と [`.oxlintrc.json`](./.oxlintrc.json) を参照。

## Git Hook

- **pre-commit**: oxlint (staged) / ESLint full / typecheck (関連パッケージ) / Prettier format
- **pre-push**: 全パッケージの lint + typecheck + test + build + ESLint type-aware

`--no-verify` は原則禁止。フックが詰まったら原因を直す。
