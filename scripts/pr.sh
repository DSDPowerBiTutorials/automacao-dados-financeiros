#!/usr/bin/env bash
set -euo pipefail

current_branch=$(git rev-parse --abbrev-ref HEAD)
latest_commit=$(git rev-parse --short HEAD)

echo "Create the pull request for branch: $current_branch (commit $latest_commit) using the Codex make_pr tool after verifying tests."
