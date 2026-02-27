import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
);

type ScopeType = "ES" | "US" | "GLOBAL";

interface PayrollConcept {
    code: number;
    description: string;
    amount: number;
    isDeduction: boolean;
}

interface PayrollDepartment {
    name: string;
    code: string;
    concepts: PayrollConcept[];
}

interface PayrollData {
    period: string;
    departments: PayrollDepartment[];
}

interface SplitInput {
    department_code: string;
    sub_department_code?: string | null;
    percentage: number;
}

interface AllocationInput {
    line_key: string;
    splits: SplitInput[];
}

interface RequestBody {
    year: number;
    month: number;
    due_date?: string;
    schedule_date?: string | null;
    provider_name?: string;
    scope?: ScopeType;
    currency?: string;
    cost_type_code?: string;
    dep_cost_type_code?: string;
    payment_method_code?: string | null;
    bank_account_code?: string | null;
    fallback_financial_account_code?: string | null;
    dry_run?: boolean;
    overwrite_existing?: boolean;
    allocations?: AllocationInput[];
}

interface BaseLine {
    line_key: string;
    concept_code: string;
    concept_description: string;
    financial_account_code: string;
    financial_account_name: string | null;
    department_code: string;
    department_name: string;
    sub_department_code: string | null;
    amount: number;
}

interface FinalLine {
    financial_account_code: string;
    financial_account_name: string | null;
    cost_center_code: string;
    sub_department_code: string | null;
    amount: number;
}

const toDate = (year: number, month: number, day: number) => {
    const jsDate = new Date(Date.UTC(year, month - 1, day));
    return jsDate.toISOString().slice(0, 10);
};

const getMonthEndDate = (year: number, month: number) => {
    const jsDate = new Date(Date.UTC(year, month, 0));
    return jsDate.toISOString().slice(0, 10);
};

const parseConceptCode = (code: number) => String(code).padStart(3, "0");

const buildLineKey = (
    departmentCode: string,
    subDepartmentCode: string | null,
    conceptCode: string,
    financialAccountCode: string,
) => `${departmentCode}__${subDepartmentCode || ""}__${conceptCode}__${financialAccountCode}`;

const normalizeKey = (value: string | null | undefined) =>
    String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

function resolveDepartmentHierarchy(
    inputDepartmentCode: string,
    inputDepartmentName: string,
    costCenterCodes: Set<string>,
    costCenterByName: Map<string, string>,
    subDepartmentsByCode: Map<string, { code: string; parent_department_code: string }>,
    subDepartmentByName: Map<string, { code: string; parent_department_code: string }>,
) {
    const codeRaw = String(inputDepartmentCode || "").trim();
    const nameRaw = String(inputDepartmentName || "").trim();

    if (codeRaw && costCenterCodes.has(codeRaw)) {
        return { cost_center_code: codeRaw, sub_department_code: null as string | null, source: "department_code" };
    }

    const subByCode = codeRaw ? subDepartmentsByCode.get(codeRaw) : null;
    if (subByCode) {
        return {
            cost_center_code: subByCode.parent_department_code,
            sub_department_code: subByCode.code,
            source: "sub_department_code",
        };
    }

    if (codeRaw) {
        const numericRootMatch = codeRaw.match(/^(\d+)$/);
        if (numericRootMatch) {
            const rootAsCostCenter = `${numericRootMatch[1]}.0.0`;
            if (costCenterCodes.has(rootAsCostCenter)) {
                return { cost_center_code: rootAsCostCenter, sub_department_code: null as string | null, source: "department_root" };
            }
        }
    }

    const subByName = nameRaw ? subDepartmentByName.get(normalizeKey(nameRaw)) : null;
    if (subByName) {
        return {
            cost_center_code: subByName.parent_department_code,
            sub_department_code: subByName.code,
            source: "sub_department_name",
        };
    }

    const costCenterByDeptName = nameRaw ? costCenterByName.get(normalizeKey(nameRaw)) : null;
    if (costCenterByDeptName) {
        return {
            cost_center_code: costCenterByDeptName,
            sub_department_code: null as string | null,
            source: "department_name",
        };
    }

    return null;
}

