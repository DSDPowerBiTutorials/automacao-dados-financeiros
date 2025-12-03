import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();
const LOG_DIR = path.join(ROOT, "logs");
const LOG_FILE = path.join(LOG_DIR, "codex_master_log.txt");
fs.mkdirSync(LOG_DIR, { recursive: true });

const log = (msg) => {
  const t = new Date().toISOString();
  console.log(`[${t}] ${msg}`);
  fs.appendFileSync(LOG_FILE, `[${t}] ${msg}\n`);
};

const run = (cmd) => {
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (e) {
    log(`⚠️ ${cmd} failed: ${e.message}`);
  }
};

// 1️⃣ Fix folder structure
function fixFolders() {
  log("📁 Checking structure...");
  const nested = path.join(ROOT, "scripts", "scripts");
  if (fs.existsSync(nested)) {
    fs.readdirSync(nested).forEach((f) =>
      fs.renameSync(path.join(nested, f), path.join(ROOT, "scripts", f))
    );
    fs.rmSync(nested, { recursive: true, force: true });
    log("✅ Fixed nested scripts folder");
  }
}

// 2️⃣ Fix workflows
function fixWorkflows() {
  const dir = path.join(ROOT, ".github", "workflows");
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach((f) => {
    if (!f.endsWith(".yml")) return;
    let c = fs.readFileSync(path.join(dir, f), "utf-8");
    if (c.includes("actions/setup-node@v2"))
      c = c.replace(/actions\/setup-node@v2/g, "actions/setup-node@v4");
    if (!c.includes("permissions:"))
      c += "\npermissions:\n  contents: write\n  pull-requests: write\n";
    fs.writeFileSync(path.join(dir, f), c);
  });
  log("🔧 Workflows checked and updated");
}

// 3️⃣ Lint & format
function cleanCode() {
  log("🎨 Running Prettier & ESLint");
  run("npx prettier --write . || true");
  run("npx eslint --fix . || true");
}

// 4️⃣ Learn from project structure
function analyzeProject() {
  log("🧠 Analyzing code...");
  const issues = [];
  const scan = (d) => {
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) scan(p);
      else if (/\.(js|ts|tsx|jsx)$/.test(e.name)) {
        const c = fs.readFileSync(p, "utf-8");
        if (c.includes("<<<<<<<")) issues.push(`❌ Conflict marker in ${p}`);
        if ((c.match(/console\.log/g) || []).length > 10)
          issues.push(`⚠️ Excessive console.log in ${p}`);
      }
    });
  };
  scan(path.join(ROOT, "src"));
  if (issues.length) issues.forEach((i) => log(i));
  else log("✅ No critical issues found");
}

// 5️⃣ Commit results
function finalize() {
  log("💾 Committing changes...");
  run(`
    git config user.name "Codex Autodidact Bot"
    git config user.email "codex@dsdgroup.es"
    git add .
    git commit -m "🤖 Codex Maintenance: cleanup & optimize" || echo "No changes"
  `);
}

log("🚀 Starting Codex Autodidact Maintenance");
fixFolders();
fixWorkflows();
cleanCode();
analyzeProject();
finalize();
log("✅ Maintenance complete");
