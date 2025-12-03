git fetch --all
git checkout main
for branch in $(git branch -r | grep 'codex/'); do
  b=$(echo $branch | sed 's/origin\///')
  git push origin --delete $b || true
done
git pull origin main
git push origin main
