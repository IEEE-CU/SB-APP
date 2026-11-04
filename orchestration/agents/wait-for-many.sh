#!/usr/bin/env bash
# Usage: wait-for-many.sh <max-seconds> <issue-uuid>...
# Prints one line per issue as it leaves todo/in_progress, then exits when all have (or time runs out). Read-only.
MAX="$1"; shift
T0=$SECONDS
declare -A seen
while [ $((SECONDS-T0)) -lt "$MAX" ]; do
  left=0
  for ID in "$@"; do
    [ -n "${seen[$ID]}" ] && continue
    st=$(curl -s -m 8 "http://127.0.0.1:3100/api/issues/$ID" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(j.status+"|"+(j.identifier||""))}catch(e){console.log("?|?")}})')
    case "$st" in
      todo\|*|in_progress\|*|\?\|*) left=$((left+1));;
      *) seen[$ID]=1; echo "FINISHED $st after $((SECONDS-T0))s";;
    esac
  done
  [ "$left" -eq 0 ] && { echo "ALL FINISHED"; exit 0; }
  sleep 25
done
echo "TIMEOUT after $((SECONDS-T0))s"
