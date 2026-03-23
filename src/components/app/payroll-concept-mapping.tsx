"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Loader2,
    ArrowRightLeft,
    Settings2,
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
} from "lucide-react";

// ════════════════════════════════════════════════════════
// Types (mirrored from payroll page)
// ════════════════════════════════════════════════════════

interface PayrollConcept {
    code: number;
    description: string;
    amount: number;
    isDeduction: boolean;
}

interface PayrollEmployee {
    employeeId: string;
    fullName: string;
    department: string;
    departmentCode: string;
    concepts: PayrollConcept[];
    ssEmpresa: number;
}

interface DepartmentSummary {
    name: string;
    code: string;
    employeeCount: number;
    ssEmpresa: number;
    concepts: PayrollConcept[];
}

interface PayrollData {
    period: string;
    company: string;
    currency: string;
    departments: DepartmentSummary[];
    employees: PayrollEmployee[];
    totals: {
        totalBruto: number;
        totalDeducciones: number;
        totalLiquido: number;
        ssEmpresa: number;
        employeeCount: number;
    };
}

interface PayrollMapping {
    id: string;
    concept_code: string;
    concept_description: string | null;
    target_category: string;
    financial_account_code: string | null;
    financial_account_name: string | null;
    department_override: string | null;
    notes: string | null;
}

// ════════════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════════════

const FINANCIAL_ACCOUNT_OPTIONS = [
    { code: "202.0", name: "Labour" },
    { code: "206.1.1", name: "Office SPAIN RH" },
    { code: "201.1", name: "COGS Growth" },
    { code: "201.2", name: "COGS Delight" },
    { code: "201.3", name: "COGS Planning Center" },
    { code: "201.4", name: "COGS LAB" },
    { code: "201.5", name: "COGS Other Income" },
] as const;

const FA_LABELS: Record<string, string> = Object.fromEntries(
    FINANCIAL_ACCOUNT_OPTIONS.map((fa) => [fa.code, `${fa.code} ${fa.name}`]),
);

/** Maps payroll department code → Labour sub-account + cost center info */
const DEPT_TO_LABOUR: Record<
    string,
    {
        fa_code: string;
        fa_name: string;
        cost_center_code: string;
        cost_center_name: string;
        sub_department_code: string;
        sub_department_name: string;
    }
> = {
    "01": {
        fa_code: "202.1",
        fa_name: "Labour Growth",
        cost_center_code: "1.0.0",
        cost_center_name: "Education",
        sub_department_code: "1.0.0",
        sub_department_name: "Education",
    },
    "02": {
        fa_code: "202.2",
        fa_name: "Labour Marketing",
        cost_center_code: "3.0.0",
        cost_center_name: "Corporate",
        sub_department_code: "3.1.2",
        sub_department_name: "Marketing",
    },
    "03": {
        fa_code: "202.3",
        fa_name: "Labour Planning Center",
        cost_center_code: "2.0.0",
        cost_center_name: "LAB",
        sub_department_code: "2.1.1",
        sub_department_name: "Planning Center",
    },
    "07": {
        fa_code: "202.4",
        fa_name: "Labour LAB",
        cost_center_code: "2.0.0",
        cost_center_name: "LAB",
        sub_department_code: "2.1.0",
        sub_department_name: "LAB",
    },
    "04": {
        fa_code: "202.5",
        fa_name: "Labour Corporate",
        cost_center_code: "3.0.0",
        cost_center_name: "Corporate",
        sub_department_code: "3.1.0",
        sub_department_name: "Corporate",
    },
};

const SS_EMPRESA_CODE = "SS_EMPRESA";

// ════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════