async function resolveInvoiceDefaults(scope: ScopeType) {
    const { data, error } = await supabase
        .from("invoices")
        .select("cost_type_code,dep_cost_type_code,payment_method_code,bank_account_code,financial_account_code,created_at")
        .eq("scope", scope)
        .order("created_at", { ascending: false })
        .limit(200);

    if (error) throw error;

    const rows = data || [];

    return {
        cost_type_code: rows.find((row: any) => row.cost_type_code)?.cost_type_code || null,
        dep_cost_type_code: rows.find((row: any) => row.dep_cost_type_code)?.dep_cost_type_code || null,
        payment_method_code: rows.find((row: any) => row.payment_method_code)?.payment_method_code || null,
        bank_account_code: rows.find((row: any) => row.bank_account_code)?.bank_account_code || null,
        fallback_financial_account_code: rows.find((row: any) => row.financial_account_code)?.financial_account_code || null,
    };
}

async function ensureProviderCode(providerName: string, scope: ScopeType, dryRun: boolean) {
    const normalized = providerName.trim();

    const { data: existingByName } = await supabase
        .from("providers")
        .select("code,name")
        .ilike("name", normalized)
        .limit(1);

    if (existingByName && existingByName.length > 0) {
        return existingByName[0].code as string;
    }

    if (dryRun) {
        return `${scope}-PENDING-PROVIDER`;
    }

    const { data: maxCodeData } = await supabase
        .from("providers")
        .select("code")
        .like("code", `${scope}-PV%`)
        .order("code", { ascending: false })
        .limit(1);

    let nextNumber = 1;
    if (maxCodeData && maxCodeData.length > 0) {
        const match = String(maxCodeData[0].code || "").match(/-PV(\d+)$/);
        if (match) nextNumber = parseInt(match[1], 10) + 1;
    }

    const newCode = `${scope}-PV${String(nextNumber).padStart(5, "0")}`;

    const { error } = await supabase.from("providers").insert({
        code: newCode,
        name: normalized,
        provider_type: "supplier",
        country: scope,
        currency: scope === "US" ? "USD" : "EUR",
        payment_terms: "Net 30",
        is_active: true,
    });

    if (error) throw error;
    return newCode;
}

