# Read-only status of the protected checkout and the three agent worktrees.
# No staging, committing, cleaning or switching. Nothing here opens digest.txt: `git status`
# prints its NAME as an untracked path in the protected checkout and nothing else about it.
$roots = @(
  'D:\SB-APP',
  'D:\SB-APP-worktrees\terms',
  'D:\SB-APP-worktrees\announcements',
  'D:\SB-APP-worktrees\qa'
)
foreach ($root in $roots) {
  if (-not (Test-Path -LiteralPath $root)) { Write-Output "== $root : (missing)"; continue }
  Write-Output "== $root"
  git -C $root branch --show-current
  git -C $root rev-parse --short HEAD
  git -C $root status --short
}
Write-Output '== worktrees'
git -C 'D:\SB-APP' worktree list
if (Test-Path -LiteralPath 'D:\SB-APP-orchestration\locks\harness.lock') {
  Write-Output '== harness lock held:'
  Get-Content -LiteralPath 'D:\SB-APP-orchestration\locks\harness.lock\owner.json' -ErrorAction SilentlyContinue
} else { Write-Output '== harness lock: free' }
