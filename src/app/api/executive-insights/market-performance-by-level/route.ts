import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getClientLevel, ClientLevel, ALL_LEVELS } from "@/lib/executive-insights/level-utils";

// ============================================================
// Executive Insights → Market Performance by Client Level
// Composite score: Revenue Growth + Customer Trend - Concentration Risk
// Performance Score = (RG×0.4 + CT×0.3 - CR×0.3) scaled 0-100
// ============================================================

interface MarketPerformanceMetrics {
    revenueGrowth: number; // % growth period-over-period
    customerCountTrend: number; // % growth in customer count
    concentrationRisk: number; // % revenue from top 5 customers
    performanceScore: number; // 0-100 composite
    trend: "up" | "down" | "stable";
}

interface MarketPerformanceResponse {
    data: {
        levels: Record<ClientLevel, MarketPerformanceMetrics>;
        summary: {
            bestPerformer: ClientLevel | null;
            mostAtRisk: ClientLevel | null;
        };
    };
    calculationNote: string;
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const faCodeFilter = searchParams.get("faCodeFilter") || "all";
    const comparisonPeriodMonths = parseInt(searchParams.get("comparisonPeriodMonths") || "12");

    try {
        // Parse FA code filter
        let faCodeList: string[] = [];
        if (faCodeFilter !== "all") {
            faCodeList = faCodeFilter.split(",").map((s) => s.trim());
        }

        // Calculate date ranges
        const now = new Date();
        const currentPeriodStart = new Date(now);
        currentPeriodStart.setMonth(currentPeriodStart.getMonth() - Math.floor(comparisonPeriodMonths / 2));

        const previousPeriodStart = new Date(currentPeriodStart);
        previousPeriodStart.setMonth(previousPeriodStart.getMonth() - Math.floor(comparisonPeriodMonths / 2));

        const previousPeriodEnd = new Date(currentPeriodStart);
        previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);

        // Query ar_invoices for both periods
        const query = supabaseAdmin
            .from("ar_invoices")
            .select("email, total_amount, invoice_date, source_data");

        const { data: allInvoices, error: invoicesError } = await query;

        if (invoicesError) {
            console.error("Error fetching ar_invoices:", invoicesError);
            return NextResponse.json(
                { error: "Failed to fetch invoice data" },
                { status: 500 }
            );
        }

        // Separate into periods and levels
        const levelCurrentPeriod: Record<
            ClientLevel,
            Map<string, number> // customer email -> revenue
        > = {
            Lvl3_ROW: new Map(),
            Lvl3_AMEX: new Map(),
            Lvl2: new Map(),
            Lvl1: new Map(),
        };

        const levelPreviousPeriod: Record<
            ClientLevel,
            Map<string, number>
        > = {
            Lvl3_ROW: new Map(),
            Lvl3_AMEX: new Map(),
            Lvl2: new Map(),
            Lvl1: new Map(),
        };

        for (const invoice of allInvoices || []) {
            const faCode = invoice.source_data?.financial_account_code || "";
            const level = getClientLevel(faCode);
            if (!level) continue;

            // Filter by FA codes if specified
            if (faCodeList.length > 0 && !faCodeList.includes(faCode)) {
                continue;
            }

            const invoiceDate = new Date(invoice.invoice_date);
            const email = invoice.email || "unknown";
            const revenue = invoice.total_amount || 0;

            if (invoiceDate >= currentPeriodStart) {
                const current = levelCurrentPeriod[level].get(email) || 0;
                levelCurrentPeriod[level].set(email, current + revenue);
            } else if (invoiceDate >= previousPeriodStart && invoiceDate <= previousPeriodEnd) {
                const previous = levelPreviousPeriod[level].get(email) || 0;
                levelPreviousPeriod[level].set(email, previous + revenue);
            }
        }

        // Calculate metrics for each level
        const metrics: Record<ClientLevel, MarketPerformanceMetrics> = {} as Record<
            ClientLevel,
            MarketPerformanceMetrics
        >;

        for (const level of ALL_LEVELS) {
            const currentCustomers = levelCurrentPeriod[level];
            const previousCustomers = levelPreviousPeriod[level];

            const currentRevenue = Array.from(currentCustomers.values()).reduce((a, b) => a + b, 0);
            const previousRevenue = Array.from(previousCustomers.values()).reduce((a, b) => a + b, 0);
            const currentCustomerCount = currentCustomers.size;
            const previousCustomerCount = previousCustomers.size;

            // Calculate revenue growth %
            const revenueGrowth =
                previousRevenue !== 0
                    ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 1000) / 10
                    : 0;

            // Calculate customer count trend %
            const customerCountTrend =
                previousCustomerCount !== 0
                    ? Math.round(((currentCustomerCount - previousCustomerCount) / previousCustomerCount) * 1000) / 10
                    : 0;

            // Calculate concentration risk (top 5 customers)
            const topCustomers = Array.from(currentCustomers.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .reduce((sum, [, revenue]) => sum + revenue, 0);

            const concentrationRisk =
                currentRevenue !== 0
                    ? Math.round((topCustomers / currentRevenue) * 1000) / 10
                    : 0;

            // Calculate composite performance score
            // Formula: (RevenueGrowth × 0.4 + CustomerTrend × 0.3 − ConcentrationRisk × 0.3) scaled 0-100
            // Weights: RG 40%, CT 30%, CR 30% (negative)
            // Scale: input range roughly [-50 to +50] → output [0 to 100]
            const rawScore = revenueGrowth * 0.4 + customerCountTrend * 0.3 - concentrationRisk * 0.3;
            const performanceScore = Math.max(0, Math.min(100, ((rawScore + 50) / 100) * 100));

            // Determine trend
            const trend: "up" | "down" | "stable" =
                revenueGrowth > 5 || customerCountTrend > 5
                    ? "up"
                    : revenueGrowth < -5 || customerCountTrend < -5
                        ? "down"
                        : "stable";

            metrics[level] = {
                revenueGrowth: Math.round(revenueGrowth * 10) / 10,
                customerCountTrend: Math.round(customerCountTrend * 10) / 10,
                concentrationRisk: Math.round(concentrationRisk * 10) / 10,
                performanceScore: Math.round(performanceScore),
                trend,
            };
        }

        // Find best and worst performers
        let bestPerformer: ClientLevel | null = null;
        let bestScore = -1;
        let mostAtRisk: ClientLevel | null = null;
        let worstScore = 101;

        for (const level of ALL_LEVELS) {
            const score = metrics[level].performanceScore;
            if (score > bestScore) {
                bestScore = score;
                bestPerformer = level;
            }
            if (score < worstScore) {
                worstScore = score;
                mostAtRisk = level;
            }
        }

        const response: MarketPerformanceResponse = {
            data: {
                levels: metrics,
                summary: {
                    bestPerformer,
                    mostAtRisk,
                },
            },
            calculationNote: `Market Performance Score (0-100) combines: Revenue Growth (40% weight) = (current - previous) / previous × 100%. Customer Trend (30%) = (current customers - previous) / previous × 100%. Concentration Risk (30%, negative weight) = top 5 customers revenue / total × 100%. Formula: (RG×0.4 + CT×0.3 − CR×0.3) scaled 0-100. Higher scores indicate better market position.`,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error("Market performance by level error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
