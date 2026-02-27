import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const fallbackContracts = [
    {
        id: "fallback-1",
        contract_code: "CTR-DSD-PC-2025-11",
        name: "SERVICE PROPOSAL DSD PC Department Signed",
        provider_name: "DSD",
        contract_type: "service_proposal",
        department_code: null,
        sub_department_code: null,
        monthly_amount: null,
        annual_amount: null,
        start_date: null,
        end_date: null,
        duration_months: 12,
        admin_fee_percent: 15,
        currency_code: "EUR",
        monthly_retainer_amount: 114624.22,
        annual_estimated_amount: 1375490.64,
        submitted_to: "DSD Corporate Management",
        submitted_by: "DSD Corporate Management",
        location: "Madrid, Spain",
        summary: "Operational cost budget for Lab / Planning Center / Delight with marketing and operations support.",
        service_scope: "Marketing support, operations and admin support.",
        document_path: "/contracts/service-proposal-dsd-pc-department-signed.pdf",
        source_document_filename: "service-proposal-dsd-pc-department-signed.pdf",
        key_terms: {
            duration_label: "12 Months (November 1, 2025 – October 31, 2026)",
            administrative_fee_note: "A 15% administrative fee is included to cover overhead and service continuity.",
        },
        status: "active",
        document_url: "/contracts/service-proposal-dsd-pc-department-signed.pdf",
        scope: "ES",
        is_active: true,
    },
    {
        id: "fallback-2",
        contract_code: "CTR-DSD-EDU-2025-11",
        name: "Signed SERVICE PROPOSAL DSD Education LLC Signed",
        provider_name: "DSD Education LLC",
        contract_type: "service_proposal",
        department_code: null,
        sub_department_code: null,
        monthly_amount: null,
        annual_amount: null,
        start_date: null,
        end_date: null,
        duration_months: 12,
        admin_fee_percent: 15,
        currency_code: "EUR",
        monthly_retainer_amount: 47891.61,
        annual_estimated_amount: 574699.32,
        submitted_to: "DSD Education LLC",
        submitted_by: "DSD Corporate Management",
        location: "Madrid, Spain",
        summary: "Operational cost budget for Education & Events with marketing and education operations support.",
        service_scope: "Marketing support and Education Ops execution.",
        document_path: "/contracts/service-proposal-dsd-education-llc-signed.pdf",
        source_document_filename: "service-proposal-dsd-education-llc-signed.pdf",
        key_terms: {
            duration_label: "12 Months (November 1, 2025 – October 31, 2026)",
            administrative_fee_note: "A 15% administrative fee is included to cover overhead and service continuity.",
        },
        status: "active",
        document_url: "/contracts/service-proposal-dsd-education-llc-signed.pdf",
        scope: "ES",
        is_active: true,
    },
];

const fallbackPartiesByContract: Record<string, Array<Record<string, any>>> = {
    "fallback-1": [
        { role: "client", name: "DSD Corporate Management", entity_type: "company", country: "ES", is_primary: true },
        { role: "provider", name: "DSD Lab / Planning Center / Delight Department", entity_type: "department", country: "ES", is_primary: true },
    ],
    "fallback-2": [
        { role: "client", name: "DSD Education LLC", entity_type: "company", country: "US", is_primary: true },
        { role: "provider", name: "DSD Corporate Management", entity_type: "company", country: "ES", is_primary: true },
    ],
};

const fallbackLineItemsByContract: Record<string, Array<Record<string, any>>> = {
    "fallback-1": [
        { item_order: 1, code: "A", category: "marketing", name: "Marketing Support", monthly_amount: 3256.26, annual_amount: 39075.12 },
        { item_order: 2, code: "B", category: "operations", name: "Operation Delight", monthly_amount: 70327.47, annual_amount: 843929.64 },
        { item_order: 3, code: "C", category: "operations", name: "Operation Lab", monthly_amount: 41040.49, annual_amount: 492485.88 },
    ],
    "fallback-2": [
        { item_order: 1, code: "A", category: "marketing", name: "Marketing Support", monthly_amount: 10854.19, annual_amount: 130250.28 },
        { item_order: 2, code: "B", category: "operations", name: "Education Ops", monthly_amount: 37037.42, annual_amount: 444449.04 },
    ],
};

export async function GET() {
    try {
        const [contractsRes, departmentsRes, subDepartmentsRes] = await Promise.all([
            supabaseAdmin.from("contracts").select("*").eq("is_active", true).order("name", { ascending: true }),
            supabaseAdmin
                .from("cost_centers")
                .select("code,name")
                .eq("is_active", true)
                .eq("level", 1)
                .order("name", { ascending: true }),
            supabaseAdmin
                .from("sub_departments")
                .select("code,name,parent_department_code")
                .eq("is_active", true)
                .order("name", { ascending: true }),
        ]);

        if (departmentsRes.error) throw departmentsRes.error;
        if (subDepartmentsRes.error) throw subDepartmentsRes.error;

        const contractsTableMissing =
            !!contractsRes.error &&
            String(contractsRes.error.message || "").toLowerCase().includes("public.contracts");

        if (contractsRes.error && !contractsTableMissing) {
            throw contractsRes.error;
        }

        const contracts = contractsTableMissing ? fallbackContracts : contractsRes.data || [];
        const contractIds = contracts.map((contract: any) => contract.id).filter(Boolean);

        let partiesByContract: Record<string, Array<Record<string, any>>> = {};
        let lineItemsByContract: Record<string, Array<Record<string, any>>> = {};

        if (contractsTableMissing) {
            partiesByContract = fallbackPartiesByContract;
            lineItemsByContract = fallbackLineItemsByContract;
        } else if (contractIds.length > 0) {
            const [partiesRes, lineItemsRes] = await Promise.all([
                supabaseAdmin
                    .from("contract_parties")
                    .select("contract_id,role,name,entity_type,tax_id,country,email,is_primary")
                    .in("contract_id", contractIds),
                supabaseAdmin
                    .from("contract_line_items")
                    .select("contract_id,item_order,code,category,name,monthly_amount,annual_amount,allocation_percent,notes")
                    .in("contract_id", contractIds)
                    .order("item_order", { ascending: true }),
            ]);

            const partiesMissing =
                !!partiesRes.error &&
                String(partiesRes.error.message || "").toLowerCase().includes("contract_parties");
            const lineItemsMissing =
                !!lineItemsRes.error &&
                String(lineItemsRes.error.message || "").toLowerCase().includes("contract_line_items");

            if (partiesRes.error && !partiesMissing) throw partiesRes.error;
            if (lineItemsRes.error && !lineItemsMissing) throw lineItemsRes.error;

            if (!partiesRes.error) {
                (partiesRes.data || []).forEach((row: any) => {
                    const key = row.contract_id;
                    if (!partiesByContract[key]) partiesByContract[key] = [];
                    partiesByContract[key].push(row);
                });
            }

            if (!lineItemsRes.error) {
                (lineItemsRes.data || []).forEach((row: any) => {
                    const key = row.contract_id;
                    if (!lineItemsByContract[key]) lineItemsByContract[key] = [];
                    lineItemsByContract[key].push(row);
                });
            }
        }

        return NextResponse.json({
            success: true,
            contracts,
            departments: departmentsRes.data || [],
            subDepartments: subDepartmentsRes.data || [],
            partiesByContract,
            lineItemsByContract,
            usingFallback: contractsTableMissing,
            warning: contractsTableMissing
                ? "Tabela contracts não encontrada no banco atual. Exibindo fallback temporário."
                : null,
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: error?.message || "Falha ao carregar contratos",
            },
            { status: 500 },
        );
    }
}
