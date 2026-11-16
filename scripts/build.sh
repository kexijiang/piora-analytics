#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
image="${IMAGE_NAME:-piora-analytics}"
version="${1:-latest}"
if [[ $# -eq 0 ]]; then
  docker build -t "$image:$version" .
else
  git rev-parse --verify "refs/tags/$version^{commit}" >/dev/null
  git archive "refs/tags/$version" | docker build -t "$image:$version" -
fi
