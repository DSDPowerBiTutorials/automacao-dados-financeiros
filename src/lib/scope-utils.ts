export type ScopeType = "all" | "dsd" | "lh" | "dsd_lh" | "ES" | "US" | "GLOBAL";

export interface ScopeConfig {
  label: string;
  icon: string;
  color: string;
}

export const SCOPE_CONFIG: Record<ScopeType, ScopeConfig> = {
  all: {
    label: "All",
    icon: "🌐",
    color: "gray"
  },
  dsd: {
    label: "DSD",
    icon: "🎓",
    color: "blue"
  },
  lh: {
    label: "LH",
    icon: "🏠",
    color: "green"
  },
  dsd_lh: {
    label: "DSD+LH",
    icon: "🔗",
    color: "purple"
  },
  ES: {
    label: "Spain",
    icon: "🇪🇸",
    color: "red"
  },
  US: {
    label: "United States",
    icon: "🇺🇸",
    color: "blue"
  },
  GLOBAL: {
    label: "Global",
    icon: "🌐",
    color: "purple"
  }
};

export function getScopeIcon(scope: ScopeType): string {
  return SCOPE_CONFIG[scope]?.icon || "🌐";
}

export function getRecordScope(record: any): ScopeType {
  if (record.scope) return record.scope;
  if (record.country_code) return record.country_code as ScopeType;
  if (record.dsd && record.lh) return "dsd_lh";
  if (record.dsd) return "dsd";
  if (record.lh) return "lh";
  return "all";
}

export function matchesScope(record: any, targetScope: ScopeType): boolean {
  if (targetScope === "all") return true;
  
  // Handle country-based scope
  if (targetScope === "ES" || targetScope === "US" || targetScope === "GLOBAL") {
    return record.country_code === targetScope || record.scope === targetScope;
  }
  
  // Handle company-based scope
  const recordScope = getRecordScope(record);
  return recordScope === targetScope || recordScope === "dsd_lh";
}

export function scopeToFields(scope: ScopeType): { dsd: boolean; lh: boolean } {
  switch (scope) {
    case "dsd":
      return { dsd: true, lh: false };
    case "lh":
      return { dsd: false, lh: true };
    case "dsd_lh":
      return { dsd: true, lh: true };
    default:
      return { dsd: false, lh: false };
  }
}