#!/usr/bin/env bash
# Create discovery-engine/.venv (Python 3.12), install its deps, and create .env from the template.
# Uses uv when present, otherwise python3.12 -m venv (falling back to python3).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../discovery-engine"

if [ ! -x .venv/bin/python ]; then
  if command -v uv >/dev/null 2>&1; then
    uv venv -p 3.12 .venv
  elif command -v python3.12 >/dev/null 2>&1; then
    python3.12 -m venv .venv
  else
    echo "discovery: python3.12 not found, using python3 (the engine is tested on 3.12)" >&2
    python3 -m venv .venv
  fi
fi

if command -v uv >/dev/null 2>&1; then
  uv pip install -q -p .venv -r requirements.txt
else
  .venv/bin/python -m pip install -q -r requirements.txt
fi

[ -f .env ] || { cp .env.example .env; echo "discovery: created discovery-engine/.env (set GEMINI_API_KEY to enable stories)"; }
