import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Expense FA codes start with 2xx, 3xx, 4xx, 0xxx
const isExpenseFA = (faCode: string): boolean => {
    return /^[234]/.test(faCode) || faCode.startsWith("0");
};

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const faCode = searchParams.get("fa");
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get("month") || "0"); // 0-indexed
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "100");

    if (!faCode) {
        return NextResponse.json(
            { error: "financial_account_code (fa) é obrigatório" },
            { status: 400 }
        );
    }

    try {
        // Calcular range de datas para o mês (sem timezone issues)
        const monthStr = String(month + 1).padStart(2, "0");
        const startStr = `${year}-${monthStr}-01`;
        const lastDay = new Date(year, month + 1, 0).getDate();
        const endStr = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

        console.log(`📊 Drill-down: FA=${faCode}, Mês=${month + 1}, Ano=${year}, Range=${startStr} a ${endStr}`);

        let transactions: any[] = [];
        let total = 0;
        let totalFiltered = 0;

        if (isExpenseFA(faCode)) {
            // ── EXPENSE DRILL-DOWN: query invoices table ──
            // For parent codes ending in .0, query all sub-codes (e.g., 202.0 → 202.%)
            // For 210.0 (Balance Adjustments), also include FA code "0000" (unassigned)
            const isParentCode = faCode.endsWith('.0');
            const prefix = faCode.replace(/\.0$/, '');

            let query = supabaseAdmin
                .from("invoices")
                .select(`
                    id, benefit_date, invoice_date, due_date, schedule_date, payment_date, input_date,
                    description, invoice_amount, currency, provider_code, financial_account_name,
                    financial_account_code, invoice_type, invoice_number, entry_type,
                    bank_account_code, payment_method_code, cost_center_code, cost_type_code,
                    dep_cost_type_code, course_code, sub_department_code,
                    notes, dre_impact, cash_impact, is_intercompany,
                    paid_amount, paid_currency, eur_exchange,
                    payment_status, finance_payment_status, invoice_status, scope, country_code
                `)
                .eq("dre_impact", true)
                .neq("invoice_type", "BUDGET")
                .gte("benefit_date", startStr)
                .lte("benefit_date", endStr)
                .neq("invoice_amount", 0)
                .order("invoice_amount", { ascending: false })
                .limit(500);

            if (faCode === "210.0") {
                // Balance Adjustments: include 210.0 and unassigned "0000"
                query = query.or(`financial_account_code.eq.210.0,financial_account_code.eq.0000,financial_account_code.like.210.%`);
            } else if (isParentCode) {
                // Parent code: query all sub-codes (e.g., 202.% matches 202.0, 202.1, 202.2, ...)
                query = query.like("financial_account_code", `${prefix}.%`);
            } else {
                query = query.eq("financial_account_code", faCode);
            }

            const { data, error } = await query;

            if (error) {
                console.error("Erro ao buscar drill-down de despesas:", error);
                return NextResponse.json(
                    { error: "Erro ao buscar dados: " + error.message },
                    { status: 500 }
                );
            }

            totalFiltered = data?.length || 0;
            total = (data || []).reduce((sum, row) => sum + (row.invoice_amount || 0), 0);

            const startIndex = (page - 1) * limit;
            const paginatedData = (data || []).slice(startIndex, startIndex + limit);

            // Collect unique codes to resolve names in batch
            const uniqueCodes = {
                providers: [...new Set(paginatedData.map(r => r.provider_code).filter(Boolean))],
                bankAccounts: [...new Set(paginatedData.map(r => r.bank_account_code).filter(Boolean))],
                paymentMethods: [...new Set(paginatedData.map(r => r.payment_method_code).filter(Boolean))],
                costCenters: [...new Set(paginatedData.map(r => r.cost_center_code).filter(Boolean))],
                costTypes: [...new Set(paginatedData.map(r => r.cost_type_code).filter(Boolean))],
                depCostTypes: [...new Set(paginatedData.map(r => r.dep_cost_type_code).filter(Boolean))],
                courses: [...new Set(paginatedData.map(r => r.course_code).filter(Boolean))],
                subDepartments: [...new Set(paginatedData.map(r => r.sub_department_code).filter(Boolean))],
            };

            // Resolve names in parallel
            const nameMap: Record<string, Record<string, string>> = {};
            const lookups: [string, string, string[]][] = [
                ["providers", "providers", uniqueCodes.providers],
                ["bank_accounts", "bankAccounts", uniqueCodes.bankAccounts],
                ["payment_methods", "paymentMethods", uniqueCodes.paymentMethods],
                ["cost_centers", "costCenters", uniqueCodes.costCenters],
                ["cost_types", "costTypes", uniqueCodes.costTypes],
                ["dep_cost_types", "depCostTypes", uniqueCodes.depCostTypes],
                ["courses", "courses", uniqueCodes.courses],
                ["sub_departments", "subDepartments", uniqueCodes.subDepartments],
            ];

            await Promise.all(lookups.map(async ([table, key, codes]) => {
                nameMap[key] = {};
                if (codes.length === 0) return;
                const { data: rows } = await supabaseAdmin
                    .from(table)
                    .select("code, name")
                    .in("code", codes);
                if (rows) {
                    for (const r of rows) nameMap[key][r.code] = r.name;
                }
            }));

            transactions = paginatedData.map((row) => ({
                id: row.id,
                date: row.benefit_date,
                description: row.description || row.financial_account_name || "-",
                amount: row.invoice_amount,
                customer: row.provider_code || "-",
                orderType: row.invoice_type || "-",
                source: "invoices",
                invoiceNumber: row.invoice_number,
                faCode: row.financial_account_code,
                // Full invoice details
                invoiceDate: row.invoice_date,
                benefitDate: row.benefit_date,
                inputDate: row.input_date,
                dueDate: row.due_date,
                scheduleDate: row.schedule_date,
                paymentDate: row.payment_date,
                currency: row.currency || "EUR",
                entryType: row.entry_type,
                scope: row.scope || row.country_code,
                // Codes + resolved names
                bankAccountCode: row.bank_account_code,
                bankAccountName: nameMap.bankAccounts[row.bank_account_code] || null,
                paymentMethodCode: row.payment_method_code,
                paymentMethodName: nameMap.paymentMethods[row.payment_method_code] || null,
                costCenterCode: row.cost_center_code,
                costCenterName: nameMap.costCenters[row.cost_center_code] || null,
                costTypeCode: row.cost_type_code,
                costTypeName: nameMap.costTypes[row.cost_type_code] || null,
                depCostTypeCode: row.dep_cost_type_code,
                depCostTypeName: nameMap.depCostTypes[row.dep_cost_type_code] || null,
                courseCode: row.course_code,
                courseName: nameMap.courses[row.course_code] || null,
                subDepartmentCode: row.sub_department_code,
                subDepartmentName: nameMap.subDepartments[row.sub_department_code] || null,
                providerName: nameMap.providers[row.provider_code] || null,
                financialAccountName: row.financial_account_name,
                // Notes & flags
                notes: row.notes,
                dreImpact: row.dre_impact,
                cashImpact: row.cash_impact,
                isIntercompany: row.is_intercompany,
                // Payment
                paidAmount: row.paid_amount,
                paidCurrency: row.paid_currency,
                eurExchange: row.eur_exchange,
                paymentStatus: row.payment_status,
                financePaymentStatus: row.finance_payment_status,
                invoiceStatus: row.invoice_status,
            }));
        } else {
            // ── REVENUE DRILL-DOWN: query csv_rows table (existing logic) ──
            // For parent revenue codes ending in .0, query all sub-codes
            const isRevenueParent = faCode.endsWith('.0');
            const revenuePrefix = faCode.replace(/\.0$/, '');

            let revQuery = supabaseAdmin
                .from("csv_rows")
                .select("id, date, description, amount, custom_data, source")
                .eq("source", "invoice-orders")
                .gte("date", startStr)
                .lte("date", endStr)
                .neq("amount", 0)
                .order("amount", { ascending: false })
                .limit(500);

            if (isRevenueParent) {
                revQuery = revQuery.ilike("custom_data->>financial_account_code", `${revenuePrefix}.%`);
            } else {
                revQuery = revQuery.ilike("custom_data->>financial_account_code", faCode);
            }

            const { data, error } = await revQuery;

            if (error) {
                console.error("Erro ao buscar drill-down de receita:", error);
                return NextResponse.json(
                    { error: "Erro ao buscar dados: " + error.message },
                    { status: 500 }
                );
            }

            totalFiltered = data?.length || 0;
            total = (data || []).reduce((sum, row) => sum + (row.amount || 0), 0);

            const startIndex = (page - 1) * limit;
            const paginatedData = (data || []).slice(startIndex, startIndex + limit);

            transactions = paginatedData.map((row) => ({
                id: row.id,
                date: row.date,
                description: row.description,
                amount: row.amount,
                customer: row.custom_data?.customer_name || row.custom_data?.client_name || "-",
                orderType: row.custom_data?.order_type || row.custom_data?.product_line || "-",
                source: row.source,
            }));
        }

        console.log(`📊 Drill-down resultado: ${totalFiltered} transações, total €${total.toFixed(2)}`);

        return NextResponse.json({
            success: true,
            faCode,
            year,
            month: month + 1,
            monthName: new Date(year, month).toLocaleString("pt-BR", { month: "long" }),
            transactions,
            total,
            pagination: {
                page,
                limit,
                total: totalFiltered,
                totalPages: Math.ceil(totalFiltered / limit),
            },
        });
    } catch (error) {
        console.error("Erro na API de drill-down:", error);
        return NextResponse.json(
            { error: "Erro interno ao buscar dados" },
            { status: 500 }
        );
    }
}