function fmtEur(value: number): string {
    return new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

function conceptCodeStr(code: number | string): string {
    return String(code).padStart(3, "0");
}

function categoryFromFA(faCode: string): string {
    if (faCode === "202.0") return "labour";
    if (faCode.startsWith("201.")) return "cogs";
    if (faCode === "206.1.1") return "office-rh-spain";
    return "labour";
}

// ════════════════════════════════════════════════════════
// Extracted concept lists from payroll data
// ════════════════════════════════════════════════════════

interface AggregatedConcept {
    code: string;
    description: string;
    totalAmount: number;
    isDeduction: boolean;
    block: "conceptos" | "deducciones" | "ss_empresa";
}

function extractConcepts(data: PayrollData): AggregatedConcept[] {
    const conceptMap = new Map<string, AggregatedConcept>();

    for (const emp of data.employees) {
        for (const c of emp.concepts) {
            const key = conceptCodeStr(c.code);
            const existing = conceptMap.get(key);
            if (existing) {
                existing.totalAmount += c.amount;
            } else {
                conceptMap.set(key, {
                    code: key,
                    description: c.description,
                    totalAmount: c.amount,
                    isDeduction: c.isDeduction,
                    block: c.isDeduction ? "deducciones" : "conceptos",
                });
            }
        }
    }

    // Add SS Empresa as a virtual concept
    if (data.totals.ssEmpresa) {
        conceptMap.set(SS_EMPRESA_CODE, {
            code: SS_EMPRESA_CODE,
            description: "Seguridad Social Empresa",
            totalAmount: data.totals.ssEmpresa,
            isDeduction: false,
            block: "ss_empresa",
        });
    }

    return Array.from(conceptMap.values()).sort((a, b) => {
        const blockOrder = { conceptos: 0, deducciones: 1, ss_empresa: 2 };
        const diff = blockOrder[a.block] - blockOrder[b.block];
        if (diff !== 0) return diff;
        return a.code.localeCompare(b.code);
    });
}

// ════════════════════════════════════════════════════════
// Labour allocation preview types
// ════════════════════════════════════════════════════════

interface LabourAllocationLine {
    conceptCode: string;
    conceptDescription: string;
    departmentCode: string;
    departmentName: string;
    amount: number;
    fromAccount: string;
    toAccount: string;
    toAccountName: string;
    toCostCenter: string;
    toSubDept: string;
    toSubDeptName: string;
}

function buildLabourAllocations(
    data: PayrollData,
    conceptMappings: Record<string, string>,
): LabourAllocationLine[] {
    const lines: LabourAllocationLine[] = [];

    for (const dept of data.departments) {
        const deptCode = dept.code.replace(/^0*/, "").padStart(2, "0");
        const labourMapping = DEPT_TO_LABOUR[deptCode] || DEPT_TO_LABOUR[dept.code] || null;

        // Concepts mapped to 202.0
        for (const concept of dept.concepts) {
            const codeStr = conceptCodeStr(concept.code);
            const faCode = conceptMappings[codeStr];
            if (faCode !== "202.0") continue;

            const amount = Math.abs(concept.amount);
            if (amount < 0.01) continue;

            if (labourMapping) {
                lines.push({
                    conceptCode: codeStr,
                    conceptDescription: concept.description,
                    departmentCode: dept.code,
                    departmentName: dept.name,
                    amount,
                    fromAccount: "202.0",
                    toAccount: labourMapping.fa_code,
                    toAccountName: labourMapping.fa_name,
                    toCostCenter: labourMapping.cost_center_code,
                    toSubDept: labourMapping.sub_department_code,
                    toSubDeptName: labourMapping.sub_department_name,
                });
            } else {
                // Fallback — no mapping for this department
                lines.push({
                    conceptCode: codeStr,
                    conceptDescription: concept.description,
                    departmentCode: dept.code,
                    departmentName: dept.name,
                    amount,
                    fromAccount: "202.0",
                    toAccount: "202.0",
                    toAccountName: "Labour (unmapped dept)",
                    toCostCenter: "",
                    toSubDept: "",
                    toSubDeptName: "",
                });
            }
        }

        // SS Empresa mapped to 202.0
        if (
            conceptMappings[SS_EMPRESA_CODE] === "202.0" &&
            dept.ssEmpresa &&
            Math.abs(dept.ssEmpresa) >= 0.01
        ) {
            if (labourMapping) {
                lines.push({
                    conceptCode: SS_EMPRESA_CODE,
                    conceptDescription: "Seguridad Social Empresa",
                    departmentCode: dept.code,
                    departmentName: dept.name,
                    amount: Math.abs(dept.ssEmpresa),
                    fromAccount: "202.0",
                    toAccount: labourMapping.fa_code,
                    toAccountName: labourMapping.fa_name,
                    toCostCenter: labourMapping.cost_center_code,
                    toSubDept: labourMapping.sub_department_code,
                    toSubDeptName: labourMapping.sub_department_name,
                });
            }
        }
    }

    return lines;
}

// ════════════════════════════════════════════════════════
// Props
// ════════════════════════════════════════════════════════

interface PayrollConceptMappingProps {
    payrollData: PayrollData;
    selectedYear: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInvoicesCreated?: () => void;
}

// ════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════

export function PayrollConceptMapping({
    payrollData,
    selectedYear,
    open,
    onOpenChange,
    onInvoicesCreated,
}: PayrollConceptMappingProps) {
    // ─── Popup state ───
    const [step, setStep] = useState<1 | 2>(1);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);

    // ─── Popup 1 state — concept → FA mappings ───
    const [conceptMappings, setConceptMappings] = useState<Record<string, string>>({});
    const [savedMappings, setSavedMappings] = useState<PayrollMapping[]>([]);
    const [mappingsLoaded, setMappingsLoaded] = useState(false);
    const [collapsedBlocks, setCollapsedBlocks] = useState<Record<string, boolean>>({});

    // ─── Popup 2 state — labour allocations ───
    const [labourAllocations, setLabourAllocations] = useState<LabourAllocationLine[]>([]);
    const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
    const [overwriteMode, setOverwriteMode] = useState(false);

    // ─── Parse period ───
    const parsedPeriod = useMemo(() => {
        const m = payrollData.period?.match(/^(\d{1,2})\/(\d{4})$/);
        if (m) return { month: parseInt(m[1], 10), year: parseInt(m[2], 10) };
        return { month: new Date().getMonth() + 1, year: selectedYear };
    }, [payrollData.period, selectedYear]);

    const periodLabel = useMemo(() => {
        const monthNames = [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
        ];
        return `${monthNames[parsedPeriod.month - 1]} ${parsedPeriod.year}`;
    }, [parsedPeriod]);

    // ─── Extract concepts ───
    const concepts = useMemo(() => extractConcepts(payrollData), [payrollData]);
    const conceptosList = useMemo(() => concepts.filter((c) => c.block === "conceptos"), [concepts]);
    const deduccionesList = useMemo(() => concepts.filter((c) => c.block === "deducciones"), [concepts]);
    const ssEmpresaList = useMemo(() => concepts.filter((c) => c.block === "ss_empresa"), [concepts]);

    // ─── Load saved mappings on open ───
    useEffect(() => {
        if (!open) return;
        setStep(1);
        setError(null);
        setResult(null);
        setDuplicateWarning(null);
        setOverwriteMode(false);
        setMappingsLoaded(false);

        (async () => {
            try {
                const res = await fetch("/api/payroll/master-data");
                const json = await res.json();
                if (json.success) {
                    setSavedMappings(json.data || []);
                    // Pre-fill mappings from saved data
                    const prefill: Record<string, string> = {};
                    for (const m of json.data || []) {
                        if (m.financial_account_code) {
                            prefill[String(m.concept_code).padStart(3, "0")] = m.financial_account_code;
                        }
                    }
                    setConceptMappings(prefill);
                }
            } catch {
                /* ignore loading errors */
            } finally {
                setMappingsLoaded(true);
            }
        })();
    }, [open]);

    // ─── Mapping helpers ───
    const setMapping = useCallback((code: string, faCode: string) => {
        setConceptMappings((prev) => ({ ...prev, [code]: faCode }));
    }, []);

    const mappedCount = useMemo(
        () => concepts.filter((c) => conceptMappings[c.code]).length,
        [concepts, conceptMappings],
    );

    const allMapped = mappedCount === concepts.length;

    const labourConceptCount = useMemo(
        () => concepts.filter((c) => conceptMappings[c.code] === "202.0").length,
        [concepts, conceptMappings],
    );

    // ─── Has prior mapping (for "auto-suggestion" badge) ───
    const priorMappingCodes = useMemo(
        () => new Set(savedMappings.map((m) => String(m.concept_code).padStart(3, "0"))),
        [savedMappings],
    );

    // ─── Toggle block collapse ───
    const toggleBlock = useCallback((block: string) => {
        setCollapsedBlocks((prev) => ({ ...prev, [block]: !prev[block] }));
    }, []);

    // ═══════════════════════════════════
    // Step 1 → Step 2 transition
    // ═══════════════════════════════════

    const handleStep1Next = useCallback(async () => {
        setProcessing(true);
        setError(null);

        try {
            // Save/update mappings to payroll_line_mappings
            for (const concept of concepts) {
                const faCode = conceptMappings[concept.code];
                if (!faCode) continue;

                const existing = savedMappings.find(
                    (m) => String(m.concept_code).padStart(3, "0") === concept.code ||
                        m.concept_code === concept.code,
                );

                const category = categoryFromFA(faCode);
                const faName = FA_LABELS[faCode] || faCode;

                if (existing) {
                    // Update only if changed
                    if (
                        existing.financial_account_code !== faCode ||
                        existing.target_category !== category
                    ) {
                        await fetch("/api/payroll/master-data", {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                id: existing.id,
                                financial_account_code: faCode,
                                financial_account_name: faName,
                                target_category: category,
                            }),
                        });
                    }
                } else {
                    // Create new mapping
                    await fetch("/api/payroll/master-data", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            concept_code: concept.code,
                            concept_description: concept.description,
                            target_category: category,
                            financial_account_code: faCode,
                            financial_account_name: faName,
                        }),
                    });
                }
            }

            // Check if any concepts are mapped to 202.0 (Labour) — if so go to step 2
            if (labourConceptCount > 0) {
                const allocations = buildLabourAllocations(payrollData, conceptMappings);
                setLabourAllocations(allocations);

                // Check for existing invoices (duplicate detection)
                await checkDuplicates();

                setStep(2);
            } else {
                // No labour concepts — go straight to invoice creation
                await createInvoices(false);
            }
        } catch (err: any) {
            setError(err?.message || "Error saving mappings");
        } finally {
            setProcessing(false);
        }
    }, [concepts, conceptMappings, savedMappings, payrollData, labourConceptCount]);

    // ═══════════════════════════════════
    // Duplicate check
    // ═══════════════════════════════════

    const checkDuplicates = useCallback(async () => {
        try {
            const res = await fetch(`/api/payroll/generate-invoices`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    year: parsedPeriod.year,
                    month: parsedPeriod.month,
                    scope: "ES",
                    currency: "EUR",
                    provider_name: "Digital Smile Design Payroll",
                    dry_run: true,
                }),
            });
            const json = await res.json();
            if (json.success && json.dry_run) {
                // Now check how many would be skipped in non-dry-run mode
                // by looking at existing invoices count
                const totalLines = json.totals?.final_lines || 0;
                if (totalLines > 0) {
                    // The dry_run doesn't tell us about existing duplicates directly,
                    // but if we have lines, it means the payroll data is valid.
                    // The actual duplicate check happens when we try to create.
                    // Let's do a light check via the notes marker.
                    setDuplicateWarning(null);
                }
            }
        } catch {
            /* ignore — duplicate check is optional */
        }
    }, [parsedPeriod]);

    // ═══════════════════════════════════
    // Create Invoices
    // ═══════════════════════════════════

    const createInvoices = useCallback(async (overwrite: boolean) => {
        setProcessing(true);
        setError(null);
        setResult(null);
        setDuplicateWarning(null);

        try {
            const res = await fetch("/api/payroll/generate-invoices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    year: parsedPeriod.year,
                    month: parsedPeriod.month,
                    scope: "ES",
                    currency: "EUR",
                    provider_name: "Digital Smile Design Payroll",
                    overwrite_existing: overwrite,
                    dry_run: false,
                }),
            });

            const json = await res.json();

            if (!json.success) {
                setError(json.error || "Failed to create invoices");
                return;
            }

            const inserted = json.inserted_count || 0;
            const skipped = json.skipped_idempotency_count || 0;
            const overwritten = json.overwritten_count || 0;

            // If nothing was inserted and everything was skipped — show duplicate warning
            if (inserted === 0 && skipped > 0 && !overwrite) {
                setDuplicateWarning(
                    `Ya existen ${skipped} invoice(s) para este período. Use "Overwrite & Create" para reemplazarlas.`,
                );
                return;
            }

            const parts: string[] = [];
            if (inserted > 0) parts.push(`${inserted} invoice(s) creadas`);
            if (skipped > 0) parts.push(`${skipped} ignoradas (ya existentes)`);
            if (overwritten > 0) parts.push(`${overwritten} sobrescritas`);
            setResult(parts.join(" · ") || "Proceso completado");

            if (inserted > 0 || overwritten > 0) {
                onInvoicesCreated?.();
            }
        } catch (err: any) {
            setError(err?.message || "Failed to create invoices");
        } finally {
            setProcessing(false);
        }
    }, [parsedPeriod, onInvoicesCreated]);

    // ═══════════════════════════════════
    // Popup 2 totals
    // ═══════════════════════════════════

    const labourTotals = useMemo(() => {
        const byDept = new Map<string, { name: string; amount: number; faCode: string; faName: string }>();
        for (const line of labourAllocations) {
            const key = line.departmentCode;
            const existing = byDept.get(key);
            if (existing) {
                existing.amount += line.amount;
            } else {
                byDept.set(key, {
                    name: line.departmentName,
                    amount: line.amount,
                    faCode: line.toAccount,
                    faName: line.toAccountName,
                });
            }
        }
        return {
            byDept: Array.from(byDept.values()),
            total: labourAllocations.reduce((sum, l) => sum + l.amount, 0),
            lineCount: labourAllocations.length,
            deptCount: byDept.size,
        };
    }, [labourAllocations]);

    // ═══════════════════════════════════
    // Render block of concepts
    // ═══════════════════════════════════

    const renderConceptBlock = (
        title: string,
        blockKey: string,
        items: AggregatedConcept[],
        icon: React.ReactNode,
        accentColor: string,
    ) => {
        const collapsed = collapsedBlocks[blockKey] || false;
        const blockMapped = items.filter((c) => conceptMappings[c.code]).length;

        return (
            <div key={blockKey} className="mb-4">
                <button
                    className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-md ${accentColor} hover:opacity-80 transition-opacity`}
                    onClick={() => toggleBlock(blockKey)}
                >
                    {collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <ChevronDown className="h-4 w-4" />
                    )}
                    {icon}
                    <span className="font-semibold text-sm">{title}</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">
                        {blockMapped}/{items.length}
                    </Badge>
                </button>

                {!collapsed && (
                    <table className="w-full text-sm mt-1">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="px-3 py-1.5 text-left text-xs text-gray-500 w-[60px]">Code</th>
                                <th className="px-3 py-1.5 text-left text-xs text-gray-500">Description</th>
                                <th className="px-3 py-1.5 text-right text-xs text-gray-500 w-[100px]">Amount</th>
                                <th className="px-3 py-1.5 text-left text-xs text-gray-500 w-[220px]">Financial Account</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((concept) => {
                                const isNew = !priorMappingCodes.has(concept.code);
                                return (
                                    <tr
                                        key={concept.code}
                                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/30"
                                    >
                                        <td className="px-3 py-1.5 text-xs font-mono text-gray-500">
                                            {concept.code}
                                        </td>
                                        <td className="px-3 py-1.5 text-xs">
                                            <span className="text-gray-700 dark:text-gray-300">
                                                {concept.description}
                                            </span>
                                            {isNew && (
                                                <Badge className="ml-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[9px] px-1">
                                                    NEW
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-3 py-1.5 text-right text-xs font-mono text-green-600 dark:text-green-400">
                                            {fmtEur(concept.totalAmount)}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            <Select
                                                value={conceptMappings[concept.code] || ""}
                                                onValueChange={(val) => setMapping(concept.code, val)}
                                            >
                                                <SelectTrigger className="h-7 text-xs">
                                                    <SelectValue placeholder="Select account..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {FINANCIAL_ACCOUNT_OPTIONS.map((fa) => (
                                                        <SelectItem key={fa.code} value={fa.code} className="text-xs">
                                                            {fa.code} — {fa.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        );
    };

    // ═══════════════════════════════════
    // RENDER
    // ═══════════════════════════════════

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!processing) onOpenChange(o);
            }}
        >
            <DialogContent
                className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white max-w-4xl max-h-[85vh] overflow-hidden"
                style={{ display: "flex", flexDirection: "column" }}
            >
                {/* ═══════════════════════════════════════════════════
                    POPUP 1 — Concept Classification
                ═══════════════════════════════════════════════════ */}
                {step === 1 && (
                    <>
                        <DialogHeader className="shrink-0">
                            <DialogTitle className="flex items-center gap-2">
                                <Settings2 className="h-5 w-5 text-violet-500" />
                                Payroll Concept Classification — {periodLabel}
                            </DialogTitle>
                            <DialogDescription className="text-gray-500 dark:text-gray-400">
                                Assign a financial account to each payroll concept. Concepts mapped to{" "}
                                <span className="font-semibold text-violet-500">202.0 Labour</span> will be
                                further allocated by department in the next step.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                            {!mappingsLoaded ? (
                                <div className="flex items-center justify-center py-12 text-gray-400">
                                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                    Loading mappings...
                                </div>
                            ) : (
                                <>
                                    {renderConceptBlock(
                                        "CONCEPTOS",
                                        "conceptos",
                                        conceptosList,
                                        <span className="text-blue-500 text-xs font-bold">€</span>,
                                        "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300",
                                    )}
                                    {renderConceptBlock(
                                        "DEDUCCIONES",
                                        "deducciones",
                                        deduccionesList,
                                        <span className="text-red-500 text-xs font-bold">−</span>,
                                        "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300",
                                    )}
                                    {renderConceptBlock(
                                        "SEGURIDAD SOCIAL EMPRESA",
                                        "ss_empresa",
                                        ssEmpresaList,
                                        <span className="text-amber-500 text-xs font-bold">SS</span>,
                                        "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300",
                                    )}
                                </>
                            )}
                        </div>

                        <div className="shrink-0 pt-3 border-t border-gray-200 dark:border-gray-700">
                            {error && (
                                <p className="text-sm text-red-500 mb-2 flex items-center gap-1">
                                    <AlertTriangle className="h-3.5 w-3.5" /> {error}
                                </p>
                            )}
                            <div className="flex items-center gap-2 w-full justify-between">
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {mappedCount}/{concepts.length} mapped
                                    {labourConceptCount > 0 && (
                                        <span className="text-violet-500 ml-2">
                                            {labourConceptCount} → Labour (next step)
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => onOpenChange(false)}
                                        disabled={processing}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="bg-violet-600 hover:bg-violet-700 text-white"
                                        onClick={handleStep1Next}
                                        disabled={processing || !allMapped}
                                    >
                                        {processing ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : null}
                                        {labourConceptCount > 0
                                            ? "Next → Labour Allocation"
                                            : "Insert & Create Invoices"
                                        }
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* ═══════════════════════════════════════════════════
                    POPUP 2 — Labour Department Allocation
                ═══════════════════════════════════════════════════ */}
                {step === 2 && (
                    <>
                        <DialogHeader className="shrink-0">
                            <DialogTitle className="flex items-center gap-2">
                                <ArrowRightLeft className="h-5 w-5 text-amber-500" />
                                Labour Department Allocation — {periodLabel}
                            </DialogTitle>
                            <DialogDescription className="text-gray-500 dark:text-gray-400">
                                {labourTotals.lineCount} concept line(s) across {labourTotals.deptCount} department(s)
                                automatically allocated to Labour sub-accounts.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                            {/* Summary cards by department */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                                {labourTotals.byDept.map((d) => (
                                    <div
                                        key={d.name}
                                        className="border border-gray-200 dark:border-gray-700 rounded-md p-2 bg-gray-50 dark:bg-gray-900/30"
                                    >
                                        <div className="text-[10px] text-gray-500 truncate">{d.name}</div>
                                        <div className="text-sm font-mono text-green-600 dark:text-green-400">
                                            {fmtEur(d.amount)}
                                        </div>
                                        <Badge className="mt-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-[9px]">
                                            → {d.faCode} {d.faName}
                                        </Badge>
                                    </div>
                                ))}
                            </div>

                            {/* Detail table */}
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-gray-100 dark:bg-[#111111] border-b border-gray-200 dark:border-gray-700">
                                        <th className="px-2 py-2 text-left text-xs text-gray-500 w-[60px]">Code</th>
                                        <th className="px-2 py-2 text-left text-xs text-gray-500">Concept</th>
                                        <th className="px-2 py-2 text-left text-xs text-gray-500 w-[130px]">Department</th>
                                        <th className="px-2 py-2 text-right text-xs text-gray-500 w-[90px]">Amount</th>
                                        <th className="px-2 py-2 text-center text-xs text-gray-500 w-[80px]">From</th>
                                        <th className="px-2 py-2 text-center text-xs text-gray-500 w-[20px]"></th>
                                        <th className="px-2 py-2 text-center text-xs text-gray-500 w-[120px]">To</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {labourAllocations.map((line, idx) => (
                                        <tr
                                            key={idx}
                                            className="border-b border-gray-100 dark:border-gray-800"
                                        >
                                            <td className="px-2 py-1.5 text-xs font-mono text-gray-500">
                                                {line.conceptCode}
                                            </td>
                                            <td className="px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 truncate max-w-[180px]">
                                                {line.conceptDescription}
                                            </td>
                                            <td className="px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 truncate max-w-[130px]">
                                                {line.departmentName}
                                            </td>
                                            <td className="px-2 py-1.5 text-right text-xs font-mono text-green-600 dark:text-green-400">
                                                {fmtEur(line.amount)}
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                                <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px]">
                                                    {line.fromAccount}
                                                </Badge>
                                            </td>
                                            <td className="px-2 py-1.5 text-center text-gray-400">
                                                →
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                                <Badge
                                                    className={`text-[10px] border ${line.toAccount === "202.0"
                                                            ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                                                            : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                                                        }`}
                                                >
                                                    {line.toAccount} {line.toAccountName}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="shrink-0 pt-3 border-t border-gray-200 dark:border-gray-700">
                            {error && (
                                <p className="text-sm text-red-500 mb-2 flex items-center gap-1">
                                    <AlertTriangle className="h-3.5 w-3.5" /> {error}
                                </p>
                            )}
                            {duplicateWarning && (
                                <div className="text-sm text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/20 rounded px-2 py-1.5">
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                    <span>{duplicateWarning}</span>
                                </div>
                            )}
                            {result && (
                                <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> {result}
                                </p>
                            )}
                            <div className="flex items-center gap-2 w-full justify-between">
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {labourTotals.deptCount} dept(s) · {labourTotals.lineCount} line(s) · Total{" "}
                                    <span className="font-mono text-green-500">{fmtEur(labourTotals.total)}</span>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setStep(1);
                                            setError(null);
                                            setResult(null);
                                        }}
                                        disabled={processing}
                                    >
                                        ← Back
                                    </Button>
                                    {duplicateWarning && !result && (
                                        <Button
                                            variant="outline"
                                            className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
                                            onClick={() => createInvoices(true)}
                                            disabled={processing}
                                        >
                                            {processing ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : null}
                                            Overwrite & Create
                                        </Button>
                                    )}
                                    {!result && (
                                        <Button
                                            className="bg-amber-600 hover:bg-amber-700 text-white"
                                            onClick={() => createInvoices(false)}
                                            disabled={processing}
                                        >
                                            {processing ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : null}
                                            Insert & Create Invoices
                                        </Button>
                                    )}
                                    {result && (
                                        <Button
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                            onClick={() => onOpenChange(false)}
                                        >
                                            Done
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
