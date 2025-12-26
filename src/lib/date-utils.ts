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
