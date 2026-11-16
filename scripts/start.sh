#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f .env ]]; then
  echo 'Copy .env.docker.example to .env and configure secrets, origin and initial administrator first.' >&2
  exit 1
fi
case "${1:-local}" in
  local) docker compose build ;;
  image) docker compose pull ;;
  offline) ;;
  *) echo 'Usage: bash scripts/start.sh [local|image|offline]' >&2; exit 1 ;;
esac
docker compose up -d --no-build --pull never --wait --wait-timeout 180
