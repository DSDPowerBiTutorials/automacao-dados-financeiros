import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * API para reconciliar Invoice Orders com transações bancárias
 * Cruza por invoice_number, order_number e valores aproximados
 *
 * Query params:
 * - dryRun=true: apenas simula sem atualizar
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") === "true";

    try {
        // 1. Buscar Invoice Orders não reconciliados
        const { data: invoiceOrders, error: ioError } = await supabaseAdmin
            .from("csv_rows")
            .select("*")
            .eq("source", "invoice-orders")
            .eq("reconciled", false);

        if (ioError) throw ioError;

        // 2. Buscar transações bancárias (créditos de Bankinter EUR e USD)
        const { data: bankRows, error: bankError } = await supabaseAdmin
            .from("csv_rows")
            .select("*")
            .in("source", ["bankinter-eur", "bankinter-usd"])
            .gt("amount", 0) // Créditos apenas
            .eq("reconciled", false);

        if (bankError) throw bankError;

        // 3. Buscar Web Orders (ar_invoices) para cruzar order_id
        const { data: webOrders, error: woError } = await supabaseAdmin
            .from("ar_invoices")
            .select("*")
            .in("source", ["hubspot", "craft-commerce"]);

        if (woError) throw woError;

        // 4. Buscar transações Braintree para cruzar order_id
        const { data: braintreeTxs, error: btError } = await supabaseAdmin
            .from("csv_rows")
            .select("*")
            .eq("source", "braintree-api-revenue");

        if (btError) throw btError;

        const results: {
            invoiceId: string;
            invoiceNumber: string;
            amount: number;
            matchType: string;
            matchedWith: string | null;
            matchedId: string | null;
        }[] = [];

        const updates: {
            invoiceOrderUpdates: { id: string; custom_data: Record<string, unknown> }[];
            bankRowUpdates: { id: string; custom_data: Record<string, unknown> }[];
        } = {
            invoiceOrderUpdates: [],
            bankRowUpdates: []
        };

        // Processar cada Invoice Order
        for (const inv of invoiceOrders || []) {
            const invData = (inv.custom_data as Record<string, unknown>) || {};
            const invoiceNumber = String(invData.Number || invData.invoice_number || inv.description || "");
            const orderNumber = String(invData.order_number || invData.Order || "");
            const invAmount = Math.abs(parseFloat(inv.amount) || 0);

            let matchType = "none";
            let matchedWith: string | null = null;
            let matchedId: string | null = null;

            // Tentar match por order_number com Web Orders
            if (orderNumber) {
                const woMatch = (webOrders || []).find(
                    (wo) => wo.order_id === orderNumber || wo.order_id?.includes(orderNumber)
                );

                if (woMatch) {
                    matchType = "web_order";
                    matchedWith = `Web Order: ${woMatch.order_id}`;
                    matchedId = woMatch.id.toString();
                }
            }

            // Tentar match por order_number com Braintree
            if (matchType === "none" && orderNumber) {
                const btMatch = (braintreeTxs || []).find((tx) => {
                    const txData = (tx.custom_data as Record<string, unknown>) || {};
                    return txData.order_id === orderNumber;
                });

                if (btMatch) {
                    matchType = "braintree";
                    matchedWith = `Braintree: ${(btMatch.custom_data as Record<string, unknown>)?.transaction_id || btMatch.id}`;
                    matchedId = btMatch.id;
                }
            }

            // Tentar match por valor no banco (tolerância 0.10)
            if (matchType === "none" && invAmount > 0) {
                const bankMatch = (bankRows || []).find((bank) => {
                    const bankAmount = Math.abs(parseFloat(bank.amount) || 0);
                    const diff = Math.abs(bankAmount - invAmount);
                    return diff < 0.10;
                });

                if (bankMatch) {
                    matchType = "bank_amount";
                    matchedWith = `Bank: ${bankMatch.description?.substring(0, 50)}`;
                    matchedId = bankMatch.id;

                    // Preparar update do bank row
                    const bankData = (bankMatch.custom_data as Record<string, unknown>) || {};
                    updates.bankRowUpdates.push({
                        id: bankMatch.id,
                        custom_data: {
                            ...bankData,
                            invoice_order_matched: true,
                            invoice_order_id: inv.id,
                            invoice_number: invoiceNumber
                        }
                    });
                }
            }

            results.push({
                invoiceId: inv.id,
                invoiceNumber,
                amount: invAmount,
                matchType,
                matchedWith,
                matchedId
            });

            // Se encontrou match, preparar update
            if (matchType !== "none") {
                updates.invoiceOrderUpdates.push({
                    id: inv.id,
                    custom_data: {
                        ...invData,
                        reconciled: true,
                        reconciled_at: new Date().toISOString(),
                        match_type: matchType,
                        matched_with: matchedWith,
                        matched_id: matchedId
                    }
                });
            }
        }

        // Se não for dry run, aplicar updates
        if (!dryRun) {
            for (const upd of updates.invoiceOrderUpdates) {
                await supabaseAdmin
                    .from("csv_rows")
                    .update({
                        reconciled: true,
                        custom_data: upd.custom_data
                    })
                    .eq("id", upd.id);
            }

            for (const upd of updates.bankRowUpdates) {
                await supabaseAdmin
                    .from("csv_rows")
                    .update({ custom_data: upd.custom_data })
                    .eq("id", upd.id);
            }
        }

        const summary = {
            dryRun,
            totalInvoiceOrders: invoiceOrders?.length || 0,
            totalBankRows: bankRows?.length || 0,
            matchedInvoices: results.filter((r) => r.matchType !== "none").length,
            unmatchedInvoices: results.filter((r) => r.matchType === "none").length,
            matchByWebOrder: results.filter((r) => r.matchType === "web_order").length,
            matchByBraintree: results.filter((r) => r.matchType === "braintree").length,
            matchByBankAmount: results.filter((r) => r.matchType === "bank_amount").length
        };

        return NextResponse.json({
            success: true,
            summary,
            results: results.slice(0, 50), // Limitar resultados
            updates: dryRun ? { pending: updates.invoiceOrderUpdates.length } : { applied: true }
        });
    } catch (error) {
        console.error("Reconciliation error:", error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
