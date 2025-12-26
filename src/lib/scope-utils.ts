export type ScopeType = "ES" | "US" | "GLOBAL";

export interface ScopeConfig {
  label: string;
  icon: string;
  color: string;
  countryCode: string;
  currency: string;
  description: string;
}

export const SCOPE_CONFIG: Record<ScopeType, ScopeConfig> = {
  ES: {
    label: "Spain",
    icon: "🇪🇸",
    color: "red",
    countryCode: "ES",
    currency: "EUR",
    description: "Spain Operations"
  },
  US: {
    label: "United States",
    icon: "🇺🇸",
    color: "blue",
    countryCode: "US",
    currency: "USD",
    description: "United States Operations"
  },
  GLOBAL: {
    label: "Global",
    icon: "🌐",
    color: "purple",
    countryCode: "GLOBAL",
    currency: "EUR",
    description: "Consolidated (Spain + US)"
  }
};

export function getScopeIcon(scope: ScopeType): string {
  return SCOPE_CONFIG[scope]?.icon || "🌐";
}

export function getRecordScope(record: any): ScopeType {
  if (record.scope) return record.scope as ScopeType;
  if (record.country_code === "ES") return "ES";
  if (record.country_code === "US") return "US";
  if (record.applies_to_all_countries) return "GLOBAL";
  return record.country_code || "ES";
}

export function matchesScope(record: any, targetScopes: ScopeType | Set<ScopeType>): boolean {
  const recordScope = getRecordScope(record);

  // Se targetScopes é um Set, verificar se o recordScope está nele
  if (targetScopes instanceof Set) {
    return targetScopes.has(recordScope) ||
      (targetScopes.has("GLOBAL") && (recordScope === "ES" || recordScope === "US")) ||
      (recordScope === "GLOBAL");
  }

  // Se targetScopes é um único valor
  if (targetScopes === "GLOBAL") return true; // GLOBAL mostra tudo
  return recordScope === targetScopes || recordScope === "GLOBAL";
}

export function scopeToFields(scope: ScopeType): { country_code: string; scope: string; applies_to_all_countries: boolean } {
  switch (scope) {
    case "ES":
      return { country_code: "ES", scope: "ES", applies_to_all_countries: false };
    case "US":
      return { country_code: "US", scope: "US", applies_to_all_countries: false };
    case "GLOBAL":
      return { country_code: "GLOBAL", scope: "GLOBAL", applies_to_all_countries: true };
    default:
      return { country_code: "ES", scope: "ES", applies_to_all_countries: false };
  }
}
