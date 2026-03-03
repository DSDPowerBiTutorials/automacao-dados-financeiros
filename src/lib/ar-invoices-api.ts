/**
 * Client-side helper for ar_invoices operations.
 * Routes all queries through /api/ar-invoices (server-side, supabaseAdmin)
 * to bypass RLS/GRANT permission issues.
 */

const API_BASE = "/api/ar-invoices";

/** Search ar_invoices — with optional server-side text query */
export async function arSearch(currency?: string, limit = 5000, query?: string): Promise<any[]> {
    const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", currency, limit, query }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "ar-invoices search failed");
    return json.data || [];
}

/** Fetch unreconciled ar_invoices by currency */
export async function arFetchUnreconciled(currency?: string, limit = 1000): Promise<any[]> {
    const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch-unreconciled", currency, limit }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "ar-invoices fetch-unreconciled failed");
    return json.data || [];
}

/** Fetch ar_invoices by array of IDs */
export async function arFetchByIds(
    ids: number[],
    select = "id, customer_name, order_id, invoice_number, total_amount, charged_amount, financial_account_code, products, currency"
): Promise<any[]> {
    if (!ids.length) return [];
    const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch-by-ids", ids, select }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "ar-invoices fetch-by-ids failed");
    return json.data || [];
}

/** Fetch single ar_invoice by ID */
export async function arFetchById(id: number, select = "*"): Promise<any | null> {
    const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch-by-id", id, select }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "ar-invoices fetch-by-id failed");
    return json.data || null;
}

/** Fetch ar_invoices by order_id */
export async function arFetchByOrderId(
    order_id: string,
    select = "id, customer_name, order_id, invoice_number, total_amount, charged_amount, financial_account_code, products, currency"
): Promise<any[]> {
    const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch-by-order-id", order_id, select }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "ar-invoices fetch-by-order-id failed");
    return json.data || [];
}

/** Update an ar_invoice record */
export async function arUpdate(id: number, data: Record<string, unknown>): Promise<any> {
    const res = await fetch(API_BASE, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, data }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "ar-invoices update failed");
    return json.data;
}
