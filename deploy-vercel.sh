#!/usr/bin/env bash
# ONE-TIME deploy to Vercel (free account; the first run opens a login page).
# After this, the app is live at an https link and can be installed on every device.
cd "$(dirname "$0")"
npm install --no-audit --no-fund && npx --yes vercel@latest deploy --prod --yes
