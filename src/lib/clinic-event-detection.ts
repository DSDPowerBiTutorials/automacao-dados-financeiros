/**
 * Clinic Event Detection Utilities
 * 
 * Provides automatic detection of clinic lifecycle events:
 * - New: First appearance of a clinic
 * - Churn: No transactions for 2+ consecutive months
 * - Pause: Zero revenue in a month but not churned
 * - Return: Activity resumed after Pause
 */

export type ClinicEventType = "New" | "Pause" | "Return" | "Churn";

export interface ClinicMonthlyData {
    email: string;
    name: string;
    yearMonth: string;
    revenue: number;
    transactionCount: number;
}

export interface DetectedEvent {
    email: string;
    eventType: ClinicEventType;
    yearMonth: string;
    confidence: "high" | "medium" | "low";
    reason: string;
}

/**
 * Detect lifecycle events for a clinic based on monthly transaction data
 */
export function detectClinicEvents(
    monthlyData: ClinicMonthlyData[],
    allMonths: string[] // Sorted list of all months in the period
): DetectedEvent[] {
    const events: DetectedEvent[] = [];

    // Group by email
    const byEmail = new Map<string, ClinicMonthlyData[]>();
    for (const data of monthlyData) {
        const existing = byEmail.get(data.email) || [];
        existing.push(data);
        byEmail.set(data.email, existing);
    }

    for (const [email, clinicData] of byEmail) {
        // Sort by month
        const sorted = clinicData.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
        const activeMonths = new Set(sorted.map(d => d.yearMonth));

        // Detect NEW (first month with transactions)
        const firstMonth = sorted[0]?.yearMonth;
        if (firstMonth) {
            events.push({
                email,
                eventType: "New",
                yearMonth: firstMonth,
                confidence: "high",
                reason: `First transaction in ${firstMonth}`,
            });
        }

        // Detect gaps in activity
        let lastActiveMonth: string | null = null;
        let inPause = false;

        for (const month of allMonths) {
            const isActive = activeMonths.has(month);

            if (lastActiveMonth && !isActive) {
                // Calculate months since last activity
                const lastDate = new Date(lastActiveMonth + "-01");
                const currentDate = new Date(month + "-01");
                const monthsDiff = (currentDate.getFullYear() - lastDate.getFullYear()) * 12
                    + (currentDate.getMonth() - lastDate.getMonth());

                if (monthsDiff === 1 && !inPause) {
                    // First month without activity - could be pause
                    events.push({
                        email,
                        eventType: "Pause",
                        yearMonth: month,
                        confidence: "low",
                        reason: `No activity in ${month} after ${lastActiveMonth}`,
                    });
                    inPause = true;
                } else if (monthsDiff >= 2) {
                    // 2+ months without activity - likely Churn
                    events.push({
                        email,
                        eventType: "Churn",
                        yearMonth: month,
                        confidence: monthsDiff >= 3 ? "high" : "medium",
                        reason: `No activity for ${monthsDiff} months since ${lastActiveMonth}`,
                    });
                    inPause = false; // Upgrade pause to churn
                }
            } else if (isActive) {
                if (inPause) {
                    // Activity resumed after pause
                    events.push({
                        email,
                        eventType: "Return",
                        yearMonth: month,
                        confidence: "high",
                        reason: `Activity resumed in ${month}`,
                    });
                }
                lastActiveMonth = month;
                inPause = false;
            }
        }

        // Check if currently churned (no activity in last 2 months)
        if (lastActiveMonth) {
            const today = new Date();
            const lastDate = new Date(lastActiveMonth + "-01");
            const monthsDiff = (today.getFullYear() - lastDate.getFullYear()) * 12
                + (today.getMonth() - lastDate.getMonth());

            if (monthsDiff >= 2) {
                const churnMonth = new Date(lastDate);
                churnMonth.setMonth(churnMonth.getMonth() + 1);
                const churnYearMonth = `${churnMonth.getFullYear()}-${String(churnMonth.getMonth() + 1).padStart(2, "0")}`;

                // Only add if not already detected
                const alreadyChurned = events.some(
                    e => e.email === email && e.eventType === "Churn"
                );

                if (!alreadyChurned) {
                    events.push({
                        email,
                        eventType: "Churn",
                        yearMonth: churnYearMonth,
                        confidence: monthsDiff >= 3 ? "high" : "medium",
                        reason: `No activity for ${monthsDiff} months (last: ${lastActiveMonth})`,
                    });
                }
            }
        }
    }

    return events;
}

/**
 * Generate a list of all months in a year up to the target month
 */
export function generateMonthsRange(year: number, endMonth: number): string[] {
    const months: string[] = [];
    for (let m = 1; m <= endMonth; m++) {
        months.push(`${year}-${String(m).padStart(2, "0")}`);
    }
    return months;
}

/**
 * Compare two consecutive months to detect variations
 */
export function detectMonthlyVariations(
    currentMonth: ClinicMonthlyData[],
    previousMonth: ClinicMonthlyData[]
): {
    new: string[];
    churned: string[];
    increased: string[];
    decreased: string[];
} {
    const currentEmails = new Set(currentMonth.map(d => d.email));
    const previousEmails = new Set(previousMonth.map(d => d.email));

    const newClinics = [...currentEmails].filter(e => !previousEmails.has(e));
    const churnedClinics = [...previousEmails].filter(e => !currentEmails.has(e));

    const previousRevenue = new Map(previousMonth.map(d => [d.email, d.revenue]));

    const increased: string[] = [];
    const decreased: string[] = [];

    for (const data of currentMonth) {
        const prev = previousRevenue.get(data.email) || 0;
        if (data.revenue > prev) {
            increased.push(data.email);
        } else if (data.revenue < prev) {
            decreased.push(data.email);
        }
    }

    return {
        new: newClinics,
        churned: churnedClinics,
        increased,
        decreased,
    };
}

/**
 * Check if a clinic should show Churn propagation in YTD view
 * (After a churn event, show "churned" status in subsequent months)
 */
export function shouldPropagateChurn(
    clinicEmail: string,
    targetMonth: string,
    events: DetectedEvent[]
): boolean {
    const churnEvent = events.find(
        e => e.email === clinicEmail && e.eventType === "Churn"
    );

    if (!churnEvent) return false;

    // Check if target month is after churn month
    return targetMonth > churnEvent.yearMonth;
}
