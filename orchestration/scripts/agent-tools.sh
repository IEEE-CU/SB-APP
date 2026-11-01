# Permission sets for the Batch 1 agents (sourced by launch scripts). Comma-separated, one argument each.
GIT_RO='Bash(git status:*),Bash(git diff:*),Bash(git log:*),Bash(git show:*),Bash(git rev-parse:*),Bash(git branch --show-current),Bash(git ls-files:*),Bash(git grep:*),Bash(cd:*),Bash(ls:*)'
RUNNERS='Bash(node --test:*),Bash(npx eslint:*),Bash(node D:/SB-APP-orchestration/scripts/run-integration.js:*),Bash(node D:/SB-APP-orchestration/scripts/run-browser.js:*)'
READ='Read(/**),Glob,Grep'
DENY='Bash(git add:*),Bash(git commit:*),Bash(git push:*),Bash(git pull:*),Bash(git fetch:*),Bash(git reset:*),Bash(git clean:*),Bash(git checkout:*),Bash(git switch:*),Bash(git merge:*),Bash(git rebase:*),Bash(git cherry-pick:*),Bash(git stash:*),Bash(git restore:*),Bash(git worktree:*),Bash(git branch -:*),Bash(git config:*),Bash(npm:*),Bash(npx playwright:*),Bash(rm:*),Bash(del:*),Bash(mv:*),Bash(cp:*),Bash(*digest*),Read(**/digest.txt),Edit(**/digest.txt)'
A_EDIT='Edit(/backend/src/routes/societies.js),Edit(/backend/src/models/SocietyTerm.js),Edit(/backend/src/models/index.js),Edit(/backend/test/unit/society-terms*.test.js),Edit(/backend/test/integration/society-*.integration.test.js)'
B_EDIT='Edit(/backend/src/routes/announcements.js),Edit(/frontend/src/pages/announcements/**),Edit(/frontend/src/services/announcements.ts),Edit(/frontend/src/types/models.ts),Edit(/backend/test/unit/announcement-*.test.js),Edit(/backend/test/integration/announcement-*.integration.test.js),Edit(/frontend/tests/session/announcement-create.spec.ts)'
A_ALLOW="$READ,$GIT_RO,$RUNNERS,$A_EDIT"
B_ALLOW="$READ,$GIT_RO,$RUNNERS,$B_EDIT"
C_ALLOW="$READ,$GIT_RO"
