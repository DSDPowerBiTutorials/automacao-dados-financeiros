import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getClientLevel, formatToMonth, ClientLevel, ALL_LEVELS } from "@/lib/executive-insights/level-utils";

// ============================================================
// Executive Insights → Revenue Trends by Client Level
// All products, grouped by month and level with trend forecast
// ============================================================

interface MonthlyRevenue {
    month: string;
    revenue: number;
}

interface LevelTrendData {
    monthly: MonthlyRevenue[];
    trend: {
        slope: number;
        intercept: number;
        forecast: MonthlyRevenue[]; // 3-month forward
    };
    total: number;
    avgMonthly: number;
}

interface RevenueTrendsResponse {
    data: {
        levels: Record<ClientLevel, LevelTrendData>;
        summary: {
            totalRevenue: number;
            totalMonths: number;
            avgMonthlyPerLevel: Record<ClientLevel, number>;
        };
    };
    calculationNote: string;
}

/**
 * Linear regression to calculate trend line and forecast
 */
function calculateLinearRegression(
    data: MonthlyRevenue[]
): { slope: number; intercept: number } {
    const n = data.length;
    if (n < 2) return { slope: 0, intercept: data[0]?.revenue || 0 };

    // x = months (0, 1, 2, ...)
    // y = revenue values
    const x = Array.from({ length: n }, (_, i) => i);
    const y = data.map((d) => d.revenue);

    const xMean = x.reduce((a, b) => a + b) / n;
    const yMean = y.reduce((a, b) => a + b) / n;

    const numerator = x.reduce((sum, xi, i) => sum + (xi - xMean) * (y[i] - yMean), 0);
    const denominator = x.reduce((sum, xi) => sum + (xi - xMean) ** 2, 0);

    const slope = denominator === 0 ? 0 : numerator / denominator;
    const intercept = yMean - slope * xMean;

    return { slope, intercept };
}

/**
 * Forecast next 3 months using linear regression
 */
function forecastNextMonths(
    monthly: MonthlyRevenue[],
    { slope, intercept }: { slope: number; intercept: number }
): MonthlyRevenue[] {
    const lastDate = new Date(monthly[monthly.length - 1]?.month + "-01");
    const forecast: MonthlyRevenue[] = [];

    for (let i = 1; i <= 3; i++) {
        const futureDate = new Date(lastDate);
        futureDate.setMonth(futureDate.getMonth() + i);
        const month = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}`;

        const x = monthly.length + i - 1;
        const revenue = Math.max(0, Math.round(intercept + slope * x));

        forecast.push({ month, revenue });
    }

    return forecast;
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const faCodeFilter = searchParams.get("faCodeFilter") || "all"; // comma-separated or "all"
    const dateRangeStart = searchParams.get("dateRangeStart") || getDateMonthsAgo(12);
    const dateRangeEnd = searchParams.get("dateRangeEnd") || getTodayISODate();

    try {
        // Parse FA code filter
        let faCodeList: string[] = [];
        if (faCodeFilter !== "all") {
            faCodeList = faCodeFilter.split(",").map((s) => s.trim());
        }

        // Query ar_invoices grouped by month and level
        const query = supabaseAdmin
            .from("ar_invoices")
            .select("invoice_date, total_amount, source_data")
            .gte("invoice_date", dateRangeStart)
            .lte("invoice_date", dateRangeEnd);

        const { data: invoices, error: invoicesError } = await query;

        if (invoicesError) {
            console.error("Error fetching ar_invoices:", invoicesError);
            return NextResponse.json(
                { error: "Failed to fetch invoice data" },
                { status: 500 }
            );
        }

        // Aggregate by month and level
        const levelData: Record<ClientLevel, Map<string, number>> = {
            Lvl3_ROW: new Map(),
            Lvl3_AMEX: new Map(),
            Lvl2: new Map(),
            Lvl1: new Map(),
        };

        for (const invoice of invoices || []) {
            const faCode = invoice.source_data?.financial_account_code || "";
            const level = getClientLevel(faCode);
            if (!level) continue;

            // Filter by FA codes if specified
            if (faCodeList.length > 0 && !faCodeList.includes(faCode)) {
                continue;
            }

            const month = formatToMonth(new Date(invoice.invoice_date));
            const currentTotal = levelData[level].get(month) || 0;
            levelData[level].set(month, currentTotal + (invoice.total_amount || 0));
        }

        // Convert maps to sorted arrays
        const levelTrends: Record<ClientLevel, LevelTrendData> = {} as Record<
            ClientLevel,
            LevelTrendData
        >;

        for (const level of ALL_LEVELS) {
            const monthlyMap = levelData[level];
            const monthly = Array.from(monthlyMap.entries())
                .map(([month, revenue]) => ({ month, revenue }))
                .sort((a, b) => a.month.localeCompare(b.month));

            const total = monthly.reduce((sum, m) => sum + m.revenue, 0);
            const avgMonthly = monthly.length > 0 ? total / monthly.length : 0;

            const { slope, intercept } = calculateLinearRegression(monthly);
            const forecast = forecastNextMonths(monthly, { slope, intercept });

            levelTrends[level] = {
                monthly,
                trend: { slope, intercept, forecast },
                total,
                avgMonthly: Math.round(avgMonthly),
            };
        }

        // Calculate summary
        const totalRevenue = Object.values(levelTrends).reduce((sum, t) => sum + t.total, 0);
        const avgMonthlyPerLevel: Record<ClientLevel, number> = {} as Record<ClientLevel, number>;
        for (const level of ALL_LEVELS) {
            avgMonthlyPerLevel[level] = levelTrends[level].avgMonthly;
        }

        const response: RevenueTrendsResponse = {
            data: {
                levels: levelTrends,
                summary: {
                    totalRevenue,
                    totalMonths: Math.max(...Object.values(levelTrends).map((t) => t.monthly.length)),
                    avgMonthlyPerLevel,
                },
            },
            calculationNote: `Revenue Trends: Sum of ar_invoices.invoice_amount grouped by month and client level. Levels determined by financial_account_code (104.1/3=Lvl3_ROW, 104.2/4=Lvl3_AMEX, 104.5=Lvl2, 104.6=Lvl1). Trend line uses linear regression with 3-month forward forecast.`,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error("Revenue by level error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * Helper: Get date N months ago
 */
function getDateMonthsAgo(months: number): string {
    const date = new Date();
    date.setMonth(date.getMonth() - months);
    return date.toISOString().split("T")[0];
}

/**
 * Helper: Get today's ISO date
 */
function getTodayISODate(): string {
    return new Date().toISOString().split("T")[0];
}
