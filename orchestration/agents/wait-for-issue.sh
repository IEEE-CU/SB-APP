#!/usr/bin/env bash
# Usage: wait-for-issue.sh <issue-uuid> [max-seconds]
# Prints one line when the issue leaves todo/in_progress (or the time runs out). Read-only.
ID="$1"; MAX="${2:-1700}"; T0=$SECONDS
last=""
while [ $((SECONDS-T0)) -lt "$MAX" ]; do
  st=$(curl -s -m 8 "http://127.0.0.1:3100/api/issues/$ID" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(j.status+"|"+(j.identifier||""))}catch(e){console.log("?|?")}})')
  case "$st" in
    todo\|*|in_progress\|*|\?\|*) ;;
    *) echo "FINISHED $st after $((SECONDS-T0))s"; exit 0;;
  esac
  sleep 20
done
echo "TIMEOUT after $((SECONDS-T0))s (last: $st)"
