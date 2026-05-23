#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../../.." && pwd)
IMAGE_TAG="${RUNNER_DOCKER_IMAGE:-smart-e2e-runner:0.1.0}"

docker build \
  -f "$REPO_ROOT/docker/runner.Dockerfile" \
  -t "$IMAGE_TAG" \
  "$REPO_ROOT"
