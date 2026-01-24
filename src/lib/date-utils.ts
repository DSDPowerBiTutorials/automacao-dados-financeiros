/**
 * Date utilities with Madrid timezone (Europe/Madrid)
 * All date operations in the system use Madrid timezone as reference
 */

const MADRID_TIMEZONE = 'Europe/Madrid';

/**
 * Get current date/time in Madrid timezone
 */
export function getMadridDate(): Date {
    const now = new Date();
    const madridTime = new Date(now.toLocaleString('en-US', { timeZone: MADRID_TIMEZONE }));
    return madridTime;
}

/**
 * Format date for database (YYYY-MM-DD) using Madrid timezone
 * Ensures dates are stored consistently regardless of user's local timezone
 */
export function formatDateForDB(dateString: string | Date | null | undefined): string {
    if (!dateString) return "";

    let date: Date;

    if (typeof dateString === 'string') {
        // If already in YYYY-MM-DD format, parse it as Madrid timezone
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            // Parse as Madrid noon to avoid any timezone shift
            date = new Date(dateString + 'T12:00:00');
        } else {
            date = new Date(dateString);
        }
    } else {
        date = dateString;
    }

    // Format using Madrid timezone
    const madridDateStr = date.toLocaleDateString('en-CA', {
        timeZone: MADRID_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    return madridDateStr; // Returns YYYY-MM-DD
}

/**
 * Format date from database for input[type="date"] (YYYY-MM-DD)
 * Ensures dates are displayed consistently in Madrid timezone
 */
export function formatDateForInput(dateString: string | null | undefined): string {
    if (!dateString) return "";

    // Remove time part if present
    const datePart = dateString.split('T')[0];

    // Validate YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        console.warn('Invalid date format:', dateString);
        return "";
    }

    return datePart;
}

/**
 * Format date for display (localized format)
 * Uses Madrid timezone for consistent display
 */
