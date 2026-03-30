import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ============================================================
// Executive Insights → Customer Lifecycle Analysis
// Natural Restoration Product Segmentation (HOT/WARM/COLD)
// Based on purchase QUANTITY and RECENCY, not revenue
// ============================================================

interface CustomerData {
    customerId: string;
    customerName: string;
    customerEmail: string;
    totalQuantity: number;
    orderCount: number;
    lastPurchaseDate: string;
    firstPurchaseDate: string;
    averageQtyPerOrder: number;
    daysSinceLastPurchase: number;
    segment: "HOT" | "WARM" | "COLD";
}

function calculateSegment(data: {
    daysSinceLastPurchase: number;
    orderCount: number;
    totalQuantity: number;
    averageQtyPerOrder: number;
}): "HOT" | "WARM" | "COLD" {
    // HOT: Recent (< 90 days) + Frequent (avg > 2 qty/order) or (total qty > 10)
    if (
        data.daysSinceLastPurchase <= 90 &&
        (data.averageQtyPerOrder > 2 || data.totalQuantity > 10)
    ) {
        return "HOT";
    }

    // WARM: Recent (< 180 days) OR decent activity (total qty >= 5)
    if (data.daysSinceLastPurchase <= 180 || data.totalQuantity >= 5) {
        return "WARM";
    }

    // COLD: Older than 180 days OR low activity
    return "COLD";
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const segment = searchParams.get("segment") || "all"; // HOT, WARM, COLD, all
    const sortBy = searchParams.get("sortBy") || "lastPurchase"; // lastPurchase, quantity, orderCount
    const limit = parseInt(searchParams.get("limit") || "500");

    try {
        // Query CVS rows for Natural Restoration product
        // Source: invoice-orders, Description contains "natural restoration"
        const { data: rows, error: rowsError } = await supabaseAdmin
            .from("csv_rows")
            .select("*")
            .eq("source", "invoice-orders")
            .ilike("description", "%natural restoration%")
            .order("date", { ascending: false });

        if (rowsError) {
            console.error("Error fetching csv_rows:", rowsError);
            return NextResponse.json(
                { error: "Failed to fetch data" },
                { status: 500 }
            );
        }

        // Aggregate by customer
        const customerMap = new Map<string, CustomerData>();
        const now = new Date();

        for (const row of rows || []) {
            // Extract customer identifier (use email or name as key)
            const customerId =
                row.custom_data?.Email ||
                row.custom_data?.Client_Name ||
                "unknown";

            let customer = customerMap.get(customerId);

            if (!customer) {
                customer = {
                    customerId,
                    customerName:
                        row.custom_data?.Client_Name ||
                        "Unknown",
                    customerEmail: row.custom_data?.Email || "",
                    totalQuantity: 0,
                    orderCount: 0,
                    lastPurchaseDate: row.date || "",
                    firstPurchaseDate: row.date || "",
                    averageQtyPerOrder: 0,
                    daysSinceLastPurchase: 999999,
                    segment: "COLD",
                };
            }

            // Parse quantity (handle European numbers)
            let qty = 1;
            if (row.custom_data?.quantity) {
                const qtyStr = String(row.custom_data.quantity);
                qty =
                    parseInt(qtyStr.replace(/\./g, "").replace(",", ".")) ||
                    parseInt(qtyStr) ||
                    1;
            }

            customer.totalQuantity += qty;
            customer.orderCount += 1;

            // Track dates
            const rowDate = new Date(row.date || now);
            if (!customer.lastPurchaseDate || new Date(row.date!) > new Date(customer.lastPurchaseDate)) {
                customer.lastPurchaseDate = row.date || now.toISOString();
            }
            if (!customer.firstPurchaseDate || new Date(row.date!) < new Date(customer.firstPurchaseDate)) {
                customer.firstPurchaseDate = row.date || now.toISOString();
            }

            customerMap.set(customerId, customer);
        }

        // Calculate derived fields
        const customers = Array.from(customerMap.values())
            .map((c) => {
                const lastDate = new Date(c.lastPurchaseDate);
                c.daysSinceLastPurchase = Math.floor(
                    (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
                );
                c.averageQtyPerOrder = Math.round(
                    (c.totalQuantity / c.orderCount) * 100
                ) / 100;
                c.segment = calculateSegment(c);
                return c;
            });

        // Filter by segment
        let filtered = customers;
        if (segment !== "all") {
            filtered = customers.filter((c) => c.segment === segment);
        }

        // Sort
        switch (sortBy) {
            case "quantity":
                filtered.sort((a, b) => b.totalQuantity - a.totalQuantity);
                break;
            case "orderCount":
                filtered.sort((a, b) => b.orderCount - a.orderCount);
                break;
            case "lastPurchase":
            default:
                filtered.sort(
                    (a, b) =>
                        new Date(b.lastPurchaseDate).getTime() -
                        new Date(a.lastPurchaseDate).getTime()
                );
        }

        // Limit results
        const results = filtered.slice(0, limit);

        // Calculate summary stats
        const stats = {
            totalCustomers: customers.length,
            bySegment: {
                HOT: customers.filter((c) => c.segment === "HOT").length,
                WARM: customers.filter((c) => c.segment === "WARM").length,
                COLD: customers.filter((c) => c.segment === "COLD").length,
            },
            totalQuantitySold: Math.round(
                customers.reduce((sum, c) => sum + c.totalQuantity, 0)
            ),
            averageQtyPerCustomer:
                Math.round(
                    (customers.reduce((sum, c) => sum + c.totalQuantity, 0) /
                        customers.length) *
                    100
                ) / 100,
        };

        return NextResponse.json({
            success: true,
            stats,
            customers: results,
        });
    } catch (error) {
        console.error("Error in customer-lifecycle:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
