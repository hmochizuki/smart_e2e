# Docker Runner

smart_e2e の runner は Playwright spec の実行を Docker コンテナ内に隔離できる。

## なぜ Docker を使うか

- **隔離性**: spec が host 側の状態 (Node modules, OS パッケージ) を汚染しない。逆に host が壊れていても spec は動く。
- **依存固定**: Playwright のバージョン、ブラウザバイナリ、glibc 等を固定できる。CI/ローカル/Tauri 配布で挙動が揃う。
- **権限制御**: `--network`, `--memory`, 任意の seccomp profile を将来追加できる出口を確保。

## イメージのビルド

リポジトリルートで以下のいずれかを実行する:

```bash
# 直接 docker build
docker build -f docker/runner.Dockerfile -t smart-e2e-runner:0.1.0 .

# スクリプト経由 (環境変数 RUNNER_DOCKER_IMAGE でタグ上書き可)
./packages/runner/scripts/build-docker-image.sh
```

固定タグ `smart-e2e-runner:0.1.0` を使う。タグを変える場合は CLI 側で `RUNNER_DOCKER_IMAGE` を明示する。

## CLI での使い方

CLI 側で `RUNNER_USE_DOCKER=true` を渡すと、`nodeSpawnFn` の代わりに `createDockerSpawnFn` が選択される。

```bash
RUNNER_USE_DOCKER=true \
ANTHROPIC_API_KEY=sk-... \
pnpm --filter=@smart-e2e/runner exec smart-e2e-runner --suite path/to/suite.json
```

オプション:

| 環境変数              | デフォルト               | 説明                                    |
| --------------------- | ------------------------ | --------------------------------------- |
| `RUNNER_USE_DOCKER`   | `false`                  | `true` で Docker 隔離実行モードを有効化 |
| `RUNNER_DOCKER_IMAGE` | `smart-e2e-runner:0.1.0` | 使うイメージタグ                        |

## 必要な環境

- Docker Desktop あるいは互換ランタイム (Colima, Rancher Desktop など) が起動済みであること
- `docker` CLI に `PATH` が通っていること
- `RUNNER_WORK_DIR` に指定したディレクトリを Docker に bind mount できること (Docker Desktop のファイル共有設定要)

## 内部仕様

`createDockerSpawnFn` は以下のような `docker run` コマンドを組み立てる:

```
docker run --rm \
  -v <hostWorkDir>:/work \
  -w /work \
  --network bridge \
  -e KEY=VALUE ... \
  smart-e2e-runner:0.1.0 \
  npx playwright test /work/<id>.spec.ts
```

タイムアウト時は SIGTERM を送り、5 秒後に SIGKILL を送る段階的 kill を行う。
