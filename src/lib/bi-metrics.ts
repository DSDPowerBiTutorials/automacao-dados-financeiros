import { type BIMetric } from "./bi-types";

export const REVENUE_METRICS: BIMetric[] = [
    { id: "101", label: "Growth", shortLabel: "Growth", faCode: "101", type: "revenue", color: "#10b981", icon: "TrendingUp" },
    { id: "102", label: "Clinics (Delight)", shortLabel: "Clinics", faCode: "102", type: "revenue", color: "#34d399", icon: "Building2" },
    { id: "103", label: "Planning Center", shortLabel: "PC", faCode: "103", type: "revenue", color: "#6ee7b7", icon: "Target" },
    { id: "104", label: "LAB", shortLabel: "LAB", faCode: "104", type: "revenue", color: "#059669", icon: "Package" },
    { id: "105", label: "Other Income", shortLabel: "Other", faCode: "105", type: "revenue", color: "#a7f3d0", icon: "DollarSign" },
];

export const EXPENSE_METRICS: BIMetric[] = [
    { id: "201", label: "COGS", shortLabel: "COGS", faCode: "201", type: "expense", color: "#ef4444", icon: "ShoppingCart" },
    { id: "202", label: "Labour", shortLabel: "Labour", faCode: "202", type: "expense", color: "#f97316", icon: "Users" },
    { id: "203", label: "Travel & Meals", shortLabel: "Travel", faCode: "203", type: "expense", color: "#f59e0b", icon: "Plane" },
    { id: "204", label: "Professional Fees", shortLabel: "Prof.", faCode: "204", type: "expense", color: "#eab308", icon: "Briefcase" },
    { id: "205", label: "Marketing", shortLabel: "Marketing", faCode: "205", type: "expense", color: "#e879f9", icon: "Megaphone" },
    { id: "206", label: "Office", shortLabel: "Office", faCode: "206", type: "expense", color: "#fb923c", icon: "Building" },
    { id: "207", label: "IT", shortLabel: "IT", faCode: "207", type: "expense", color: "#818cf8", icon: "Monitor" },
    { id: "208", label: "R&D", shortLabel: "R&D", faCode: "208", type: "expense", color: "#a78bfa", icon: "Lightbulb" },
    { id: "209", label: "Bank Fees", shortLabel: "Bank", faCode: "209", type: "expense", color: "#94a3b8", icon: "Landmark" },
    { id: "210", label: "Miscellaneous", shortLabel: "Misc", faCode: "210", type: "expense", color: "#78716c", icon: "MoreHorizontal" },
    { id: "211", label: "Depreciation", shortLabel: "Depr.", faCode: "211", type: "expense", color: "#6b7280", icon: "TrendingDown" },
    { id: "300", label: "FX Variation", shortLabel: "FX", faCode: "300", type: "expense", color: "#fbbf24", icon: "ArrowLeftRight" },
];

export const ALL_METRICS: BIMetric[] = [...REVENUE_METRICS, ...EXPENSE_METRICS];

export const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

export const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const QUARTER_MAP: Record<string, string[]> = {
    Q1: ["jan", "feb", "mar"],
    Q2: ["apr", "may", "jun"],
    Q3: ["jul", "aug", "sep"],
    Q4: ["oct", "nov", "dec"],
};

export function getMetricById(id: string): BIMetric | undefined {
    return ALL_METRICS.find((m) => m.id === id);
}

export function getMetricColor(id: string): string {
    return getMetricById(id)?.color ?? "#6b7280";
}
