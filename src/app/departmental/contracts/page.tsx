"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Filter, Link2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";

interface ContractRow {
    id: string;
    contract_code?: string | null;
    name: string;
    provider_name: string | null;
    contract_type: string | null;
    department_code: string | null;
    sub_department_code: string | null;
    monthly_amount: number | null;
    annual_amount: number | null;
    start_date: string | null;
    end_date: string | null;
    duration_months?: number | null;
    admin_fee_percent?: number | null;
    currency_code?: string | null;
    monthly_retainer_amount?: number | null;
    annual_estimated_amount?: number | null;
    submitted_to?: string | null;
    submitted_by?: string | null;
    location?: string | null;
    summary?: string | null;
    service_scope?: string | null;
    source_document_filename?: string | null;
    key_terms?: Record<string, any> | null;
    status: string | null;
    document_url: string | null;
    scope: string | null;
    is_active: boolean | null;
}

interface ContractParty {
    role: string;
    name: string;
    entity_type?: string | null;
    tax_id?: string | null;
    country?: string | null;
    email?: string | null;
    is_primary?: boolean | null;
}

interface ContractLineItem {
    item_order?: number | null;
    code?: string | null;
    category?: string | null;
    name: string;
    monthly_amount?: number | null;
    annual_amount?: number | null;
    allocation_percent?: number | null;
    notes?: string | null;
}

interface MasterRow {
    code: string;
    name: string;
    parent_department_code?: string | null;
}

const formatCurrency = (value: number | null | undefined) => {
    if (!value || Number.isNaN(value)) return "—";
    return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
};

