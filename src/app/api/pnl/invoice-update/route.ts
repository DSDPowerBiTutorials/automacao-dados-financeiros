import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, ...fields } = body;

        if (!id) {
            return NextResponse.json(
                { error: "id is required" },
                { status: 400 }
            );
        }

        // Map camelCase fields to snake_case DB columns
        const fieldMap: Record<string, string> = {
            invoiceDate: "invoice_date",
            benefitDate: "benefit_date",
            dueDate: "due_date",
            scheduleDate: "schedule_date",
            paymentDate: "payment_date",
            invoiceNumber: "invoice_number",
            invoiceType: "invoice_type",
            entryType: "entry_type",
            description: "description",
            notes: "notes",
            invoiceAmount: "invoice_amount",
            currency: "currency",
            paidAmount: "paid_amount",
            paidCurrency: "paid_currency",
            eurExchange: "eur_exchange",
            providerCode: "provider_code",
            bankAccountCode: "bank_account_code",
            paymentMethodCode: "payment_method_code",
            costTypeCode: "cost_type_code",
            depCostTypeCode: "dep_cost_type_code",
            costCenterCode: "cost_center_code",
            courseCode: "course_code",
            financialAccountCode: "financial_account_code",
            financialAccountName: "financial_account_name",
            countryCode: "country_code",
            dreImpact: "dre_impact",
            cashImpact: "cash_impact",
            isIntercompany: "is_intercompany",
            paymentStatus: "payment_status",
        };

        const updateData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(fields)) {
            const dbCol = fieldMap[key];
            if (dbCol) {
                // Handle empty strings → null for optional fields
                updateData[dbCol] = value === "" ? null : value;
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { error: "No fields to update" },
                { status: 400 }
            );
        }

        updateData["updated_at"] = new Date().toISOString();

        const { data, error } = await supabaseAdmin
            .from("invoices")
            .update(updateData)
            .eq("id", id)
            .select("id")
            .single();

        if (error) {
            console.error("Error updating invoice:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, id: data.id });
    } catch (error) {
        console.error("Error in invoice update API:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
