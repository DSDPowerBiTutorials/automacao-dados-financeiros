/**
 * 🤖 Codex Repair Script
 * Executa automaticamente dentro do ambiente GitHub Actions
 * Repara workflows quebrados, recria os principais e commita.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const WORKFLOW_DIR = ".github/workflows";
fs.mkdirSync(WORKFLOW_DIR, { recursive: true });

function writeFile(file, content) {
  const target = path.join(WORKFLOW_DIR, file);
  fs.writeFileSync(target, content.trimStart());
  console.log(`✅ Recreated ${file}`);
}

// --- Workflow 1: Codex Auto Fix ---
writeFile(
  "codex-auto-fix.yml",
  `
name: 🤖 Codex Auto Fix

on:
  push:
    branches:
      - main
      - codex/*
  pull_request:
    branches:
      - main

jobs:
  auto-fix:
    runs-on: ubuntu-latest
    steps:
      - name: 🧩 Checkout repo
        uses: actions/checkout@v4

      - name: 🧰 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: ⚙️ Install dependencies
        run: npm install prettier

      - name: 🧠 Auto-fix source code
        run: |
          echo "Running Codex Auto-Fix..."
          find . -type f \\( -name '*.tsx' -o -name '*.ts' -o -name '*.js' -o -name '*.jsx' \\) -print | while read file; do
            sed -i '/<<<<<<<\\|=======\\|>>>>>>>/d' "$file"
            if ! grep -q '"use client"' "$file"; then
              sed -i '1i"use client"\\n' "$file"
            fi
          done
          npx prettier --write .

      - name: 🚀 Commit & Push changes
        run: |
          git config user.name "Codex AutoFix Bot"
          git config user.email "codex@dsdgroup.es"
          git add .
          git commit -m "🤖 auto-fix: format and clean code" || echo "No changes to commit"
          git push
`
);

// --- Workflow 2: Codex Cleanup ---
writeFile(
  "codex-cleanup.yml",
  `
name: 🧹 Codex Cleanup PRs

on:
  workflow_dispatch:

jobs:
  cleanup:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write

    steps:
      - name: 🧩 Checkout repo
        uses: actions/checkout@v4

      - name: 🧠 Close old Codex PRs
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          echo "🔍 Searching for old Codex PRs..."
          prs=$(gh pr list --state open --json number,title | jq -r '.[] | select(.title | test("Codex|auto|fix|xlsx|parser|upload"; "i")) | .number')
          for pr in $prs; do
            echo "❌ Closing PR #$pr..."
            gh pr close $pr --delete-branch --comment "Auto-closed by Codex Cleanup"
          done
          echo "✅ All old Codex PRs closed successfully!"

      - name: 🧠 Create new clean branch
        run: |
          git config --global user.email "codex@dsdgroup.es"
          git config --global user.name "Codex Cleanup Bot"
          git fetch origin main
          git checkout main
          git pull
          git checkout -b codex/fresh-clean-state
          git push origin codex/fresh-clean-state
          gh pr create --base main --head codex/fresh-clean-state --title "🧠 Codex Fresh State PR" --body "Reinitialized clean state after automatic cleanup."
`
);

// --- Git commit ---
try {
  execSync(`
    git config --global user.name "Codex Repair Bot"
    git config --global user.email "codex@dsdgroup.es"
    git add ${WORKFLOW_DIR}
    git commit -m "🧩 fix: repaired Codex workflows (auto-fix + cleanup)"
    git push
  `);
  console.log("🚀 Workflows fixed and pushed successfully.");
} catch {
  console.log("⚠️ Nothing new to commit or push failed (ignored).");
}