function buildFinalLines(baseLines: BaseLine[], allocations: AllocationInput[] | undefined) {
    const allocMap = new Map<string, SplitInput[]>();
    (allocations || []).forEach((item) => {
        allocMap.set(item.line_key, item.splits || []);
    });

    const grouped = new Map<string, FinalLine>();
    const warnings: string[] = [];

    for (const line of baseLines) {
        const customSplits = allocMap.get(line.line_key);
        const splits: SplitInput[] = customSplits && customSplits.length > 0
            ? customSplits
            : [{
                department_code: line.department_code,
                sub_department_code: line.sub_department_code,
                percentage: 100,
            }];

        const totalPct = splits.reduce((sum, split) => sum + (split.percentage || 0), 0);
        if (Math.abs(totalPct - 100) > 0.01) {
            warnings.push(`Split inválido na linha ${line.line_key}: soma ${totalPct.toFixed(2)}% (esperado 100%).`);
            continue;
        }

        for (const split of splits) {
            if (!split.department_code) {
                warnings.push(`Split sem department_code na linha ${line.line_key}.`);
                continue;
            }

            const splitAmount = (line.amount * split.percentage) / 100;
            if (splitAmount <= 0) continue;

            const groupKey = [
                line.financial_account_code,
                split.department_code,
                split.sub_department_code || "",
            ].join("|");

            const existing = grouped.get(groupKey);
            if (existing) {
                existing.amount += splitAmount;
            } else {
                grouped.set(groupKey, {
                    financial_account_code: line.financial_account_code,
                    financial_account_name: line.financial_account_name,
                    cost_center_code: split.department_code,
                    sub_department_code: split.sub_department_code || null,
                    amount: splitAmount,
                });
            }
        }
    }

    return {
        finalLines: Array.from(grouped.values()).filter((line) => line.amount > 0.01),
        warnings,
    };
}

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as RequestBody;

        if (!body.year || !body.month) {
            return NextResponse.json({ success: false, error: "year e month são obrigatórios" }, { status: 400 });
        }
        const dryRun = Boolean(body.dry_run);
        const overwriteExisting = Boolean(body.overwrite_existing);
        const scope: ScopeType = body.scope || "ES";
        const providerName = body.provider_name?.trim() || "Digital Smile Design Payroll";
        const resolvedDefaults = await resolveInvoiceDefaults(scope);

        const costTypeCode = body.cost_type_code?.trim() || resolvedDefaults.cost_type_code;
        const depCostTypeCode = body.dep_cost_type_code?.trim() || resolvedDefaults.dep_cost_type_code;
        const fallbackFinancialAccountCode =
            body.fallback_financial_account_code?.trim() || resolvedDefaults.fallback_financial_account_code || null;
        const paymentMethodCode = body.payment_method_code || resolvedDefaults.payment_method_code;
        const bankAccountCode = body.bank_account_code || resolvedDefaults.bank_account_code;

        if (!costTypeCode || !depCostTypeCode) {
            return NextResponse.json(
                { success: false, error: "Não foi possível determinar cost_type_code e dep_cost_type_code automaticamente." },
                { status: 400 },
            );
        }

        const { data: payrollRow, error: payrollError } = await supabase
            .from("payroll_uploads")
            .select("data,file_name,year,month")
            .eq("year", body.year)
            .eq("month", body.month)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (payrollError) throw payrollError;
        if (!payrollRow?.data) {
            return NextResponse.json({ success: false, error: "Payroll do mês selecionado não encontrado" }, { status: 404 });
        }

        const payrollData = payrollRow.data as PayrollData;

        const { data: mappingRows, error: mappingError } = await supabase
            .from("payroll_line_mappings")
            .select("concept_code,financial_account_code,financial_account_name,department_override,is_active")
            .eq("is_active", true);

        if (mappingError) throw mappingError;

        const mapByConcept = new Map<string, any>();
        (mappingRows || []).forEach((row: any) => mapByConcept.set(String(row.concept_code).padStart(3, "0"), row));

        const { data: financialAccounts, error: faError } = await supabase
            .from("financial_accounts")
            .select("code,name")
            .eq("is_active", true);
        if (faError) throw faError;
        const faNameMap = new Map((financialAccounts || []).map((fa: any) => [fa.code, fa.name]));

        const { data: costCenters, error: costCenterError } = await supabase
            .from("cost_centers")
            .select("code,name")
            .eq("is_active", true)
            .eq("level", 1);
        if (costCenterError) throw costCenterError;

        const { data: subDepartments, error: subDepartmentError } = await supabase
            .from("sub_departments")
            .select("code,name,parent_department_code")
            .eq("is_active", true);
        if (subDepartmentError) throw subDepartmentError;

        const costCenterCodes = new Set((costCenters || []).map((row: any) => String(row.code || "").trim()).filter(Boolean));
        const costCenterByName = new Map(
            (costCenters || [])
                .filter((row: any) => row.name && row.code)
                .map((row: any) => [normalizeKey(row.name), String(row.code).trim()]),
        );

        const subDepartmentsByCode = new Map(
            (subDepartments || [])
                .filter((row: any) => row.code && row.parent_department_code)
                .map((row: any) => [String(row.code).trim(), {
                    code: String(row.code).trim(),
                    parent_department_code: String(row.parent_department_code).trim(),
                }]),
        );

        const subDepartmentByName = new Map(
            (subDepartments || [])
                .filter((row: any) => row.name && row.code && row.parent_department_code)
                .map((row: any) => [normalizeKey(row.name), {
                    code: String(row.code).trim(),
                    parent_department_code: String(row.parent_department_code).trim(),
                }]),
        );

        const baseLines: BaseLine[] = [];
        const skipped: Array<{ reason: string; concept_code: string; department_code: string; amount: number }> = [];

        for (const department of payrollData.departments || []) {
            const departmentCode = (department.code || "").trim();
            if (!departmentCode) continue;

            for (const concept of department.concepts || []) {
                const amount = Math.abs(Number(concept.amount) || 0);
                if (!amount) continue;

                const conceptCode = parseConceptCode(concept.code);
                const mapping = mapByConcept.get(conceptCode);

                const financialAccountCode =
                    String(mapping?.financial_account_code || "").trim() ||
                    fallbackFinancialAccountCode ||
                    "";

                if (!financialAccountCode) {
                    skipped.push({
                        reason: "Sem financial account mapeada e sem fallback",
                        concept_code: conceptCode,
                        department_code: departmentCode,
                        amount,
                    });
                    continue;
                }

                const targetDepartment =
                    String(mapping?.department_override || "").trim() || departmentCode;

                const hierarchy = resolveDepartmentHierarchy(
                    targetDepartment,
                    department.name,
                    costCenterCodes,
                    costCenterByName,
                    subDepartmentsByCode,
                    subDepartmentByName,
                );

                if (!hierarchy) {
                    skipped.push({
                        reason: "Department/Sub-department não mapeado para cost_centers/sub_departments",
                        concept_code: conceptCode,
                        department_code: targetDepartment,
                        amount,
                    });
                    continue;
                }

                const lineKey = buildLineKey(
                    hierarchy.cost_center_code,
                    hierarchy.sub_department_code,
                    conceptCode,
                    financialAccountCode,
                );

                baseLines.push({
                    line_key: lineKey,
                    concept_code: conceptCode,
                    concept_description: concept.description,
                    financial_account_code: financialAccountCode,
                    financial_account_name: mapping?.financial_account_name || faNameMap.get(financialAccountCode) || null,
                    department_code: hierarchy.cost_center_code,
                    department_name: department.name,
                    sub_department_code: hierarchy.sub_department_code,
                    amount,
                });
            }
        }

        const mergedBaseMap = new Map<string, BaseLine>();
        for (const line of baseLines) {
            const existing = mergedBaseMap.get(line.line_key);
            if (existing) {
                existing.amount += line.amount;
            } else {
                mergedBaseMap.set(line.line_key, { ...line });
            }
        }
        const mergedBaseLines = Array.from(mergedBaseMap.values());

        const { finalLines, warnings } = buildFinalLines(mergedBaseLines, body.allocations);

        const providerCode = await ensureProviderCode(providerName, scope, dryRun);
        const monthStr = String(body.month).padStart(2, "0");
        const invoiceDate = toDate(body.year, body.month, 1);
        const benefitDate = invoiceDate;
        const dueDate = body.due_date || getMonthEndDate(body.year, body.month);
        const scheduleDate = body.schedule_date || dueDate;

        if (dryRun) {
            return NextResponse.json({
                success: true,
                dry_run: true,
                provider_code: providerCode,
                provider_name: providerName,
                period: `${body.year}-${monthStr}`,
                overwrite_existing: overwriteExisting,
                base_lines: mergedBaseLines,
                final_lines: finalLines,
                skipped,
                warnings,
                totals: {
                    base_lines: mergedBaseLines.length,
                    final_lines: finalLines.length,
                    total_amount: finalLines.reduce((sum, line) => sum + line.amount, 0),
                },
            });
        }

        if (finalLines.length === 0) {
            return NextResponse.json({
                success: false,
                error: "Nenhuma linha válida para gerar invoices",
                skipped,
                warnings,
            }, { status: 400 });
        }

        const { data: existingInvoices } = await supabase
            .from("invoices")
            .select("id,financial_account_code,cost_center_code,sub_department_code,scope,provider_code,invoice_date,notes")
            .eq("scope", scope)
            .eq("provider_code", providerCode)
            .gte("invoice_date", `${body.year}-${monthStr}-01`)
            .lte("invoice_date", `${body.year}-${monthStr}-31`)
            .ilike("notes", `%PAYROLL_AUTO|${body.year}-${monthStr}%`);

        const existingKeys = new Set(
            (existingInvoices || []).map((row: any) =>
                [
                    row.financial_account_code,
                    row.cost_center_code || "",
                    row.sub_department_code || "",
                ].join("|"),
            ),
        );

        let overwrittenCount = 0;
        if (overwriteExisting && existingInvoices && existingInvoices.length > 0) {
            const idsToDelete = existingInvoices
                .map((row: any) => row.id)
                .filter((id: any) => typeof id === "number");

            if (idsToDelete.length > 0) {
                const { error: deleteError } = await supabase
                    .from("invoices")
                    .delete()
                    .in("id", idsToDelete);

                if (deleteError) throw deleteError;
                overwrittenCount = idsToDelete.length;
            }
            existingKeys.clear();
        }

        const { data: maxInvoiceData } = await supabase
            .from("invoices")
            .select("invoice_number")
            .like("invoice_number", `${scope}-INV-${body.year}${monthStr}%`)
            .order("invoice_number", { ascending: false })
            .limit(1);

        let sequence = 1;
        if (maxInvoiceData && maxInvoiceData.length > 0 && maxInvoiceData[0].invoice_number) {
            const match = String(maxInvoiceData[0].invoice_number).match(/-(\d+)$/);
            if (match) sequence = parseInt(match[1], 10) + 1;
        }

        const toInsert: any[] = [];
        const skippedByIdempotency: FinalLine[] = [];

        for (const line of finalLines) {
            const lineKey = [line.financial_account_code, line.cost_center_code || "", line.sub_department_code || ""].join("|");
            if (existingKeys.has(lineKey)) {
                skippedByIdempotency.push(line);
                continue;
            }

            const invoiceNumber = `${scope}-INV-${body.year}${monthStr}-${String(sequence).padStart(4, "0")}`;
            sequence += 1;

            toInsert.push({
                input_date: toDate(body.year, body.month, new Date().getDate()),
                invoice_date: invoiceDate,
                benefit_date: benefitDate,
                due_date: dueDate,
                schedule_date: scheduleDate,
                payment_date: null,
                invoice_type: "INCURRED",
                entry_type: "invoice",
                financial_account_code: line.financial_account_code,
                financial_account_name: line.financial_account_name,
                invoice_amount: Number(line.amount.toFixed(2)),
                currency: body.currency || "EUR",
                paid_amount: null,
                paid_currency: null,
                eur_exchange: 1,
                provider_code: providerCode,
                bank_account_code: bankAccountCode || null,
                payment_method_code: paymentMethodCode || null,
                cost_type_code: costTypeCode,
                dep_cost_type_code: depCostTypeCode,
                cost_center_code: line.cost_center_code,
                sub_department_code: line.sub_department_code,
                description: `Payroll ${body.year}-${monthStr}`,
                invoice_number: invoiceNumber,
                country_code: scope,
                scope,
                dre_impact: true,
                cash_impact: true,
                is_intercompany: false,
                notes: `PAYROLL_AUTO|${body.year}-${monthStr}|source=${payrollRow.file_name || "upload"}`,
            });
        }

        if (toInsert.length === 0) {
            return NextResponse.json({
                success: true,
                message: "Nenhuma invoice nova para inserir (todas já existentes)",
                inserted_count: 0,
                skipped_idempotency_count: skippedByIdempotency.length,
                overwritten_count: overwrittenCount,
                skipped,
                warnings,
            });
        }

        const { data: insertedData, error: insertError } = await supabase
            .from("invoices")
            .insert(toInsert)
            .select("id,invoice_number");

        if (insertError) throw insertError;

        return NextResponse.json({
            success: true,
            inserted_count: insertedData?.length || 0,
            skipped_idempotency_count: skippedByIdempotency.length,
            overwritten_count: overwrittenCount,
            provider_code: providerCode,
            provider_name: providerName,
            period: `${body.year}-${monthStr}`,
            inserted: insertedData || [],
            skipped,
            warnings,
        });
    } catch (error: any) {
        console.error("payroll/generate-invoices error:", error);
        return NextResponse.json(
            { success: false, error: error?.message || "Falha ao gerar invoices de payroll" },
            { status: 500 },
        );
    }
}
