#!/usr/bin/env bash
# Combined regression gate for D:\SB-APP-worktrees\combined. Sequential, ONE attempt per step,
# no automatic reruns: every failure stays on record. Isolated harness only. Uses the in-repo
# runners added by Agent C (backend/scripts/run-integration-tests.js, frontend/scripts/run-session-tests.cjs).
export NODE_OPTIONS= NODE_TLS_REJECT_UNAUTHORIZED=
export PW_CHROMIUM_PATH='C:\Users\Arrin Paul\AppData\Local\ms-playwright\chromium-1248\chrome-win64\chrome.exe'
W="/d/SB-APP-worktrees/combined"
OUT="/d/SB-APP-orchestration/completion/raw/combined"
mkdir -p "$OUT"; : > "$OUT/progress.txt"
step() { echo "$(date +%H:%M:%S) $1" >> "$OUT/progress.txt"; }
run() { # name, timeout seconds, command...
  local name="$1" t="$2"; shift 2
  local s=$SECONDS
  step "START $name"
  timeout "$t" "$@" > "$OUT/$name.raw" 2>&1
  local code=$?
  step "END   $name exit=$code duration=$((SECONDS-s))s"
}

cd "$W/backend"
run backend-unit 600 node --test test/unit/*.test.js
run backend-eslint 600 npx eslint .
run backend-typecheck 600 node scripts/typecheck.js
run backend-integration 3000 node scripts/run-integration-tests.js

cd "$W/frontend"
run frontend-typecheck 600 npm run typecheck
run frontend-lint 600 npm run lint
run frontend-node 600 node --test tests/unit/*.node-test.mjs
FAKE_KEY=FAKE-BUNDLE-SECRET-9f3a7c
VITE_GEMINI_API_KEY=$FAKE_KEY run frontend-build-fakekey 900 npm run build
step "bundle check: fake key in dist files=$(grep -rl "$FAKE_KEY" dist 2>/dev/null | wc -l); generativelanguage in dist files=$(grep -rli generativelanguage dist 2>/dev/null | wc -l)"
rm -rf dist
run browser-all 3600 node scripts/run-session-tests.cjs
step FIN
