import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getClientLevel, ClientLevel, ALL_LEVELS } from "@/lib/executive-insights/level-utils";

// ============================================================
// Executive Insights → Customer Health by Client Level
// KPIs: LTV, Churn Rate, Avg Order Value, Repeat Rate
// Based on 12-month history
// ============================================================

interface CustomerHealthMetrics {
    customerCount: number;
    ltv: number; // Lifetime Value (avg revenue per customer)
    churnRate: number; // % of inactive customers (>90d)
    avgOrderValue: number; // total revenue / order count
    repeatRate: number; // % of customers with 2+ orders
    recentTrend: "up" | "down" | "stable"; // Based on last 30d vs 60d
}

interface CustomerHealthResponse {
    data: {
        levels: Record<ClientLevel, CustomerHealthMetrics>;
    };
    calculationNote: string;
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const faCodeFilter = searchParams.get("faCodeFilter") || "all";

    try {
        // Parse FA code filter
        let faCodeList: string[] = [];
        if (faCodeFilter !== "all") {
            faCodeList = faCodeFilter.split(",").map((s) => s.trim());
        }

        // Query ar_invoices
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const query = supabaseAdmin
            .from("ar_invoices")
            .select("customer_email, invoice_amount, invoice_date, invoice_id, financial_account_code")
            .gte("invoice_date", oneYearAgo.toISOString().split("T")[0]);

        const { data: invoices, error: invoicesError } = await query;

        if (invoicesError) {
            console.error("Error fetching ar_invoices:", invoicesError);
            return NextResponse.json(
                { error: "Failed to fetch invoice data" },
                { status: 500 }
            );
        }

        // Aggregate by level and customer
        const levelCustomerData: Record<
            ClientLevel,
            Map<
                string,
                {
                    totalRevenue: number;
                    orderCount: number;
                    lastPurchaseDate: Date;
                    orderDates: Date[];
                }
            >
        > = {
            Lvl3_ROW: new Map(),
            Lvl3_AMEX: new Map(),
            Lvl2: new Map(),
            Lvl1: new Map(),
        };

        const now = new Date();
        for (const invoice of invoices || []) {
            const level = getClientLevel(invoice.financial_account_code);
            if (!level) continue;

            // Filter by FA codes if specified
            if (faCodeList.length > 0 && !faCodeList.includes(invoice.financial_account_code)) {
                continue;
            }

            const email = invoice.customer_email || "unknown";
            let customer = levelCustomerData[level].get(email);

            if (!customer) {
                customer = {
                    totalRevenue: 0,
                    orderCount: 0,
                    lastPurchaseDate: new Date(invoice.invoice_date),
                    orderDates: [],
                };
                levelCustomerData[level].set(email, customer);
            }

            customer.totalRevenue += invoice.invoice_amount || 0;
            customer.orderCount += 1;
            customer.orderDates.push(new Date(invoice.invoice_date));

            if (new Date(invoice.invoice_date) > customer.lastPurchaseDate) {
                customer.lastPurchaseDate = new Date(invoice.invoice_date);
            }
        }

        // Calculate metrics for each level
        const metrics: Record<ClientLevel, CustomerHealthMetrics> = {} as Record<
            ClientLevel,
            CustomerHealthMetrics
        >;

        for (const level of ALL_LEVELS) {
            const customers = levelCustomerData[level];
            const customerCount = customers.size;

            if (customerCount === 0) {
                metrics[level] = {
                    customerCount: 0,
                    ltv: 0,
                    churnRate: 0,
                    avgOrderValue: 0,
                    repeatRate: 0,
                    recentTrend: "stable",
                };
                continue;
            }

            // Calculate LTV
            let totalRevenue = 0;
            let totalOrders = 0;
            let churnedCount = 0;
            let repeatCustomers = 0;

            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const sixtyDaysAgo = new Date(now);
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
            const ninetyDaysAgo = new Date(now);
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

            let recentRevenue30 = 0;
            let recentRevenue60 = 0;

            for (const customer of customers.values()) {
                totalRevenue += customer.totalRevenue;
                totalOrders += customer.orderCount;

                if (customer.orderCount >= 2) {
                    repeatCustomers++;
                }

                if (customer.lastPurchaseDate < ninetyDaysAgo) {
                    churnedCount++;
                }

                // For trend calculation
                if (customer.lastPurchaseDate >= thirtyDaysAgo) {
                    recentRevenue30 += customer.totalRevenue;
                }
                if (customer.lastPurchaseDate >= sixtyDaysAgo) {
                    recentRevenue60 += customer.totalRevenue;
                }
            }

            const ltv = Math.round((totalRevenue / customerCount) * 100) / 100;
            const churnRate = Math.round((churnedCount / customerCount) * 1000) / 10;
            const avgOrderValue = Math.round((totalRevenue / totalOrders) * 100) / 100;
            const repeatRate = Math.round((repeatCustomers / customerCount) * 1000) / 10;

            // Calculate trend
            const trend30vs60 = recentRevenue30 - recentRevenue60;
            const recentTrend: "up" | "down" | "stable" =
                trend30vs60 > recentRevenue60 * 0.05
                    ? "up"
                    : trend30vs60 < -recentRevenue60 * 0.05
                        ? "down"
                        : "stable";

            metrics[level] = {
                customerCount,
                ltv,
                churnRate,
                avgOrderValue,
                repeatRate,
                recentTrend,
            };
        }

        const response: CustomerHealthResponse = {
            data: { levels: metrics },
            calculationNote: `Customer Health KPIs calculated from 12-month ar_invoices data. LTV = total revenue / unique customers. Churn = inactive customers (>90 days) / total × 100%. Avg Order Value = total revenue / order count. Repeat Rate = customers with 2+ orders / total × 100%. Recent Trend = revenue growth last 30 days vs 60 days.`,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error("Customer health by level error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