export default function DepartmentalContractsPage() {
    const [contracts, setContracts] = useState<ContractRow[]>([]);
    const [departments, setDepartments] = useState<MasterRow[]>([]);
    const [subDepartments, setSubDepartments] = useState<MasterRow[]>([]);
    const [selectedDept, setSelectedDept] = useState<string>("all");
    const [selectedSubDept, setSelectedSubDept] = useState<string>("all");
    const [amountMode, setAmountMode] = useState<"monthly" | "annual">("monthly");
    const [partiesByContract, setPartiesByContract] = useState<Record<string, ContractParty[]>>({});
    const [lineItemsByContract, setLineItemsByContract] = useState<Record<string, ContractLineItem[]>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch("/api/contracts/list", { cache: "no-store" });
                const json = await response.json();

                if (!json.success) {
                    throw new Error(json.error || "Falha ao carregar contratos");
                }

                setContracts((json.contracts || []) as ContractRow[]);
                setDepartments((json.departments || []) as MasterRow[]);
                setSubDepartments((json.subDepartments || []) as MasterRow[]);
                setPartiesByContract((json.partiesByContract || {}) as Record<string, ContractParty[]>);
                setLineItemsByContract((json.lineItemsByContract || {}) as Record<string, ContractLineItem[]>);

                if (json.usingFallback && json.warning) {
                    setError(json.warning);
                }
            } catch (err: any) {
                setError(err?.message || "Falha ao carregar contratos");
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, []);

    const departmentNameMap = useMemo(
        () => new Map(departments.map((d) => [d.code, d.name])),
        [departments],
    );

    const subDepartmentNameMap = useMemo(
        () => new Map(subDepartments.map((sd) => [sd.code, sd.name])),
        [subDepartments],
    );

    const subDepartmentsForSelectedDept = useMemo(() => {
        if (selectedDept === "all") return subDepartments;
        return subDepartments.filter((sd) => sd.parent_department_code === selectedDept);
    }, [selectedDept, subDepartments]);

    const filteredContracts = useMemo(() => {
        return contracts.filter((contract) => {
            if (selectedDept !== "all" && contract.department_code !== selectedDept) return false;
            if (selectedSubDept !== "all" && contract.sub_department_code !== selectedSubDept) return false;
            return true;
        });
    }, [contracts, selectedDept, selectedSubDept]);

    const totalAmount = useMemo(() => {
        if (amountMode === "monthly") {
            return filteredContracts.reduce((sum, contract) => sum + (contract.monthly_amount || 0), 0);
        }
        return filteredContracts.reduce((sum, contract) => sum + (contract.annual_amount || 0), 0);
    }, [filteredContracts, amountMode]);

    if (loading) {
        return (
            <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white p-6 space-y-6">
            <PageHeader title="Contracts" subtitle="Visão por departamento e sub-departamento com base nos contratos ativos.">
                <div className="flex items-center gap-2">
                    <Button
                        variant={amountMode === "monthly" ? "default" : "outline"}
                        onClick={() => setAmountMode("monthly")}
                        className={amountMode === "monthly" ? "bg-blue-600 text-white" : ""}
                    >
                        Mensal
                    </Button>
                    <Button
                        variant={amountMode === "annual" ? "default" : "outline"}
                        onClick={() => setAmountMode("annual")}
                        className={amountMode === "annual" ? "bg-blue-600 text-white" : ""}
                    >
                        Anual
                    </Button>
                </div>
            </PageHeader>

            <Card className="border-gray-200 dark:border-gray-700 bg-white dark:bg-black">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Filtros
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Departamento</p>
                            <Select
                                value={selectedDept}
                                onValueChange={(val) => {
                                    setSelectedDept(val);
                                    setSelectedSubDept("all");
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    {departments.map((dept) => (
                                        <SelectItem key={dept.code} value={dept.code}>
                                            {dept.code} - {dept.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Sub-departamento</p>
                            <Select value={selectedSubDept} onValueChange={setSelectedSubDept}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    {subDepartmentsForSelectedDept.map((sd) => (
                                        <SelectItem key={sd.code} value={sd.code}>
                                            {sd.code} - {sd.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2">
                            <p className="text-xs text-gray-500">Total ({amountMode === "monthly" ? "Mensal" : "Anual"})</p>
                            <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(totalAmount)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {error && (
                <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
                    <CardContent className="py-3 text-sm text-red-600 dark:text-red-400">{error}</CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filteredContracts.length === 0 ? (
                    <Card className="border-gray-200 dark:border-gray-700 bg-white dark:bg-black xl:col-span-2">
                        <CardContent className="py-10 text-center text-sm text-gray-500">
                            Nenhum contrato encontrado para os filtros selecionados.
                        </CardContent>
                    </Card>
                ) : (
                    filteredContracts.map((contract) => {
                        const amount = amountMode === "monthly" ? contract.monthly_amount : contract.annual_amount;
                        const detailedMonthly = contract.monthly_retainer_amount || amount;
                        const detailedAnnual = contract.annual_estimated_amount || contract.annual_amount;
                        const departmentLabel = contract.department_code
                            ? `${contract.department_code} - ${departmentNameMap.get(contract.department_code) || contract.department_code}`
                            : "Não definido";
                        const subDepartmentLabel = contract.sub_department_code
                            ? `${contract.sub_department_code} - ${subDepartmentNameMap.get(contract.sub_department_code) || contract.sub_department_code}`
                            : "Não definido";
                        const parties = partiesByContract[contract.id] || [];
                        const lineItems = lineItemsByContract[contract.id] || [];

                        return (
                            <Card key={contract.id} className="border-gray-200 dark:border-gray-700 bg-white dark:bg-black">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <CardTitle className="text-base leading-tight">{contract.name}</CardTitle>
                                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                                            {contract.status || "active"}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Resumo</p>
                                        <p className="text-sm text-gray-800 dark:text-gray-200">{contract.summary || "—"}</p>
                                    </div>

                                    <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
                                        <table className="w-full text-xs">
                                            <tbody>
                                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                                    <td className="px-2 py-1.5 bg-gray-50 dark:bg-[#0a0a0a] text-gray-500">Contract Code</td>
                                                    <td className="px-2 py-1.5">{contract.contract_code || "—"}</td>
                                                    <td className="px-2 py-1.5 bg-gray-50 dark:bg-[#0a0a0a] text-gray-500">Type</td>
                                                    <td className="px-2 py-1.5">{contract.contract_type || "—"}</td>
                                                </tr>
                                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                                    <td className="px-2 py-1.5 bg-gray-50 dark:bg-[#0a0a0a] text-gray-500">Submitted To</td>
                                                    <td className="px-2 py-1.5">{contract.submitted_to || "—"}</td>
                                                    <td className="px-2 py-1.5 bg-gray-50 dark:bg-[#0a0a0a] text-gray-500">Submitted By</td>
                                                    <td className="px-2 py-1.5">{contract.submitted_by || "—"}</td>
                                                </tr>
                                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                                    <td className="px-2 py-1.5 bg-gray-50 dark:bg-[#0a0a0a] text-gray-500">Location</td>
                                                    <td className="px-2 py-1.5">{contract.location || "—"}</td>
                                                    <td className="px-2 py-1.5 bg-gray-50 dark:bg-[#0a0a0a] text-gray-500">Scope</td>
                                                    <td className="px-2 py-1.5">{contract.scope || "—"}</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-2 py-1.5 bg-gray-50 dark:bg-[#0a0a0a] text-gray-500">Duration</td>
                                                    <td className="px-2 py-1.5">{contract.duration_months ? `${contract.duration_months} meses` : "—"}</td>
                                                    <td className="px-2 py-1.5 bg-gray-50 dark:bg-[#0a0a0a] text-gray-500">Admin Fee</td>
                                                    <td className="px-2 py-1.5">{contract.admin_fee_percent != null ? `${contract.admin_fee_percent}%` : "—"}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-xs text-gray-500">Departamento</p>
                                            <p className="font-medium">{departmentLabel}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Sub-departamento</p>
                                            <p className="font-medium">{subDepartmentLabel}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-xs text-gray-500">Valor {amountMode === "monthly" ? "mensal" : "anual"}</p>
                                            <p className="font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(amountMode === "monthly" ? detailedMonthly : detailedAnnual)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Provider</p>
                                            <p className="font-medium">{contract.provider_name || "—"}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-xs text-gray-500">Início</p>
                                            <p className="font-medium">{contract.start_date || "—"}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Fim</p>
                                            <p className="font-medium">{contract.end_date || "—"}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Escopo de Serviço</p>
                                        <p className="text-sm text-gray-800 dark:text-gray-200">{contract.service_scope || "—"}</p>
                                    </div>

                                    <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
                                        <div className="px-2 py-1.5 text-xs font-medium border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0a0a0a]">Partes do Contrato</div>
                                        <table className="w-full text-xs">
                                            <thead className="bg-gray-50 dark:bg-[#0a0a0a]">
                                                <tr>
                                                    <th className="text-left px-2 py-1.5">Role</th>
                                                    <th className="text-left px-2 py-1.5">Name</th>
                                                    <th className="text-left px-2 py-1.5">Type</th>
                                                    <th className="text-left px-2 py-1.5">Country</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {parties.length === 0 ? (
                                                    <tr><td className="px-2 py-2 text-gray-500" colSpan={4}>Sem partes cadastradas</td></tr>
                                                ) : parties.map((party, index) => (
                                                    <tr key={`${party.role}-${party.name}-${index}`} className="border-t border-gray-200 dark:border-gray-700">
                                                        <td className="px-2 py-1.5">{party.role || "—"}</td>
                                                        <td className="px-2 py-1.5">{party.name || "—"}</td>
                                                        <td className="px-2 py-1.5">{party.entity_type || "—"}</td>
                                                        <td className="px-2 py-1.5">{party.country || "—"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
                                        <div className="px-2 py-1.5 text-xs font-medium border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0a0a0a]">Itens de Custo</div>
                                        <table className="w-full text-xs">
                                            <thead className="bg-gray-50 dark:bg-[#0a0a0a]">
                                                <tr>
                                                    <th className="text-left px-2 py-1.5">Code</th>
                                                    <th className="text-left px-2 py-1.5">Category</th>
                                                    <th className="text-left px-2 py-1.5">Item</th>
                                                    <th className="text-right px-2 py-1.5">Monthly</th>
                                                    <th className="text-right px-2 py-1.5">Annual</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {lineItems.length === 0 ? (
                                                    <tr><td className="px-2 py-2 text-gray-500" colSpan={5}>Sem itens cadastrados</td></tr>
                                                ) : lineItems.map((item, index) => (
                                                    <tr key={`${item.code || "item"}-${index}`} className="border-t border-gray-200 dark:border-gray-700">
                                                        <td className="px-2 py-1.5">{item.code || "—"}</td>
                                                        <td className="px-2 py-1.5">{item.category || "—"}</td>
                                                        <td className="px-2 py-1.5">{item.name || "—"}</td>
                                                        <td className="px-2 py-1.5 text-right">{formatCurrency(item.monthly_amount || 0)}</td>
                                                        <td className="px-2 py-1.5 text-right">{formatCurrency(item.annual_amount || 0)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {contract.document_url ? (
                                        <a
                                            href={contract.document_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
                                        >
                                            <Link2 className="h-4 w-4" />
                                            Abrir contrato
                                        </a>
                                    ) : (
                                        <p className="text-xs text-gray-500">Sem anexo de PDF</p>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}
