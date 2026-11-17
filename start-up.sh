#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mode="${1:-local}"
case "$mode" in
  local|image|offline) ;;
  *) echo 'Usage: bash start-up.sh [local|image|offline] [config-directory]' >&2; exit 1 ;;
esac
config_dir="${2:-${CONFIG_DIR:-./config}}"
if [[ ! -f "$config_dir/.env" ]]; then
  echo "Create $config_dir/.env from .env.docker.example and configure secrets and existing data directories first." >&2
  exit 1
fi
# Use the same directory for Compose interpolation and the container mount.
case "${OSTYPE:-}" in
  msys*|cygwin*) CONFIG_DIR="$(cd "$config_dir" && pwd -W)" ;;
  *) CONFIG_DIR="$(cd "$config_dir" && pwd -P)" ;;
esac
export CONFIG_DIR
compose=(docker compose -f compose.yaml --env-file "$CONFIG_DIR/.env")
"${compose[@]}" config --quiet
case "$mode" in
  local) "${compose[@]}" build ;;
  image) "${compose[@]}" pull ;;
  offline) ;;
esac
"${compose[@]}" up -d --no-build --pull never --wait --wait-timeout 180
