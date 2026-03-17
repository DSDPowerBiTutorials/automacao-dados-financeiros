/**
 * Date utilities — TIMEZONE-FREE
 * All date operations treat dates as plain YYYY-MM-DD strings.
 * No timezone conversion is ever applied to date-only values.
 * The date the user picks is the date that gets stored and displayed.
 */

/**
 * Helper: extract YYYY-MM-DD from a string (strips time/timezone part)
 */
function extractDatePart(s: string): string {
    return s.split('T')[0];
}

/**
 * Helper: format a Date object as YYYY-MM-DD using LOCAL getters (no timezone conversion)
 */
function dateToYMD(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get current date as a Date object (local time, no timezone conversion)
 */
export function getMadridDate(): Date {
    return new Date();
}

/**
 * Format date for database (YYYY-MM-DD).
 * If the input is already a YYYY-MM-DD string, return it as-is — NO Date object, NO timezone.
 */
export function formatDateForDB(dateString: string | Date | null | undefined): string {
    if (!dateString) return "";

    if (typeof dateString === 'string') {
        const datePart = extractDatePart(dateString);
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            return datePart;
        }
        // Try to extract YYYY-MM-DD from any format
        const match = dateString.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (match) return `${match[1]}-${match[2]}-${match[3]}`;
        return dateString;
    }

    return dateToYMD(dateString);
}

/**
 * Format date from database for input[type="date"] (YYYY-MM-DD)
 */
export function formatDateForInput(dateString: string | null | undefined): string {
    if (!dateString) return "";
    const datePart = extractDatePart(dateString);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        console.warn('Invalid date format:', dateString);
        return "";
    }
    return datePart;
}

/**
 * Format date for display (DD/MM/YYYY) — pure string manipulation, no Date objects
 */
export function formatDateForDisplay(dateString: string | Date | null | undefined, _locale: string = 'es-ES'): string {
    if (!dateString) return "";

    let datePart: string;
    if (typeof dateString === 'string') {
        datePart = extractDatePart(dateString);
    } else {
        datePart = dateToYMD(dateString);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return "";
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}`;
}

/**
 * Format datetime for display with time (DD/MM/YYYY HH:MM)
 */
export function formatDateTimeForDisplay(dateString: string | Date | null | undefined, _locale: string = 'es-ES'): string {
    if (!dateString) return "";

    if (typeof dateString === 'string') {
        const datePart = extractDatePart(dateString);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return dateString;
        const [year, month, day] = datePart.split('-');
        const timePart = dateString.includes('T') ? dateString.split('T')[1]?.substring(0, 5) : '';
        return timePart ? `${day}/${month}/${year} ${timePart}` : `${day}/${month}/${year}`;
    }

    const dp = dateToYMD(dateString);
    const [year, month, day] = dp.split('-');
    const hours = String(dateString.getHours()).padStart(2, '0');
    const minutes = String(dateString.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Get current date in YYYY-MM-DD format (local time)
 */
export function getCurrentDateForDB(): string {
    return dateToYMD(new Date());
}

/**
 * Get current timestamp in ISO format
 */
export function getCurrentTimestamp(): string {
    return new Date().toISOString();
}

/**
 * Parse date string to Date object — uses UTC noon to avoid any midnight timezone shift
 */
export function parseMadridDate(dateString: string): Date {
    if (!dateString) return new Date();

    const datePart = extractDatePart(dateString);
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        // Parse as UTC noon — safe from any timezone shift
        const [y, m, d] = datePart.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    }

    return new Date(dateString);
}

/**
 * Compare two dates (returns -1, 0, or 1) — string comparison for YYYY-MM-DD
 */
export function compareDates(date1: string | Date, date2: string | Date): number {
    const s1 = typeof date1 === 'string' ? extractDatePart(date1) : dateToYMD(date1);
    const s2 = typeof date2 === 'string' ? extractDatePart(date2) : dateToYMD(date2);

    if (s1 < s2) return -1;
    if (s1 > s2) return 1;
    return 0;
}

/**
 * Check if date is in the past
 */
export function isPastDate(dateString: string): boolean {
    const datePart = extractDatePart(dateString);
    const today = dateToYMD(new Date());
    return datePart < today;
}

/**
 * Check if date is today
 */
export function isToday(dateString: string): boolean {
    const datePart = extractDatePart(dateString);
    const today = dateToYMD(new Date());
    return datePart === today;
}

/**
 * Add days to a date
 */
export function addDays(dateString: string | Date, days: number): string {
    const datePart = typeof dateString === 'string' ? extractDatePart(dateString) : dateToYMD(dateString);
    const [y, m, d] = datePart.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    return dateToYMD(date);
}

/**
 * Get difference in days between two dates
 */
export function getDaysDifference(date1: string | Date, date2: string | Date): number {
    const s1 = typeof date1 === 'string' ? extractDatePart(date1) : dateToYMD(date1);
    const s2 = typeof date2 === 'string' ? extractDatePart(date2) : dateToYMD(date2);

    const [y1, m1, d1] = s1.split('-').map(Number);
    const [y2, m2, d2] = s2.split('-').map(Number);

    const dt1 = Date.UTC(y1, m1 - 1, d1);
    const dt2 = Date.UTC(y2, m2 - 1, d2);

    return Math.ceil(Math.abs(dt2 - dt1) / (1000 * 60 * 60 * 24));
}

/**
 * Format relative time
 * Shows "Just now", "X min ago", "Xh ago", "Yesterday", etc.
 */
export function formatRelativeTime(
    dateString: string | Date | null | undefined
): string {
    if (!dateString) return "";

    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const now = new Date();

    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return formatDateForDisplay(dateString);
}
