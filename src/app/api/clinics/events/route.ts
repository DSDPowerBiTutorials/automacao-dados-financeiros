import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const clinicId = searchParams.get("clinic_id");
    const yearMonth = searchParams.get("year_month");
    const eventType = searchParams.get("event_type");
    const confirmed = searchParams.get("confirmed");

    try {
        let query = supabaseAdmin
            .from("clinic_events")
            .select(`
                id,
                clinic_id,
                event_type,
                event_date,
                year_month,
                previous_status,
                new_status,
                previous_mrr,
                new_mrr,
                notes,
                is_auto_detected,
                confirmed,
                created_at,
                clinics (
                    id,
                    email,
                    name,
                    company_name
                )
            `)
            .order("event_date", { ascending: false });

        if (clinicId) {
            query = query.eq("clinic_id", parseInt(clinicId));
        }

        if (yearMonth) {
            query = query.eq("year_month", yearMonth);
        }

        if (eventType) {
            query = query.eq("event_type", eventType);
        }

        if (confirmed !== null && confirmed !== undefined) {
            query = query.eq("confirmed", confirmed === "true");
        }

        const { data, error } = await query.limit(500);

        if (error) {
            console.error("Error fetching clinic events:", error);
            return NextResponse.json(
                { error: "Erro ao buscar eventos: " + error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            events: data || [],
            count: data?.length || 0,
        });
    } catch (err) {
        console.error("Clinic events API error:", err);
        return NextResponse.json(
            { error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { clinic_id, event_type, event_date, year_month, notes, previous_mrr, new_mrr } = body;

        if (!clinic_id || !event_type || !year_month) {
            return NextResponse.json(
                { error: "clinic_id, event_type e year_month são obrigatórios" },
                { status: 400 }
            );
        }

        // Validate event_type
        const validEventTypes = ["New", "Pause", "Return", "Churn"];
        if (!validEventTypes.includes(event_type)) {
            return NextResponse.json(
                { error: `event_type inválido. Valores válidos: ${validEventTypes.join(", ")}` },
                { status: 400 }
            );
        }

        // Determine status change
        const statusMap: Record<string, { previous: string; new: string }> = {
            New: { previous: "", new: "active" },
            Pause: { previous: "active", new: "paused" },
            Return: { previous: "paused", new: "active" },
            Churn: { previous: "active", new: "churned" },
        };

        const statusChange = statusMap[event_type];

        // Check if event already exists
        const { data: existing } = await supabaseAdmin
            .from("clinic_events")
            .select("id")
            .eq("clinic_id", clinic_id)
            .eq("year_month", year_month)
            .eq("event_type", event_type)
            .single();

        if (existing) {
            // Update existing event
            const { data, error } = await supabaseAdmin
                .from("clinic_events")
                .update({
                    event_date: event_date || `${year_month}-01`,
                    notes,
                    previous_mrr,
                    new_mrr,
                    confirmed: true,
                    is_auto_detected: false,
                })
                .eq("id", existing.id)
                .select()
                .single();

            if (error) {
                return NextResponse.json(
                    { error: "Erro ao atualizar evento: " + error.message },
                    { status: 500 }
                );
            }

            return NextResponse.json({ success: true, event: data, action: "updated" });
        }

        // Insert new event
        const { data, error } = await supabaseAdmin
            .from("clinic_events")
            .insert({
                clinic_id,
                event_type,
                event_date: event_date || `${year_month}-01`,
                year_month,
                previous_status: statusChange.previous,
                new_status: statusChange.new,
                previous_mrr,
                new_mrr,
                notes,
                is_auto_detected: false,
                confirmed: true,
            })
            .select()
            .single();

        if (error) {
            console.error("Error inserting clinic event:", error);
            return NextResponse.json(
                { error: "Erro ao criar evento: " + error.message },
                { status: 500 }
            );
        }

        // Update clinic status if Churn or Pause
        if (event_type === "Churn" || event_type === "Pause" || event_type === "Return") {
            await supabaseAdmin
                .from("clinics")
                .update({ status: statusChange.new })
                .eq("id", clinic_id);
        }

        return NextResponse.json({ success: true, event: data, action: "created" });
    } catch (err) {
        console.error("Clinic events POST error:", err);
        return NextResponse.json(
            { error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, event_type, notes, confirmed, previous_mrr, new_mrr } = body;

        if (!id) {
            return NextResponse.json(
                { error: "id é obrigatório" },
                { status: 400 }
            );
        }

        const updateData: Record<string, unknown> = {};
        
        if (event_type !== undefined) {
            const validEventTypes = ["New", "Pause", "Return", "Churn"];
            if (!validEventTypes.includes(event_type)) {
                return NextResponse.json(
                    { error: `event_type inválido` },
                    { status: 400 }
                );
            }
            updateData.event_type = event_type;
            
            // Update status based on new event type
            const statusMap: Record<string, string> = {
                New: "active",
                Pause: "paused",
                Return: "active",
                Churn: "churned",
            };
            updateData.new_status = statusMap[event_type];
        }

        if (notes !== undefined) updateData.notes = notes;
        if (confirmed !== undefined) updateData.confirmed = confirmed;
        if (previous_mrr !== undefined) updateData.previous_mrr = previous_mrr;
        if (new_mrr !== undefined) updateData.new_mrr = new_mrr;

        const { data, error } = await supabaseAdmin
            .from("clinic_events")
            .update(updateData)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: "Erro ao atualizar evento: " + error.message },
                { status: 500 }
            );
        }

        // If we changed the event type to Churn/Pause/Return, update clinic status
        if (updateData.new_status && data?.clinic_id) {
            await supabaseAdmin
                .from("clinics")
                .update({ status: updateData.new_status })
                .eq("id", data.clinic_id);
        }

        return NextResponse.json({ success: true, event: data });
    } catch (err) {
        console.error("Clinic events PUT error:", err);
        return NextResponse.json(
            { error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json(
            { error: "id é obrigatório" },
            { status: 400 }
        );
    }

    try {
        const { error } = await supabaseAdmin
            .from("clinic_events")
            .delete()
            .eq("id", parseInt(id));

        if (error) {
            return NextResponse.json(
                { error: "Erro ao deletar evento: " + error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Clinic events DELETE error:", err);
        return NextResponse.json(
            { error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}
