import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface ClinicVariation {
    clinic_id: number;
    email: string;
    name: string;
    company_name: string | null;
    region: string | null;
    level: string | null;
    previous_revenue: number;
    current_revenue: number;
    change: number;
    change_percent: number;
    event_type: string | null;
    event_confirmed: boolean;
    is_new: boolean;
    is_churned: boolean;
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const yearMonth = searchParams.get("month"); // Format: YYYY-MM
    const ytd = searchParams.get("ytd"); // Format: YYYY-MM (get all months up to this one)
    const faCode = searchParams.get("fa"); // Financial account code filter

    if (!yearMonth && !ytd) {
        return NextResponse.json(
            { error: "month ou ytd são obrigatórios (formato: YYYY-MM)" },
            { status: 400 }
        );
    }

    try {
        const targetMonth = (ytd || yearMonth) as string;
        const [year, month] = targetMonth.split("-").map(Number);

        // Calculate previous month
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const prevYearMonth = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
        const currentYearMonth = `${year}-${String(month).padStart(2, "0")}`;

        // Fetch monthly stats for comparison
        let currentStatsQuery = supabaseAdmin
            .from("clinic_monthly_stats")
            .select(`
                clinic_id,
                year_month,
                revenue,
                transaction_count,
                level,
                region,
                clinics (
                    id,
                    email,
                    name,
                    company_name,
                    status,
                    first_transaction_date
                )
            `);

        let prevStatsQuery = supabaseAdmin
            .from("clinic_monthly_stats")
            .select(`
                clinic_id,
                year_month,
                revenue,
                transaction_count
            `);

        if (ytd) {
            // Get all months from January to the target month
            const startYearMonth = `${year}-01`;
            currentStatsQuery = currentStatsQuery
                .gte("year_month", startYearMonth)
                .lte("year_month", currentYearMonth);
            
            // Previous year for comparison (same period)
            const prevStartYearMonth = `${year - 1}-01`;
            const prevEndYearMonth = `${year - 1}-${String(month).padStart(2, "0")}`;
            prevStatsQuery = prevStatsQuery
                .gte("year_month", prevStartYearMonth)
                .lte("year_month", prevEndYearMonth);
        } else {
            // Single month comparison
            currentStatsQuery = currentStatsQuery.eq("year_month", currentYearMonth);
            prevStatsQuery = prevStatsQuery.eq("year_month", prevYearMonth);
        }

        const [currentResult, prevResult, eventsResult] = await Promise.all([
            currentStatsQuery,
            prevStatsQuery,
            ytd
                ? supabaseAdmin
                      .from("clinic_events")
                      .select("*")
                      .gte("year_month", `${year}-01`)
                      .lte("year_month", currentYearMonth)
                : supabaseAdmin
                      .from("clinic_events")
                      .select("*")
                      .eq("year_month", currentYearMonth),
        ]);

        if (currentResult.error) {
            console.error("Error fetching current stats:", currentResult.error);
            return NextResponse.json(
                { error: "Erro ao buscar dados atuais: " + currentResult.error.message },
                { status: 500 }
            );
        }

        // Build maps for quick lookup
        const prevRevenueMap = new Map<number, number>();
        if (prevResult.data) {
            for (const stat of prevResult.data) {
                const current = prevRevenueMap.get(stat.clinic_id) || 0;
                prevRevenueMap.set(stat.clinic_id, current + (stat.revenue || 0));
            }
        }

        // Events map: clinic_id -> { event_type, confirmed, year_month }[]
        const eventsMap = new Map<number, Array<{ event_type: string; confirmed: boolean; year_month: string }>>();
        if (eventsResult.data) {
            for (const event of eventsResult.data) {
                const existing = eventsMap.get(event.clinic_id) || [];
                existing.push({
                    event_type: event.event_type,
                    confirmed: event.confirmed,
                    year_month: event.year_month,
                });
                eventsMap.set(event.clinic_id, existing);
            }
        }

        // Aggregate current stats by clinic
        const clinicStatsMap = new Map<number, {
            revenue: number;
            clinic: unknown;
            level: string | null;
            region: string | null;
        }>();

        if (currentResult.data) {
            for (const stat of currentResult.data) {
                const existing = clinicStatsMap.get(stat.clinic_id);
                if (existing) {
                    existing.revenue += stat.revenue || 0;
                } else {
                    clinicStatsMap.set(stat.clinic_id, {
                        revenue: stat.revenue || 0,
                        clinic: stat.clinics,
                        level: stat.level,
                        region: stat.region,
                    });
                }
            }
        }

        // Build variations list
        const variations: ClinicVariation[] = [];

        for (const [clinicId, stats] of clinicStatsMap) {
            const clinic = stats.clinic as {
                id: number;
                email: string;
                name: string;
                company_name: string | null;
                status: string;
                first_transaction_date: string;
            };

            if (!clinic) continue;

            const previousRevenue = prevRevenueMap.get(clinicId) || 0;
            const currentRevenue = stats.revenue;
            const change = currentRevenue - previousRevenue;
            const changePercent = previousRevenue > 0 
                ? ((change / previousRevenue) * 100) 
                : (currentRevenue > 0 ? 100 : 0);

            // Get most recent event for this clinic in the period
            const clinicEvents = eventsMap.get(clinicId) || [];
            const latestEvent = clinicEvents.sort((a, b) => 
                b.year_month.localeCompare(a.year_month)
            )[0];

            // Determine if this is a new clinic (first transaction in this period)
            const firstTxMonth = clinic.first_transaction_date?.substring(0, 7);
            const isNew = ytd 
                ? firstTxMonth >= `${year}-01` && firstTxMonth <= currentYearMonth
                : firstTxMonth === currentYearMonth;

            // Check if churned
            const isChurned = clinicEvents.some(e => e.event_type === "Churn");

            variations.push({
                clinic_id: clinicId,
                email: clinic.email,
                name: clinic.name || clinic.email,
                company_name: clinic.company_name,
                region: stats.region,
                level: stats.level,
                previous_revenue: previousRevenue,
                current_revenue: currentRevenue,
                change,
                change_percent: changePercent,
                event_type: latestEvent?.event_type || (isNew ? "New" : null),
                event_confirmed: latestEvent?.confirmed ?? isNew,
                is_new: isNew,
                is_churned: isChurned,
            });
        }

        // If YTD mode, also include churned clinics that don't have current revenue
        if (ytd) {
            const churnedEvents = eventsResult.data?.filter(e => e.event_type === "Churn") || [];
            for (const event of churnedEvents) {
                // Check if this clinic is already in variations
                if (!variations.some(v => v.clinic_id === event.clinic_id)) {
                    // Fetch clinic info
                    const { data: clinic } = await supabaseAdmin
                        .from("clinics")
                        .select("*")
                        .eq("id", event.clinic_id)
                        .single();

                    if (clinic) {
                        variations.push({
                            clinic_id: clinic.id,
                            email: clinic.email,
                            name: clinic.name || clinic.email,
                            company_name: clinic.company_name,
                            region: clinic.region,
                            level: clinic.level,
                            previous_revenue: prevRevenueMap.get(clinic.id) || clinic.mrr || 0,
                            current_revenue: 0,
                            change: -(prevRevenueMap.get(clinic.id) || clinic.mrr || 0),
                            change_percent: -100,
                            event_type: "Churn",
                            event_confirmed: event.confirmed,
                            is_new: false,
                            is_churned: true,
                        });
                    }
                }
            }
        }

        // Sort by absolute change (largest changes first)
        variations.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

        // Calculate summary
        const summary = {
            total_clinics: variations.length,
            new_clinics: variations.filter(v => v.is_new).length,
            churned_clinics: variations.filter(v => v.is_churned).length,
            paused_clinics: variations.filter(v => v.event_type === "Pause").length,
            returned_clinics: variations.filter(v => v.event_type === "Return").length,
            total_current_revenue: variations.reduce((sum, v) => sum + v.current_revenue, 0),
            total_previous_revenue: variations.reduce((sum, v) => sum + v.previous_revenue, 0),
            total_change: variations.reduce((sum, v) => sum + v.change, 0),
        };

        return NextResponse.json({
            success: true,
            mode: ytd ? "ytd" : "monthly",
            period: ytd ? `${year}-01 to ${currentYearMonth}` : currentYearMonth,
            comparison_period: ytd ? `${year - 1}-01 to ${prevYearMonth}` : prevYearMonth,
            variations,
            summary,
        });
    } catch (err) {
        console.error("Clinic variations API error:", err);
        return NextResponse.json(
            { error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}
