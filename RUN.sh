#!/usr/bin/env bash
# macOS / Linux: install and start the app on http://localhost:5173
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Install Node.js LTS from https://nodejs.org first."; exit 1; }
[ -d node_modules/vite ] || npm install --no-audit --no-fund
npm run dev -- --open
