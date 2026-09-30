#!/bin/zsh
cd "${0:A:h}"
if ! command -v node >/dev/null 2>&1; then
  export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
fi
if [ ! -d node_modules ]; then
  if command -v npm >/dev/null 2>&1; then npm install
  else "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm" install
  fi
fi
node scripts/prepare-pdf-assets.mjs
exec node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5178 --open
