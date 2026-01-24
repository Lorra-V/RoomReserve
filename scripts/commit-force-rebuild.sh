#!/usr/bin/env bash
set -e

git add server/index-prod.ts
git commit -m "$(cat <<'EOF'
Force rebuild

EOF
)"
git status -sb
git push
