"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Settings2,
    Plus,
    Pencil,
    Trash2,
    Loader2,
    Search,
    FileText,
    DollarSign,
    Building2,
    Briefcase,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────
type TargetCategory = "cogs" | "labour" | "office-rh-spain";

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

const CATEGORY_CONFIG: Record<TargetCategory, { label: string; emoji: string; color: string; badge: string }> = {
    cogs: { label: "COGS", emoji: "📦", color: "text-red-600 dark:text-red-400", badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" },
    labour: { label: "Labour", emoji: "👷", color: "text-blue-600 dark:text-blue-400", badge: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" },
    "office-rh-spain": { label: "Office RH Spain", emoji: "🇪🇸", color: "text-amber-600 dark:text-amber-400", badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" },
};

const EMPTY_FORM = {
    concept_code: "",
    concept_description: "",
    target_category: "labour" as TargetCategory,
    department_override: "",
    financial_account_code: "",
    financial_account_name: "",
    notes: "",
};

export default function PayrollMasterDataPage() {
    const [mappings, setMappings] = useState<PayrollMapping[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [search, setSearch] = useState("");
    const [catFilter, setCatFilter] = useState<string>("all");
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const loadMappings = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/payroll/master-data");
            const json = await res.json();
            if (json.success) setMappings(json.data || []);
        } catch (err) {
            console.error("Failed to load mappings:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadMappings();
    }, [loadMappings]);

    const filtered = mappings.filter((m) => {
        if (catFilter !== "all" && m.target_category !== catFilter) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            m.concept_code.toLowerCase().includes(q) ||
            (m.concept_description?.toLowerCase().includes(q)) ||
            (m.financial_account_name?.toLowerCase().includes(q)) ||
            (m.department_override?.toLowerCase().includes(q))
        );
    });

    const openAdd = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setDialogOpen(true);
    };

    const openEdit = (m: PayrollMapping) => {
        setEditingId(m.id);
        setForm({
            concept_code: m.concept_code,
            concept_description: m.concept_description || "",
            target_category: m.target_category,
            department_override: m.department_override || "",
            financial_account_code: m.financial_account_code || "",
            financial_account_name: m.financial_account_name || "",
            notes: m.notes || "",
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.concept_code || !form.target_category) return;
        setSaving(true);
        try {
            const payload = {
                concept_code: form.concept_code,
                concept_description: form.concept_description || null,
                target_category: form.target_category,
                department_override: form.department_override || null,
                financial_account_code: form.financial_account_code || null,
                financial_account_name: form.financial_account_name || null,
                notes: form.notes || null,
            };

            if (editingId) {
                const res = await fetch("/api/payroll/master-data", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: editingId, ...payload }),
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                toast({ title: "Mapping updated" });
            } else {
                const res = await fetch("/api/payroll/master-data", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                toast({ title: "Mapping created" });
            }
            setDialogOpen(false);
            loadMappings();
        } catch (err) {
            toast({ title: "Error saving mapping", description: String(err), variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/payroll/master-data?id=${id}`, { method: "DELETE" });
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            toast({ title: "Mapping deleted" });
            setDeleteConfirm(null);
            loadMappings();
        } catch (err) {
            toast({ title: "Error deleting", description: String(err), variant: "destructive" });
        }
    };

    // KPIs
    const total = mappings.length;
    const cogsCt = mappings.filter((m) => m.target_category === "cogs").length;
    const labourCt = mappings.filter((m) => m.target_category === "labour").length;
    const officeCt = mappings.filter((m) => m.target_category === "office-rh-spain").length;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black p-4 md:p-6 lg:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Settings2 className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Payroll Master Data
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Map payroll concept codes to financial categories (COGS, Labour, Office RH Spain)
                        </p>
                    </div>
                </div>
                <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={openAdd}
                >
                    <Plus className="h-4 w-4 mr-1" />
                    New Mapping
                </Button>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KPICard label="Total Mappings" value={total} icon={<FileText className="h-5 w-5 text-gray-500" />} />
                <KPICard label="COGS" value={cogsCt} icon={<DollarSign className="h-5 w-5 text-red-500" />} />
                <KPICard label="Labour" value={labourCt} icon={<Briefcase className="h-5 w-5 text-blue-500" />} />
                <KPICard label="Office RH Spain" value={officeCt} icon={<Building2 className="h-5 w-5 text-amber-500" />} />
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search concept code, description..."
                        className="pl-9 bg-transparent border-gray-300 dark:border-gray-600"
                    />
                </div>
                <div className="flex items-center gap-1">
                    {["all", "cogs", "labour", "office-rh-spain"].map((c) => {
                        const lbl = c === "all" ? "All" : (CATEGORY_CONFIG[c as TargetCategory]?.label || c);
                        return (
                            <Button
                                key={c}
                                variant={catFilter === c ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCatFilter(c)}
                                className={catFilter === c ? "bg-blue-600 text-white" : "dark:border-gray-600 dark:text-gray-400"}
                            >
                                {lbl}
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
            ) : filtered.length === 0 ? (
                <Card className="dark:bg-[#0a0a0a] dark:border-gray-700">
                    <CardContent className="py-16 text-center text-gray-500 dark:text-gray-400">
                        <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-medium mb-1">No mappings found</p>
                        <p className="text-sm">Create a mapping to associate payroll concept codes with financial lines</p>
                    </CardContent>
                </Card>
            ) : (
                <Card className="dark:bg-[#0a0a0a] dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#111111]">
                                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Code</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Description</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Category</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Department Override</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Financial Account</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Notes</th>
                                    <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((m) => {
                                    const cfg = CATEGORY_CONFIG[m.target_category] || CATEGORY_CONFIG.labour;
                                    return (
                                        <tr key={m.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#111111]">
                                            <td className="py-3 px-4 font-mono font-medium text-gray-900 dark:text-white">
                                                {m.concept_code}
                                            </td>
                                            <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                                                {m.concept_description || <span className="text-gray-400">—</span>}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                                                    {cfg.emoji} {cfg.label}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                                                {m.department_override || <span className="text-gray-400">—</span>}
                                            </td>
                                            <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                                                {m.financial_account_code || m.financial_account_name ? (
                                                    <span>
                                                        {m.financial_account_code && <span className="font-mono text-xs">{m.financial_account_code}</span>}
                                                        {m.financial_account_code && m.financial_account_name && " — "}
                                                        {m.financial_account_name}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-xs truncate max-w-[160px]">
                                                {m.notes || "—"}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Button variant="ghost" size="sm" onClick={() => openEdit(m)} className="h-7 w-7 p-0">
                                                        <Pencil className="h-3.5 w-3.5 text-gray-500" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setDeleteConfirm(m.id)}
                                                        className="h-7 w-7 p-0 hover:text-red-600"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 text-gray-500" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Settings2 className="h-5 w-5 text-blue-500" />
                            {editingId ? "Edit Mapping" : "New Payroll Mapping"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs text-gray-500">Concept Code *</Label>
                                <Input
                                    value={form.concept_code}
                                    onChange={(e) => setForm((p) => ({ ...p, concept_code: e.target.value }))}
                                    placeholder="e.g. 001, MV01"
                                    className="bg-transparent border-gray-300 dark:border-gray-600 font-mono"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-gray-500">Category *</Label>
                                <select
                                    value={form.target_category}
                                    onChange={(e) => setForm((p) => ({ ...p, target_category: e.target.value as TargetCategory }))}
                                    className="w-full h-9 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-transparent text-sm"
                                >
                                    {(Object.keys(CATEGORY_CONFIG) as TargetCategory[]).map((c) => (
                                        <option key={c} value={c}>
                                            {CATEGORY_CONFIG[c].emoji} {CATEGORY_CONFIG[c].label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs text-gray-500">Concept Description</Label>
                            <Input
                                value={form.concept_description}
                                onChange={(e) => setForm((p) => ({ ...p, concept_description: e.target.value }))}
                                placeholder="e.g. Mejora Voluntaria, Salario Base"
                                className="bg-transparent border-gray-300 dark:border-gray-600"
                            />
                        </div>
                        <div>
                            <Label className="text-xs text-gray-500">Department Override</Label>
                            <Input
                                value={form.department_override}
                                onChange={(e) => setForm((p) => ({ ...p, department_override: e.target.value }))}
                                placeholder="e.g. Development, Sales, Marketing"
                                className="bg-transparent border-gray-300 dark:border-gray-600"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs text-gray-500">Financial Account Code</Label>
                                <Input
                                    value={form.financial_account_code}
                                    onChange={(e) => setForm((p) => ({ ...p, financial_account_code: e.target.value }))}
                                    placeholder="e.g. 6400, 6410"
                                    className="bg-transparent border-gray-300 dark:border-gray-600 font-mono"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-gray-500">Financial Account Name</Label>
                                <Input
                                    value={form.financial_account_name}
                                    onChange={(e) => setForm((p) => ({ ...p, financial_account_name: e.target.value }))}
                                    placeholder="e.g. Sueldos y Salarios"
                                    className="bg-transparent border-gray-300 dark:border-gray-600"
                                />
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs text-gray-500">Notes</Label>
                            <Input
                                value={form.notes}
                                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                                placeholder="Additional notes"
                                className="bg-transparent border-gray-300 dark:border-gray-600"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={handleSave}
                            disabled={!form.concept_code || !form.target_category || saving}
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                            {editingId ? "Save Changes" : "Create Mapping"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirm */}
            <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <DialogContent className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Delete Mapping</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        This will permanently delete this payroll mapping. Continue?
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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
