import { promises as fs } from "fs"
import path from "path"

const allowed = new Set(["reconciliation-center", "integration-insights"])
const actionsDir = path.join(process.cwd(), "src", "app", "actions")
const logFile = path.join(process.cwd(), "logs", "action_protection.log")

async function ensureActionsProtected() {
  try {
    await fs.mkdir(path.dirname(logFile), { recursive: true })

    const entries = await fs.readdir(actionsDir, { withFileTypes: true })
    const removals: string[] = []

    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && !allowed.has(entry.name))
        .map(async (entry) => {
          const target = path.join(actionsDir, entry.name)
          await fs.rm(target, { recursive: true, force: true })
          removals.push(entry.name)
        })
    )

    if (removals.length > 0) {
      const timestamp = new Date().toISOString()
      const logEntries = removals
        .map((dir) => `${timestamp} | Removed unauthorized page: ${dir}`)
        .join("\n")
      await fs.appendFile(logFile, `${logEntries}\n`)
      console.warn("⚠️ Unauthorized Actions pages removed:", removals.join(", "))
    }

    console.log("✅ Actions section validated and locked.")
  } catch (error) {
    console.error("❌ Failed to validate /actions directory:", error)
    process.exitCode = 1
  }
}

ensureActionsProtected()
