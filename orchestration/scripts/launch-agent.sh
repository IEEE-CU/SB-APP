#!/usr/bin/env bash
# Usage: launch-agent.sh <A|B|C>
# Starts ONE independent, non-interactive Claude Code session in the agent's worktree with a
# scoped tool permission set (scripts/agent-tools.sh). Never uses bypass/skip-permission modes.
# The agent's final message is written to reports/<date>_agent<X>_raw.txt.
set -u
ORCH="/d/SB-APP-orchestration"
. "$ORCH/scripts/agent-tools.sh"
case "$1" in
  A) NAME="Agent A, the security and data-integrity agent"; WT='D:\SB-APP-worktrees\terms';         BR="agent/batch1-terms";         ALLOW="$A_ALLOW" ;;
  B) NAME="Agent B, the functional-workflows agent";        WT='D:\SB-APP-worktrees\announcements'; BR="agent/batch1-announcements"; ALLOW="$B_ALLOW" ;;
  C) NAME="Agent C, the read-only QA investigator";         WT='D:\SB-APP-worktrees\qa';            BR="agent/batch1-qa";            ALLOW="$C_ALLOW" ;;
  *) echo "usage: $0 A|B|C"; exit 2 ;;
esac
DIR="/d/SB-APP-worktrees/$(basename "${WT//\\//}")"
TASK="${2:-$1}"   # optional second argument selects a follow-up task file (e.g. B2)
PROMPT="$ORCH/prompts/agent$TASK.md"
{
  printf 'raw: You are %s. Your working directory is the git worktree %s on branch %s (based on commit 70ff8bd). You are one of three agents working in parallel on isolated worktrees of the SB-APP repository; the protected checkout D:\\SB-APP must not be used.\n\n' "$NAME" "$WT" "$BR"
  printf 'The rules below are binding (they are AGENT_RULES.md, the approved policies from DECISIONS.md, and your file ownership; you cannot read files outside your worktree). Your tool permissions are scoped accordingly: git is read-only, edits are limited to your owned files, and a denied action is not a bug to work around - report it.\n\n===== AGENT_RULES.md =====\n'
  cat "$ORCH/AGENT_RULES.md"
  printf '\n===== Approved policies (DECISIONS.md) =====\n'
  sed -n '/^## Approved/,/^## Pending/p' "$ORCH/DECISIONS.md" | sed '$d'
  printf '\n'
  cat "$ORCH/prompts/agent$TASK-task.md"
} > "$PROMPT"
OUT="$ORCH/reports/$(date +%Y-%m-%d)_agent${TASK}_raw.txt"
if [ -e "$OUT" ]; then OUT="$ORCH/reports/$(date +%Y-%m-%d_%H%M%S)_agent${TASK}_raw.txt"; fi
cd "$DIR" || exit 3
export NODE_OPTIONS= NODE_TLS_REJECT_UNAUTHORIZED=
echo "[launch] agent $1 in $DIR -> $OUT ($(date +%H:%M:%S))" >&2
claude -p --permission-mode default --allowedTools "$ALLOW" --disallowedTools "$DENY" < "$PROMPT" > "$OUT" 2>&1
echo "[launch] agent $1 exited with $? at $(date +%H:%M:%S)" >> "$OUT"
