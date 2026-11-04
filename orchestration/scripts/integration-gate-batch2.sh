#!/usr/bin/env bash
# Combined regression gate for the Batch 2 integration worktree. Sequential, one attempt per
# step, NO automatic reruns: every failure stays on record. Isolated harness only.
export NODE_OPTIONS= NODE_TLS_REJECT_UNAUTHORIZED=
WT="D:/SB-APP-worktrees/batch2-integration"
WTD="/d/SB-APP-worktrees/batch2-integration"
OUT="/d/SB-APP-orchestration/reports/batch2/gate"
mkdir -p "$OUT"; : > "$OUT/progress.txt"
step() { echo "$1" >> "$OUT/progress.txt"; }

cd "$WTD/backend"
step "== backend unit (all files)"
node --test test/unit/*.test.js > "$OUT/unit.raw" 2>&1; step "unit exit=$?"
step "== backend eslint (all)"
npx eslint . > "$OUT/backend-eslint.raw" 2>&1; step "backend-eslint exit=$?"

ls test/integration/*.test.js > "$OUT/files.txt"
N=$(wc -l < "$OUT/files.txt"); H=$((N/2))
step "== integration batch 1 (files 1-$H of $N)"
timeout 590 node D:/SB-APP-orchestration/scripts/run-integration.js --worktree "$WT" $(head -$H "$OUT/files.txt") > "$OUT/integ1.raw" 2>&1; step "integ1 exit=$?"
step "== integration batch 2 (files $((H+1))-$N)"
timeout 590 node D:/SB-APP-orchestration/scripts/run-integration.js --worktree "$WT" $(tail -n +$((H+1)) "$OUT/files.txt") > "$OUT/integ2.raw" 2>&1; step "integ2 exit=$?"

cd "$WTD/frontend"
step "== frontend static"
npm run typecheck > "$OUT/typecheck.raw" 2>&1; step "typecheck exit=$?"
npm run lint > "$OUT/lint.raw" 2>&1; step "lint exit=$?"
npm run build > "$OUT/build.raw" 2>&1; step "build exit=$?"
node --test tests/unit/*.node-test.mjs > "$OUT/fe-node.raw" 2>&1; step "fe-node exit=$?"

for spec in $(ls tests/session/*.spec.ts); do
  b=$(basename "$spec" .spec.ts)
  step "== browser $b"
  rm -rf test-results/session
  timeout 300 node D:/SB-APP-orchestration/scripts/run-browser.js --worktree "$WT" "$spec" --trace retain-on-failure > "$OUT/browser-$b.raw" 2>&1; step "browser $b exit=$?"
  if [ -d test-results/session ]; then mkdir -p "$OUT/artifacts-$b"; cp -r test-results/session/. "$OUT/artifacts-$b/" 2>/dev/null; fi
done
git checkout -- tsconfig.tsbuildinfo 2>/dev/null; rm -rf dist test-results/session
step FIN