export function formatDateForDisplay(dateString: string | Date | null | undefined, locale: string = 'es-ES'): string {
    if (!dateString) return "";

    let date: Date;

    if (typeof dateString === 'string') {
        // Parse with noon time to avoid timezone shifts
        date = new Date(dateString.split('T')[0] + 'T12:00:00');
    } else {
        date = dateString;
    }

    return date.toLocaleDateString(locale, {
        timeZone: MADRID_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

/**
 * Format datetime for display with time
 */
export function formatDateTimeForDisplay(dateString: string | Date | null | undefined, locale: string = 'es-ES'): string {
    if (!dateString) return "";

    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

    return date.toLocaleString(locale, {
        timeZone: MADRID_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Get current date in YYYY-MM-DD format (Madrid timezone)
 */
export function getCurrentDateForDB(): string {
    const madridDate = getMadridDate();
    return madridDate.toLocaleDateString('en-CA', {
        timeZone: MADRID_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

/**
 * Get current timestamp in ISO format (Madrid timezone)
 */
export function getCurrentTimestamp(): string {
    const now = new Date();
    // Convert to Madrid timezone and return ISO string
    const madridTime = new Date(now.toLocaleString('en-US', { timeZone: MADRID_TIMEZONE }));
    return madridTime.toISOString();
}

/**
 * Parse date string to Date object using Madrid timezone
 */
export function parseMadridDate(dateString: string): Date {
    if (!dateString) return new Date();

    // If YYYY-MM-DD format, parse as Madrid noon
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return new Date(dateString + 'T12:00:00');
    }

    return new Date(dateString);
}

/**
 * Compare two dates (returns -1, 0, or 1)
 */
export function compareDates(date1: string | Date, date2: string | Date): number {
    const d1 = typeof date1 === 'string' ? parseMadridDate(date1) : date1;
    const d2 = typeof date2 === 'string' ? parseMadridDate(date2) : date2;

    if (d1 < d2) return -1;
    if (d1 > d2) return 1;
    return 0;
}

/**
 * Check if date is in the past (Madrid timezone)
 */
export function isPastDate(dateString: string): boolean {
    const date = parseMadridDate(dateString);
    const today = getMadridDate();
    today.setHours(0, 0, 0, 0);

    return date < today;
}

/**
 * Check if date is today (Madrid timezone)
 */
export function isToday(dateString: string): boolean {
    const date = parseMadridDate(dateString);
    const today = getMadridDate();

    return date.toLocaleDateString('en-CA', { timeZone: MADRID_TIMEZONE }) ===
        today.toLocaleDateString('en-CA', { timeZone: MADRID_TIMEZONE });
}

/**
 * Add days to a date (Madrid timezone)
 */
export function addDays(dateString: string | Date, days: number): string {
    const date = typeof dateString === 'string' ? parseMadridDate(dateString) : dateString;
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);

    return formatDateForDB(newDate);
}

/**
 * Get difference in days between two dates
 */
export function getDaysDifference(date1: string | Date, date2: string | Date): number {
    const d1 = typeof date1 === 'string' ? parseMadridDate(date1) : date1;
    const d2 = typeof date2 === 'string' ? parseMadridDate(date2) : date2;

    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
}

// =============================================================================
// USER TIMEZONE CONVERSION UTILITIES
// All data is stored in Europe/Madrid timezone
// These functions convert dates for display in the user's local timezone
// =============================================================================

/**
 * List of supported timezones with display names
 */
export const SUPPORTED_TIMEZONES = [
    { value: 'Europe/Madrid', label: 'Spain (Madrid)', offset: '+1/+2' },
    { value: 'America/Sao_Paulo', label: 'Brazil (São Paulo)', offset: '-3' },
    { value: 'America/New_York', label: 'USA East (New York)', offset: '-5/-4' },
    { value: 'America/Los_Angeles', label: 'USA West (Los Angeles)', offset: '-8/-7' },
    { value: 'America/Mexico_City', label: 'Mexico (Mexico City)', offset: '-6/-5' },
    { value: 'Europe/London', label: 'UK (London)', offset: '+0/+1' },
    { value: 'Europe/Paris', label: 'France (Paris)', offset: '+1/+2' },
    { value: 'Europe/Berlin', label: 'Germany (Berlin)', offset: '+1/+2' },
    { value: 'Europe/Lisbon', label: 'Portugal (Lisbon)', offset: '+0/+1' },
    { value: 'Asia/Tokyo', label: 'Japan (Tokyo)', offset: '+9' },
    { value: 'Asia/Dubai', label: 'UAE (Dubai)', offset: '+4' },
    { value: 'Australia/Sydney', label: 'Australia (Sydney)', offset: '+10/+11' },
] as const;

export type SupportedTimezone = typeof SUPPORTED_TIMEZONES[number]['value'];

/**
 * Format date for display in user's local timezone
 * Data is stored in Madrid timezone, this converts for display only
 */
export function formatDateForUserTimezone(
    dateString: string | Date | null | undefined,
    userTimezone: string = MADRID_TIMEZONE,
    locale: string = 'es-ES'
): string {
    if (!dateString) return "";

    const date = typeof dateString === 'string' ? parseMadridDate(dateString) : dateString;

    return date.toLocaleDateString(locale, {
        timeZone: userTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

/**
 * Format datetime for display in user's local timezone
 */
export function formatDateTimeForUserTimezone(
    dateString: string | Date | null | undefined,
    userTimezone: string = MADRID_TIMEZONE,
    locale: string = 'es-ES'
): string {
    if (!dateString) return "";

    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

    return date.toLocaleString(locale, {
        timeZone: userTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Get current date in user's timezone for display (not for storage!)
 */
export function getCurrentDateInUserTimezone(userTimezone: string = MADRID_TIMEZONE): Date {
    const now = new Date();
    const userTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
    return userTime;
}

/**
 * Get the timezone difference label between Madrid and user timezone
 */
export function getTimezoneOffsetLabel(userTimezone: string): string {
    const now = new Date();

    // Get current hour in both timezones
    const madridHour = parseInt(now.toLocaleString('en-US', {
        timeZone: MADRID_TIMEZONE,
        hour: 'numeric',
        hour12: false
    }));

    const userHour = parseInt(now.toLocaleString('en-US', {
        timeZone: userTimezone,
        hour: 'numeric',
        hour12: false
    }));

    const diff = userHour - madridHour;

    if (diff === 0) return 'Same as Spain';
    if (diff > 0) return `+${diff}h from Spain`;
    return `${diff}h from Spain`;
}

/**
 * Format relative time in user's timezone
 */
export function formatRelativeTimeForUser(
    dateString: string | Date | null | undefined,
    userTimezone: string = MADRID_TIMEZONE
): string {
    if (!dateString) return "";

    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const now = new Date();

    // Convert both to user timezone for comparison
    const dateInUserTz = new Date(date.toLocaleString('en-US', { timeZone: userTimezone }));
    const nowInUserTz = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));

    const diffMs = nowInUserTz.getTime() - dateInUserTz.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return formatDateForUserTimezone(dateString, userTimezone);
}
