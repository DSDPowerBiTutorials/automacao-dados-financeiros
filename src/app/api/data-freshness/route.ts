import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export interface DataSourceStatus {
    source: string;
    displayName: string;
    type: "auto" | "csv";
    lastSync: string | null;
    lastRecordDate: string | null;
    status: "fresh" | "stale" | "error" | "never";
    syncStatus: "idle" | "syncing" | "success" | "error";
    totalRecords: number;
    uploadPath?: string;
    syncEndpoint?: string;
}

export interface DataFreshnessResponse {
    sources: DataSourceStatus[];
    overallStatus: "fresh" | "stale" | "error";
    hasErrors: boolean;
    freshCount: number;
    staleCount: number;
    errorCount: number;
}

// Configuração das fontes de dados
const DATA_SOURCES_CONFIG: {
    source: string;
    displayName: string;
    type: "auto" | "csv";
    uploadPath?: string;
    syncEndpoint?: string;
}[] = [
        // Fontes automáticas (API/Webhook)
        { source: "braintree-eur", displayName: "Braintree EUR", type: "auto", syncEndpoint: "/api/braintree/sync" },
        { source: "braintree-usd", displayName: "Braintree USD", type: "auto", syncEndpoint: "/api/braintree/sync" },
        { source: "braintree-gbp", displayName: "Braintree GBP", type: "auto", syncEndpoint: "/api/braintree/sync" },
        { source: "braintree-aud", displayName: "Braintree AUD", type: "auto", syncEndpoint: "/api/braintree/sync" },
        { source: "braintree-amex", displayName: "Braintree Amex", type: "auto", syncEndpoint: "/api/braintree/sync" },
        { source: "gocardless", displayName: "GoCardless", type: "auto", syncEndpoint: "/api/gocardless/sync" },
        { source: "stripe-eur", displayName: "Stripe EUR", type: "auto", syncEndpoint: "/api/stripe/sync" },
        { source: "stripe-usd", displayName: "Stripe USD", type: "auto", syncEndpoint: "/api/stripe/sync" },
        { source: "hubspot", displayName: "HubSpot", type: "auto", syncEndpoint: "/api/hubspot/sync" },
        // Fontes CSV (Upload manual)
        { source: "bankinter-eur", displayName: "Bankinter EUR", type: "csv", uploadPath: "/reports/bankinter" },
        { source: "bankinter-usd", displayName: "Bankinter USD", type: "csv", uploadPath: "/reports/bankinter-usd" },
        { source: "sabadell-eur", displayName: "Sabadell EUR", type: "csv", uploadPath: "/reports/sabadell" },
        { source: "chase-usd", displayName: "Chase 9186", type: "csv", uploadPath: "/reports/chase-usd" },
        { source: "paypal", displayName: "PayPal", type: "csv", uploadPath: "/reports/paypal" },
        { source: "pleo", displayName: "Pleo", type: "csv", uploadPath: "/reports/pleo" },
    ];

// Thresholds configuráveis (em horas)
const THRESHOLDS = {
    auto: {
        stale: 12, // 12 horas para ficar stale
        error: 48, // 48 horas para ficar em erro
    },
    csv: {
        stale: 96, // 4 dias (96 horas) para ficar stale
        error: 168, // 7 dias para ficar em erro
    },
};

function calculateStatus(
    lastSync: string | null,
    type: "auto" | "csv"
): "fresh" | "stale" | "error" | "never" {
    if (!lastSync) return "never";

    const now = new Date();
    const syncDate = new Date(lastSync);
    const diffHours = (now.getTime() - syncDate.getTime()) / 3600000;

    const threshold = THRESHOLDS[type];

    if (diffHours < threshold.stale) return "fresh";
    if (diffHours < threshold.error) return "stale";
    return "error";
}

export async function GET() {
    try {
        // Buscar metadata de sync para fontes automáticas
        const { data: syncMetadata, error: syncError } = await supabaseAdmin
            .from("sync_metadata")
            .select("*");

        if (syncError) {
            console.error("[data-freshness] Error fetching sync_metadata:", syncError);
        }

        // Buscar uploads CSV mais recentes
        const { data: csvFiles, error: csvError } = await supabaseAdmin
            .from("csv_files")
            .select("source, updated_at, last_updated")
            .order("updated_at", { ascending: false });

        if (csvError) {
            console.error("[data-freshness] Error fetching csv_files:", csvError);
        }

        // Buscar dados mais recentes de csv_rows para cada fonte
        const { data: latestRecords, error: recordsError } = await supabaseAdmin
            .from("csv_rows")
            .select("source, date")
            .order("date", { ascending: false });

        if (recordsError) {
            console.error("[data-freshness] Error fetching csv_rows:", recordsError);
        }

        // Agrupar dados mais recentes por fonte
        const latestBySource: Record<string, string> = {};
        if (latestRecords) {
            for (const record of latestRecords) {
                if (!latestBySource[record.source]) {
                    latestBySource[record.source] = record.date;
                }
            }
        }

        // Agrupar uploads CSV mais recentes por fonte
        const csvBySource: Record<string, { updated_at: string }> = {};
        if (csvFiles) {
            for (const file of csvFiles) {
                if (!csvBySource[file.source]) {
                    csvBySource[file.source] = { updated_at: file.updated_at || file.last_updated };
                }
            }
        }

        // Construir lista de status
        const sources: DataSourceStatus[] = DATA_SOURCES_CONFIG.map((config) => {
            let lastSync: string | null = null;
            let lastRecordDate: string | null = null;
            let syncStatus: "idle" | "syncing" | "success" | "error" = "idle";
            let totalRecords = 0;

            if (config.type === "auto") {
                // Buscar de sync_metadata
                const metadata = syncMetadata?.find((m) => m.source === config.source);
                if (metadata) {
                    lastSync = metadata.last_api_sync || metadata.last_webhook_received || metadata.last_full_sync;
                    lastRecordDate = metadata.last_record_date;
                    syncStatus = metadata.last_sync_status || "idle";
                    totalRecords = metadata.total_records || 0;
                }
            } else {
                // Buscar de csv_files
                const csv = csvBySource[config.source];
                if (csv) {
                    lastSync = csv.updated_at;
                }
                lastRecordDate = latestBySource[config.source] || null;
            }

            const status = calculateStatus(lastSync, config.type);

            return {
                source: config.source,
                displayName: config.displayName,
                type: config.type,
                lastSync,
                lastRecordDate,
                status,
                syncStatus,
                totalRecords,
                uploadPath: config.uploadPath,
                syncEndpoint: config.syncEndpoint,
            };
        });

        // Calcular estatísticas gerais
        const freshCount = sources.filter((s) => s.status === "fresh").length;
        const staleCount = sources.filter((s) => s.status === "stale").length;
        const errorCount = sources.filter((s) => s.status === "error" || s.status === "never").length;

        let overallStatus: "fresh" | "stale" | "error" = "fresh";
        if (errorCount > 0) overallStatus = "error";
        else if (staleCount > 0) overallStatus = "stale";

        const response: DataFreshnessResponse = {
            sources,
            overallStatus,
            hasErrors: errorCount > 0,
            freshCount,
            staleCount,
            errorCount,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error("[data-freshness] Unexpected error:", error);
        return NextResponse.json(
            { error: "Failed to fetch data freshness" },
            { status: 500 }
        );
    }
}
