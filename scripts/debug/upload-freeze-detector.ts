import fs from "fs";
import path from "path";

const reportDir = path.join(process.cwd(), "src", "app", "reports");
const logFile = path.join(process.cwd(), "logs", "upload_freeze_report.log");

console.log("🔍 Running Upload Freeze Detector...");

if (!fs.existsSync(reportDir)) {
  console.error("❌ No /reports directory found.");
  process.exit(1);
}

fs.mkdirSync(path.dirname(logFile), { recursive: true });

let freezeTriggers: string[] = [];

fs.readdirSync(reportDir).forEach((folder) => {
  const filePath = path.join(reportDir, folder, "page.tsx");
  if (!fs.existsSync(filePath)) return;

  const code = fs.readFileSync(filePath, "utf8");

  // 1️⃣ Check for dangerous FileReader usage outside handlers
  if (/new\s+FileReader\(\)/.test(code) && !/function|const\s+handle/i.test(code)) {
    freezeTriggers.push(`[${folder}] ❌ FileReader created outside handler`);
  }

  // 2️⃣ Check for synchronous file reading
  if (/file\.text\(\)/.test(code)) {
    freezeTriggers.push(`[${folder}] ⚠️ Synchronous file.text() usage (blocks UI thread)`);
  }

  // 3️⃣ Detect recursive useEffect loops
  if (/useEffect\(.*file.*\)/s.test(code)) {
    freezeTriggers.push(`[${folder}] ⚠️ useEffect depends on 'file' — may re-trigger upload`);
  }

  // 4️⃣ Detect continuous DOM triggers
  if (/document\.getElementById.*click\(\)/.test(code)) {
    freezeTriggers.push(`[${folder}] ⚠️ DOM click() call — verify placement`);
  }

  // 5️⃣ Detect re-render loops (state mutations inside render)
  if (/setState|setFile|setUpload/g.test(code) && !/onChange|handle/i.test(code)) {
    freezeTriggers.push(`[${folder}] ❌ State mutation in render block`);
  }
});

if (freezeTriggers.length === 0) {
  fs.writeFileSync(logFile, "✅ No freeze risks detected.\n");
  console.log("✅ No freeze risks detected.");
} else {
  const report = freezeTriggers.join("\n");
  fs.writeFileSync(logFile, report + "\n");
  console.warn(`⚠️ Potential issues detected:\n${report}`);
}

console.log(`📄 Report saved to logs/upload_freeze_report.log`);
