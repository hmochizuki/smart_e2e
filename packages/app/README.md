# @smart-e2e/app

smart_e2e の Tauri アプリ本体 (Rust 薄シェル + React フロント)。

## アーキテクチャ

```
React (Vite) ─ invoke ─→ Tauri command (Rust) ─→ Node サブプロセス (scripts/cmd.mjs)
                                                       │
                                                       └─→ @smart-e2e/persistence (Drizzle + SQLite)
```

- Rust 側は **DB を一切触らない**。Tauri command は `node scripts/cmd.mjs <name> <json>` を都度起動し、JSON を返すだけの薄いシェル。
- DB アクセス / マイグレーション / バリデーションはすべて TypeScript 側 (`scripts/cmd.mjs` 経由) に集約。
- DB の場所: `app_data_dir() / smart-e2e.db` (Tauri が解決)。
- マイグレーション: `packages/persistence/drizzle/` を起動時に Node 側で適用。

## セットアップ

前提:

- Node 20+, pnpm 9+
- Rust toolchain (`rustup` 推奨)
- Tauri CLI: `pnpm install` で `@tauri-apps/cli` が devDependency として入る
  - または `cargo install tauri-cli --version "^2.0"`

```sh
pnpm install
```

## 開発

フロントだけ確認 (Tauri なし):

```sh
pnpm --filter=@smart-e2e/app dev
```

Tauri アプリとして起動 (Rust 側ビルド + フロントを Tauri ウィンドウで開く):

```sh
pnpm --filter=@smart-e2e/app tauri:dev
```

リリースビルド:

```sh
pnpm --filter=@smart-e2e/app tauri:build
```

## 開発時の注意

- `scripts/cmd.mjs` は `@smart-e2e/persistence` の dist を読むため、
  事前に `pnpm --filter=@smart-e2e/persistence build` (もしくはルートで `pnpm build`) しておく。
- 環境変数 `SMART_E2E_DB_PATH` と `SMART_E2E_MIGRATIONS_FOLDER` は Rust 側が自動で設定する。

## ディレクトリ

```
src/
  main.tsx          React エントリ
  App.tsx           ルート画面
  ipc/              Tauri invoke の型付きラッパー
  features/         (今後、機能別 UI)
  ui/               (今後、共通UI)
  lib/              (今後、共通ヘルパー)
src-tauri/
  Cargo.toml
  tauri.conf.json
  src/
    main.rs
    lib.rs
    commands/
      mod.rs
      error.rs
      runner_proc.rs   Node サブプロセス呼び出し
      suite.rs         Suite / Step CRUD command
      run.rs           Run 系 command (今は list のみ)
  capabilities/
    default.json
  icons/
    icon.png           placeholder (差し替え予定)
scripts/
  cmd.mjs              Rust から呼ばれる CLI ヘルパー
```

## Playwright codegen の使い方

`start_codegen` Tauri command でローカルの Playwright codegen を起動し、ユーザーのブラウザ操作を録画して spec として取得できる。

### 前提

- ローカルマシンで `npx` が PATH に通っていること
- Playwright のブラウザがインストール済みであること (`pnpm playwright install` 等)
- codegen は GUI ブラウザを起動するため、**常にローカル実行**。`RUNNER_USE_DOCKER` が有効でも Docker 内ではなくホスト側で動く (Docker 内ブラウザは GUI 不可)

### フロー

1. フロントから URL を渡して `startCodegen({ url, target? })` を呼ぶ
2. Rust 側で一時ファイル (`.ts`) を作成し、`npx playwright codegen --target=<target> -o <tmp> <url>` を spawn
3. ユーザーのブラウザ操作が録画される (この間 Tauri command は待機)
4. ユーザーが codegen ウィンドウ/ブラウザを閉じるとプロセスが終了
5. 一時ファイルから spec を読み取り、`{ script, targetUrl }` として返却
6. 一時ファイルは削除される

`target` のデフォルトは `playwright-test`。`javascript` 等の codegen サポート target も指定可能。

実行中のキャンセル機能は未実装 (将来対応予定)。

## TODO (次タスク)

- Run 実行系 command (`start_run`, `cancel_run` 等)
- Codegen のキャンセル / 実行中ステータス通知 (events)
- 各画面の UI 実装 (features/, ui/) — Suite 編集画面に「録画」ボタンを置き `startCodegen` を呼ぶ
- icons/ の正式アイコン差し替え
