#!/usr/bin/env bash
# Build the production backend image (immutable, versioned).
#
#   ./build-backend.sh 2.0.0
#
# The same image can be deployed to staging and production; configuration is
# injected at runtime via environment variables.
set -euo pipefail

VERSION="${1:?Usage: ./build-backend.sh <version>   e.g. ./build-backend.sh 2.0.0}"
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
IMAGE="${BACKEND_IMAGE:-imigrasi-backend}"

docker build \
  --build-arg APP_VERSION="${VERSION}" \
  --build-arg GIT_SHA="${GIT_SHA}" \
  -t "${IMAGE}:${VERSION}" \
  -t "${IMAGE}:latest" \
  ./backend

echo ""
echo "Built ${IMAGE}:${VERSION}  (git ${GIT_SHA})"
echo "Next:"
echo "  1. docker run --rm --env-file ./backend/.env --network dbcon ${IMAGE}:${VERSION} alembic upgrade head"
echo "  2. docker run -d --name imigrasi_backend --restart unless-stopped --env-file ./backend/.env --network dbcon ${IMAGE}:${VERSION}"
