"use client";

import { promises as fs } from "fs";
import path from "path";

type SourceType = "bank" | "payment_source";

const configPath = path.join(process.cwd(), "src", "lib", "sourceConfig.json");

/**
 * Adds a new source to the dashboard configuration so newly ingested
 * transactions automatically appear in analytics and reconciliation views.
 */
export async function addNewSource(type: SourceType, name: string) {
  try {
    const fileContent = await fs.readFile(configPath, "utf8");
    const config = JSON.parse(fileContent);
    const targetKey = type === "bank" ? "banks" : "payment_sources";

    if (!Array.isArray(config[targetKey])) {
      config[targetKey] = [];
    }

    if (!config[targetKey].includes(name)) {
      config[targetKey].push(name);
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
      console.log(
        `✅ Added new ${type}: ${name} → dashboard will reflect automatically.`,
      );
    }
  } catch (error) {
    console.error("❌ Failed to update source configuration:", error);
  }
}
