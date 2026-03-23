export interface WhatsNewItem {
    id: number;
    date: string;
    title: string;
    description: string;
    features: string[];
    tag: "feature" | "improvement" | "fix";
}

/**
 * Static array of release notes — newest first.
 * To add a new entry: prepend an item with an incremented `id`.
 */
export const WHATS_NEW_ITEMS: WhatsNewItem[] = [
    {
        id: 1,
        date: "2026-03-21",
        title: "Payroll Concept Mapping & Invoice Creation",
        description:
            "New 2-popup flow for mapping payroll concepts to financial accounts and auto-allocating Labour costs by department.",
        features: [
            "Map each payroll concept to one of 7 financial accounts (Labour, COGS, Office RH)",
            "3 collapsible blocks: Conceptos, Deducciones, Seguridad Social Empresa",
            "Auto-suggestions from previous months' mappings",
            "'NEW' badge highlights unmapped concepts",
            "Automatic Labour allocation to department sub-accounts (202.1–202.5)",
            "Duplicate invoice detection with overwrite option",
            "Accessible via 'Map & Create' button in Payroll → AP Invoices card",
        ],
        tag: "feature",
    },
];

/** Returns the latest (highest) id among all items */
export function getLatestItemId(): number {
    return WHATS_NEW_ITEMS.length > 0 ? Math.max(...WHATS_NEW_ITEMS.map((i) => i.id)) : 0;
}

const STORAGE_KEY = "whats-new-last-read-id";

export function getLastReadId(): number {
    if (typeof window === "undefined") return 0;
    const val = localStorage.getItem(STORAGE_KEY);
    return val ? parseInt(val, 10) || 0 : 0;
}

export function markLatestAsRead(): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, String(getLatestItemId()));
}

export function hasUnread(): boolean {
    return getLatestItemId() > getLastReadId();
}
