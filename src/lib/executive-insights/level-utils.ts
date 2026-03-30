/**
 * Utility functions for client level detection and formatting
 * Used across all Executive Insights pages
 */

export type ClientLevel = "Lvl3_ROW" | "Lvl3_AMEX" | "Lvl2" | "Lvl1";

/**
 * Detect client level from financial account code
 * - 104.1, 104.3 = Level 3 ROW
 * - 104.2, 104.4 = Level 3 AMEX
 * - 104.5 = Level 2
 * - 104.6 = Level 1
 */
export function getClientLevel(financialAccountCode: string): ClientLevel | null {
    if (!financialAccountCode) return null;

    if (/^104\.[13]/.test(financialAccountCode)) return "Lvl3_ROW";
    if (/^104\.[24]/.test(financialAccountCode)) return "Lvl3_AMEX";
    if (/^104\.5/.test(financialAccountCode)) return "Lvl2";
    if (/^104\.6/.test(financialAccountCode)) return "Lvl1";

    return null;
}

/**
 * Format date to YYYY-MM for grouping
 */
export function formatToMonth(date: Date): string {
    return date.toISOString().slice(0, 7); // "2025-01"
}

/**
 * Convert growth percentage to trend indicator
 */
export function trendToIcon(growthPercent: number): "up" | "down" | "stable" {
    if (growthPercent > 2) return "up";
    if (growthPercent < -2) return "down";
    return "stable";
}

/**
 * Get trend color based on growth (green = up, red = down, gray = stable)
 */
export function trendToColor(growthPercent: number): string {
    if (growthPercent > 2) return "text-green-600 dark:text-green-400";
    if (growthPercent < -2) return "text-red-600 dark:text-red-400";
    return "text-gray-500 dark:text-gray-400";
}

/**
 * Format percentage with +/- prefix
 */
export function formatTrendPercent(percent: number): string {
    if (percent > 0) return `+${percent.toFixed(1)}%`;
    return `${percent.toFixed(1)}%`;
}

/**
 * Human-readable labels for each level
 */
export const LEVEL_LABELS: Record<ClientLevel, string> = {
    Lvl3_ROW: "Level 3 (ROW)",
    Lvl3_AMEX: "Level 3 (AMEX)",
    Lvl2: "Level 2",
    Lvl1: "Level 1",
};

/**
 * Colors for charting (Recharts compatible)
 */
export const LEVEL_COLORS: Record<ClientLevel, string> = {
    "Lvl3_ROW": "#2563eb",    // blue
    "Lvl3_AMEX": "#0891b2",   // cyan
    "Lvl2": "#7c3aed",        // purple
    "Lvl1": "#db2777",        // pink
};

/**
 * Tailwind color classes for UI
 */
export const LEVEL_BG_COLORS: Record<ClientLevel, string> = {
    "Lvl3_ROW": "bg-blue-50 dark:bg-blue-950",
    "Lvl3_AMEX": "bg-cyan-50 dark:bg-cyan-950",
    "Lvl2": "bg-purple-50 dark:bg-purple-950",
    "Lvl1": "bg-pink-50 dark:bg-pink-950",
};

export const LEVEL_BORDER_COLORS: Record<ClientLevel, string> = {
    "Lvl3_ROW": "border-blue-200 dark:border-blue-800",
    "Lvl3_AMEX": "border-cyan-200 dark:border-cyan-800",
    "Lvl2": "border-purple-200 dark:border-purple-800",
    "Lvl1": "border-pink-200 dark:border-pink-800",
};

export const LEVEL_TEXT_COLORS: Record<ClientLevel, string> = {
    "Lvl3_ROW": "text-blue-700 dark:text-blue-300",
    "Lvl3_AMEX": "text-cyan-700 dark:text-cyan-300",
    "Lvl2": "text-purple-700 dark:text-purple-300",
    "Lvl1": "text-pink-700 dark:text-pink-300",
};

/**
 * All available levels (in consistent order)
 */
export const ALL_LEVELS: ClientLevel[] = ["Lvl3_ROW", "Lvl3_AMEX", "Lvl2", "Lvl1"];

/**
 * Get performance score color
 */
export function getScoreColor(score: number): string {
    if (score >= 70) return "text-green-600 dark:text-green-400";
    if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
}

/**
 * Get performance score background
 */
export function getScoreBgColor(score: number): string {
    if (score >= 70) return "bg-green-50 dark:bg-green-950";
    if (score >= 50) return "bg-yellow-50 dark:bg-yellow-950";
    return "bg-red-50 dark:bg-red-950";
}

/**
 * Format currency
 */
export function formatCurrency(value: number, currency = "EUR"): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}
