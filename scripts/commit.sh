#!/usr/bin/env bash
set -euo pipefail
message=${1:-"chore: automated commit"}

git status -sb

git add -A
git commit -m "$message"
