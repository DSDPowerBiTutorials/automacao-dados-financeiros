/**
 * 🤖 DSD Codex Auto-Fix Script
 * Corrige automaticamente versões vulneráveis de Next.js e React
 * (CVE-2025-55182 / CVE-2025-66478)
 */
import fs from "fs";

const PACKAGE_JSON_PATH = "./package.json";
const SAFE_VERSIONS = {
  next: "^15.5.7",
  react: "^19.1.2",
  "react-dom": "^19.1.2",
  "eslint-config-next": "^15.5.7",
};

function updateDependencies(pkg, section) {
  let updated = false;
  if (!pkg[section]) return false;
  for (const dep in SAFE_VERSIONS) {
    const current = pkg[section][dep];
    const safe = SAFE_VERSIONS[dep];
    if (current && current !== safe) {
      console.log(`🔒 Updating ${dep} from ${current} → ${safe}`);
      pkg[section][dep] = safe;
      updated = true;
    }
  }
  return updated;
}

function main() {
  console.log("🤖 Codex Security Fix — Checking React/Next.js versions...");
  if (!fs.existsSync(PACKAGE_JSON_PATH)) {
    console.error("❌ package.json not found.");
    process.exit(1);
  }
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
  let changed = false;
  changed = updateDependencies(pkg, "dependencies") || changed;
  changed = updateDependencies(pkg, "devDependencies") || changed;
  if (changed) {
    fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    console.log("✅ Codex Security Patch applied to package.json");
  } else {
    console.log("🟢 All dependencies already secure — no changes made.");
  }
}

main();
