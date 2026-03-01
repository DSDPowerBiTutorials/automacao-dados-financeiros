"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Settings2,
    Loader2,
    Search,
    FileText,
    TrendingUp,
    TrendingDown,
    CheckCircle2,
    AlertCircle,
    Pencil,
    Save,
    X,
    RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";

// ── Types ──────────────────────────────────────────────────────────────────
type TargetCategory = "cogs" | "labour" | "office-rh-spain";

interface PayrollConcept {
    code: number;
    description: string;
    isDeduction: boolean;
    monthsPresent: string[];
    totalAmount: number;
    employeeCount: number;
}

interface PayrollMapping {
    id: string;
    concept_code: string;
    concept_description: string | null;
    target_category: TargetCategory;
    department_override: string | null;
    financial_account_code: string | null;
    financial_account_name: string | null;
    notes: string | null;
    created_at: string;
}

const CATEGORY_CONFIG: Record<TargetCategory, { label: string; emoji: string; badge: string }> = {
    cogs: { label: "COGS", emoji: "📦", badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-800" },
    labour: { label: "Labour", emoji: "👷", badge: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
    "office-rh-spain": { label: "Office RH Spain", emoji: "🏢", badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
};

export default function PayrollMasterDataPage() {
    const [concepts, setConcepts] = useState<PayrollConcept[]>([]);
    const [mappings, setMappings] = useState<PayrollMapping[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "mapped" | "unmapped" | "earnings" | "deductions">("all");

    // Inline editing state
    const [editingCode, setEditingCode] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({
        target_category: "labour" as TargetCategory,
        financial_account_code: "",
        financial_account_name: "",
        notes: "",
    });
    const [editSaving, setEditSaving] = useState(false);

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const [conceptsRes, mappingsRes] = await Promise.all([
                fetch("/api/payroll/concepts"),
                fetch("/api/payroll/master-data"),
            ]);
            const conceptsJson = await conceptsRes.json();
            const mappingsJson = await mappingsRes.json();
            if (conceptsJson.success) setConcepts(conceptsJson.data || []);
            if (mappingsJson.success) setMappings(mappingsJson.data || []);
        } catch (err) {
            console.error("Failed to load:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    // Build mapping lookup by concept_code
    const mappingByCode = new Map<string, PayrollMapping>();
    mappings.forEach((m) => mappingByCode.set(m.concept_code, m));

    // Merged data: concepts from payroll + their mapping status
    const merged = concepts.map((c) => {
        const code = String(c.code).padStart(3, "0");
        const mapping = mappingByCode.get(code);
        return { ...c, codeStr: code, mapping };
    });

    // Filter
    const filtered = merged.filter((c) => {
        if (filter === "mapped" && !c.mapping) return false;
        if (filter === "unmapped" && c.mapping) return false;
        if (filter === "earnings" && c.isDeduction) return false;
        if (filter === "deductions" && !c.isDeduction) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            c.codeStr.includes(q) ||
            c.description.toLowerCase().includes(q) ||
            (c.mapping?.financial_account_name?.toLowerCase().includes(q)) ||
            (c.mapping?.target_category?.toLowerCase().includes(q))
        );
    });

    // KPIs
    const totalConcepts = concepts.length;
    const mappedCount = merged.filter((c) => c.mapping).length;
    const unmappedCount = totalConcepts - mappedCount;
    const earningsCount = concepts.filter((c) => !c.isDeduction).length;
    const deductionsCount = concepts.filter((c) => c.isDeduction).length;

    // Sync all unmapped concepts
    const syncConcepts = async () => {
        setSyncing(true);
        try {
            const res = await fetch("/api/payroll/concepts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ concepts }),
            });
            const json = await res.json();
            if (json.success) {
                toast({ title: `${json.inserted || 0} new concepts synced` });
                loadAll();
            } else {
                throw new Error(json.error);
            }
        } catch (err) {
            toast({ title: "Sync failed", description: String(err), variant: "destructive" });
        } finally {
            setSyncing(false);
        }
    };

    // Start editing a mapping
    const startEdit = (codeStr: string, mapping: PayrollMapping | undefined) => {
        setEditingCode(codeStr);
        setEditForm({
            target_category: mapping?.target_category || "labour",
            financial_account_code: mapping?.financial_account_code || "",
            financial_account_name: mapping?.financial_account_name || "",
            notes: mapping?.notes || "",
        });
    };

    const cancelEdit = () => setEditingCode(null);

    const saveEdit = async (codeStr: string, concept: PayrollConcept, existingMapping: PayrollMapping | undefined) => {
        setEditSaving(true);
        try {
            if (existingMapping) {
                const res = await fetch("/api/payroll/master-data", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: existingMapping.id,
                        target_category: editForm.target_category,
                        financial_account_code: editForm.financial_account_code || null,
                        financial_account_name: editForm.financial_account_name || null,
                        notes: editForm.notes || null,
                    }),
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                toast({ title: `Updated ${codeStr}` });
            } else {
                const res = await fetch("/api/payroll/master-data", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        concept_code: codeStr,
                        concept_description: concept.description,
                        target_category: editForm.target_category,
                        financial_account_code: editForm.financial_account_code || null,
                        financial_account_name: editForm.financial_account_name || null,
                        notes: editForm.notes || null,
                    }),
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                toast({ title: `Mapped ${codeStr}` });
            }
            setEditingCode(null);
            loadAll();
        } catch (err) {
            toast({ title: "Error saving", description: String(err), variant: "destructive" });
        } finally {
            setEditSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black p-4 md:p-6 lg:p-8 space-y-6">
            {/* Header */}
            <PageHeader title="Payroll Concepts" subtitle="All payroll concepts extracted from uploads — map each to an AP category">
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={loadAll}
                        disabled={loading}
                        className="dark:border-gray-600 dark:text-gray-300"
                    >
                        <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={syncConcepts}
                        disabled={syncing || unmappedCount === 0}
                    >
                        {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                        Sync All ({unmappedCount} unmapped)
                    </Button>
                </div>
            </PageHeader>

            {/* KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <KPICard label="Total Concepts" value={totalConcepts} icon={<FileText className="h-5 w-5 text-gray-500" />} />
                <KPICard label="Mapped" value={mappedCount} icon={<CheckCircle2 className="h-5 w-5 text-green-500" />} />
                <KPICard label="Unmapped" value={unmappedCount} icon={<AlertCircle className="h-5 w-5 text-orange-500" />} />
                <KPICard label="Earnings" value={earningsCount} icon={<TrendingUp className="h-5 w-5 text-green-500" />} />
                <KPICard label="Deductions" value={deductionsCount} icon={<TrendingDown className="h-5 w-5 text-red-500" />} />
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search code, description, account..."
                        className="pl-9 bg-transparent border-gray-300 dark:border-gray-600"
                    />
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                    {(["all", "mapped", "unmapped", "earnings", "deductions"] as const).map((f) => {
                        const labels: Record<string, string> = { all: "All", mapped: "Mapped", unmapped: "Unmapped", earnings: "Earnings", deductions: "Deductions" };
                        return (
                            <Button
                                key={f}
                                variant={filter === f ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFilter(f)}
                                className={filter === f ? "bg-blue-600 text-white" : "dark:border-gray-600 dark:text-gray-400"}
                            >
                                {labels[f]}
                            </Button>
                        );
                    })}
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
            ) : concepts.length === 0 ? (
                <Card className="dark:bg-[#0a0a0a] dark:border-gray-700">
                    <CardContent className="py-16 text-center text-gray-500 dark:text-gray-400">
                        <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-medium mb-1">No payroll concepts found</p>
                        <p className="text-sm">Upload payroll XLSX files first to extract concepts automatically</p>
                    </CardContent>
                </Card>
            ) : (
                <Card className="dark:bg-[#0a0a0a] dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#111111]">
                                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400 w-12">Status</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400 w-16">Code</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Description</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400 w-14">Type</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400 w-32">AP Category</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400 w-40">Financial Account</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400 w-32">Notes</th>
                                    <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-400 w-20">Months</th>
                                    <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400 w-16">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((c) => {
                                    const isEditing = editingCode === c.codeStr;
                                    const cat = c.mapping?.target_category;
                                    const catCfg = cat ? CATEGORY_CONFIG[cat] : null;

                                    return (
                                        <tr
                                            key={c.codeStr + (c.isDeduction ? "-D" : "-E")}
                                            className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors ${!c.mapping ? "bg-orange-50/50 dark:bg-orange-950/10" : ""}`}
                                        >
                                            <td className="py-2.5 px-4">
                                                {c.mapping ? (
                                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                ) : (
                                                    <AlertCircle className="h-4 w-4 text-orange-400" />
                                                )}
                                            </td>

                                            <td className="py-2.5 px-4 font-mono font-medium text-gray-900 dark:text-white">
                                                {c.codeStr}
                                            </td>

                                            <td className="py-2.5 px-4 text-gray-700 dark:text-gray-300">
                                                {c.description}
                                            </td>

                                            <td className="py-2.5 px-4">
                                                {c.isDeduction ? (
                                                    <Badge className="bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-800 text-[10px]">
                                                        DED
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400 border-green-200 dark:border-green-800 text-[10px]">
                                                        EARN
                                                    </Badge>
                                                )}
                                            </td>

                                            <td className="py-2.5 px-4">
                                                {isEditing ? (
                                                    <select
                                                        value={editForm.target_category}
                                                        onChange={(e) => setEditForm((p) => ({ ...p, target_category: e.target.value as TargetCategory }))}
                                                        className="w-full h-8 px-2 rounded border border-blue-400 dark:border-blue-600 bg-white dark:bg-[#0a0a0a] text-xs"
                                                    >
                                                        {(Object.keys(CATEGORY_CONFIG) as TargetCategory[]).map((k) => (
                                                            <option key={k} value={k}>
                                                                {CATEGORY_CONFIG[k].emoji} {CATEGORY_CONFIG[k].label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : catCfg ? (
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${catCfg.badge}`}>
                                                        {catCfg.emoji} {catCfg.label}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 text-xs italic">— not set —</span>
                                                )}
                                            </td>

                                            <td className="py-2.5 px-4">
                                                {isEditing ? (
                                                    <div className="flex gap-1">
                                                        <Input
                                                            value={editForm.financial_account_code}
                                                            onChange={(e) => setEditForm((p) => ({ ...p, financial_account_code: e.target.value }))}
                                                            placeholder="Code"
                                                            className="h-8 text-xs font-mono w-16 bg-transparent border-blue-400 dark:border-blue-600"
                                                        />
                                                        <Input
                                                            value={editForm.financial_account_name}
                                                            onChange={(e) => setEditForm((p) => ({ ...p, financial_account_name: e.target.value }))}
                                                            placeholder="Account name"
                                                            className="h-8 text-xs bg-transparent border-blue-400 dark:border-blue-600"
                                                        />
                                                    </div>
                                                ) : c.mapping?.financial_account_code || c.mapping?.financial_account_name ? (
                                                    <span className="text-xs">
                                                        {c.mapping.financial_account_code && (
                                                            <span className="font-mono text-gray-500 mr-1">{c.mapping.financial_account_code}</span>
                                                        )}
                                                        {c.mapping.financial_account_name && (
                                                            <span className="text-gray-700 dark:text-gray-300">{c.mapping.financial_account_name}</span>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300 dark:text-gray-700">—</span>
                                                )}
                                            </td>

                                            <td className="py-2.5 px-4">
                                                {isEditing ? (
                                                    <Input
                                                        value={editForm.notes}
                                                        onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                                                        placeholder="Notes"
                                                        className="h-8 text-xs bg-transparent border-blue-400 dark:border-blue-600"
                                                    />
                                                ) : (
                                                    <span className="text-xs text-gray-500 truncate block max-w-[120px]">
                                                        {c.mapping?.notes || "—"}
                                                    </span>
                                                )}
                                            </td>

                                            <td className="text-right py-2.5 px-4">
                                                <span className="text-xs font-mono text-gray-500">
                                                    {c.monthsPresent.length}
                                                </span>
                                            </td>

                                            <td className="text-center py-2.5 px-4">
                                                {isEditing ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                                                            onClick={() => saveEdit(c.codeStr, c, c.mapping)}
                                                            disabled={editSaving}
                                                        >
                                                            {editSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 text-gray-500"
                                                            onClick={cancelEdit}
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0"
                                                        onClick={() => startEdit(c.codeStr, c.mapping)}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5 text-gray-500" />
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}

// ── KPI Card ───────────────────────────────────────────────────────────────
function KPICard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
    return (
        <Card className="dark:bg-[#0a0a0a] dark:border-gray-700">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
                {icon}
                <span className="text-xl font-bold text-gray-900 dark:text-white">{value}</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">{label}</span>
            </CardContent>
        </Card>
    );
}
