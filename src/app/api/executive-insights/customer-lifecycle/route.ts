import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ============================================================
// Executive Insights → NR Thermometer
// Natural Restoration Product Segmentation (HOT/WARM/COLD)
// Based on purchase QUANTITY and RECENCY from ar_invoices
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

// Extract NR quantity from products string
// Products can contain multiple items comma-separated, e.g.:
// "DSD Natural Restoration Design + Manufacture - Per Unit - DSD Natural Restorations Manufacture PER UNIT (x12), DSD Implant..."
function extractNRQuantity(products: string): number {
    let totalQty = 0;
    const items = products.split(",").map((s) => s.trim());
    for (const item of items) {
        if (/natural restoration/i.test(item)) {
            const qtyMatch = item.match(/\(x(\d+)\)/);
            totalQty += qtyMatch ? parseInt(qtyMatch[1]) : 1;
        }
    }
    return totalQty || 1;
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const segment = searchParams.get("segment") || "all"; // HOT, WARM, COLD, all
    const sortBy = searchParams.get("sortBy") || "lastPurchase"; // lastPurchase, quantity, orderCount
    const limit = parseInt(searchParams.get("limit") || "500");

    try {
        // Query ar_invoices for Natural Restoration products
        let allData: any[] = [];
        let offset = 0;
        const pageSize = 1000;

        while (true) {
            const { data, error } = await supabaseAdmin
                .from("ar_invoices")
                .select("email, company_name, client_name, products, order_date, invoice_date, order_status")
                .or("products.ilike.%natural restoration%,products.ilike.%NR %")
                .range(offset, offset + pageSize - 1);

            if (error) {
                console.error("Error fetching ar_invoices:", error);
                return NextResponse.json(
                    { error: "Failed to fetch data" },
                    { status: 500 }
                );
            }

            if (!data || data.length === 0) break;
            allData = allData.concat(data);
            offset += pageSize;
            if (data.length < pageSize) break;
        }

        // Aggregate by customer (email is the unique key)
        const customerMap = new Map<string, CustomerData>();
        const now = new Date();

        for (const row of allData) {
            const email = row.email;
            if (!email) continue;

            const customerId = email;
            let customer = customerMap.get(customerId);

            if (!customer) {
                customer = {
                    customerId,
                    customerName:
                        row.company_name || row.client_name || "Unknown",
                    customerEmail: email,
                    totalQuantity: 0,
                    orderCount: 0,
                    lastPurchaseDate: "",
                    firstPurchaseDate: "",
                    averageQtyPerOrder: 0,
                    daysSinceLastPurchase: 999999,
                    segment: "COLD",
                };
            }

            // Extract NR quantity from products string
            const qty = extractNRQuantity(row.products || "");
            customer.totalQuantity += qty;
            customer.orderCount += 1;

            // Use order_date, fallback to invoice_date
            const dateStr = row.order_date || row.invoice_date;
            if (dateStr) {
                if (!customer.lastPurchaseDate || dateStr > customer.lastPurchaseDate) {
                    customer.lastPurchaseDate = dateStr;
                }
                if (!customer.firstPurchaseDate || dateStr < customer.firstPurchaseDate) {
                    customer.firstPurchaseDate = dateStr;
                }
            }

            customerMap.set(customerId, customer);
        }

        // Calculate derived fields
        const customers = Array.from(customerMap.values()).map((c) => {
            const lastDate = new Date(c.lastPurchaseDate || now);
            c.daysSinceLastPurchase = Math.floor(
                (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            c.averageQtyPerOrder =
                Math.round((c.totalQuantity / c.orderCount) * 100) / 100;
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
