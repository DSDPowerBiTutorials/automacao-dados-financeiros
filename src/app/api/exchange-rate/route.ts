/**
 * GET /api/exchange-rate
 * Returns the latest EUR/USD exchange rate from sync_metadata (cached by daily cron).
 * Falls back to Frankfurter API if no cached data exists.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
    try {
        // Try cached rate from daily cron
        const { data } = await supabaseAdmin
            .from("sync_metadata")
            .select("metadata, last_sync")
            .eq("source", "exchange-rate")
            .single();

        if (data?.metadata?.usd_to_eur) {
            return NextResponse.json({
                success: true,
                usdToEur: data.metadata.usd_to_eur,
                eurToUsd: data.metadata.eur_to_usd,
                date: data.metadata.date,
                fetchedAt: data.last_sync,
                source: "daily-cron",
            });
        }

        // Fallback: fetch live (first run before cron has executed)
        const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR");
        if (!res.ok) throw new Error(`Frankfurter ${res.status}`);
        const fxData = await res.json();
        const usdToEur = fxData.rates?.EUR;

        if (!usdToEur) throw new Error("No EUR rate");

        // Cache it for next time
        await supabaseAdmin.from("sync_metadata").upsert(
            {
                source: "exchange-rate",
                last_sync: new Date().toISOString(),
                records_synced: 1,
                metadata: {
                    usd_to_eur: usdToEur,
                    eur_to_usd: 1 / usdToEur,
                    date: fxData.date,
                    fetched_at: new Date().toISOString(),
                },
            },
            { onConflict: "source" }
        );

        return NextResponse.json({
            success: true,
            usdToEur,
            eurToUsd: 1 / usdToEur,
            date: fxData.date,
            fetchedAt: new Date().toISOString(),
            source: "live-fallback",
        });
    } catch (err: any) {
        return NextResponse.json(
            { success: false, error: err.message, usdToEur: 0.92, eurToUsd: 1.087 },
            { status: 500 }
        );
    }
}
