# 0001. 技術スタック選定

- Status: Accepted
- Date: 2026-05-22

## Context

E2Eテストの「録画 → 保存 → 実行 → 失敗時にLLMが自動修復」までを1つのデスクトップアプリで完結させる必要がある。要件:

- ローカルファースト (ユーザーのマシン上でテストを記録/実行/保存)
- ユーザー操作の録画と Playwright スクリプトの編集 UI
- 失敗時に LLM が DOM/セレクタ/操作ログを見て自動修復
- 修復履歴の永続化と可視化
- 開発の保守性を高く保つ (型安全、静的解析、TDD)

## Decision

| 領域                 | 採用                                                     | 棄却した代替                              |
| -------------------- | -------------------------------------------------------- | ----------------------------------------- |
| アプリ筐体           | **Tauri** (Rust薄shell + TS BE)                          | Electron, Wails, ピュアCLI                |
| バックエンド言語     | **TypeScript** (Tauri commandから呼ぶTS BE)              | Rust full backend                         |
| 永続化               | **SQLite + Drizzle ORM**                                 | Prisma, raw better-sqlite3, JSON ファイル |
| 型/スキーマ          | **zod (手書き) + Drizzle スキーマ手書き** + 整合性テスト | drizzle-zod, openapi由来生成              |
| パッケージマネージャ | **pnpm workspace**                                       | npm workspace, yarn berry                 |
| タスクランナー       | **Turborepo**                                            | nx, just                                  |
| 静的解析 (速度域)    | **oxlint** (構文ルール広域)                              | ESLint full                               |
| 静的解析 (型認識域)  | **ESLint (type-aware限定)**                              | tsc only, biome (型認識弱い)              |
| フォーマッタ         | **Prettier**                                             | biome format                              |
| テスト               | **Vitest** (workspace)                                   | Jest, node:test                           |
| Git hook             | **lefthook**                                             | husky+lint-staged                         |
| エディタ設定         | **EditorConfig + .nvmrc**                                | -                                         |

## Consequences

### 良い点

- Tauri により Electron 比でバイナリサイズと起動時間を大きく削減。
- TS BE 一本化により、書き込みロジックの責務が分散せず、テストもしやすい。
- pnpm workspace + Turborepo の組み合わせでパッケージ間依存と incremental build が両立。
- oxlint で広域lintを高速に回し、ESLint は type-aware ルールに限定することで、CI/フック時間を短縮しつつ型起因の不具合を確実に検出。
- Drizzle ORM は型安全で、生成スキーマでなく手書きを採用することで `shared` の zod スキーマと意図的に分離。整合性は専用テストで保証する。
- Vitest workspace により、パッケージごとに独立した設定を持ちつつ単一コマンドで全テストを実行可能。
- lefthook による pre-commit/pre-push のフックで、コミット段階で品質を担保。

### 注意点・短所

- Rust 側は薄く保つ方針なので、Rust の知見が必要な場面は限定的だが、Tauri command の引数型と TS 側のスキーマがズレないよう注意 (zod を間に挟む)。
- **書き込みは TS に一本化**。Rust から SQLite に直接書くと整合性が崩れるため避ける。
- **drizzle-zod は採用しない**。生成された zod 型がドメインの意図と一致しない場合があるため、`shared` の zod スキーマと Drizzle スキーマは手書きにし、CIで整合性テスト (各カラム ↔ zod フィールドの突合) を回す。
- oxlint は新興ツールのためルールカバレッジが ESLint よりは狭い。型認識ルールは ESLint 側でカバーする二段構え。
- pnpm の `packageManager` フィールドは pnpm@9 系を指定。CI/開発者環境で corepack 経由で揃える。
- Playwright のブラウザ実行は隔離のため Docker (`mcr.microsoft.com/playwright`) で行う方針 (別ADRで詳細化予定)。

## 関連

- `docs/architecture.md` (全体像)
- 後続ADR: Docker隔離戦略、Tauri command スキーマ運用、LLM修復のリトライ戦略
