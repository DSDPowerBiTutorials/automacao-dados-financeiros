"use client";

import React, { useState, useEffect } from "react";
import { Package, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface Product {
    id: string;
    code: string;
    name: string;
    description: string | null;
    default_price: number | null;
    currency: string;
    financial_account_id: string | null;
    financial_account_code: string | null;
    departmental_account_group_id: string | null;
    departmental_account_subgroup_id: string | null;
    category: string | null;
    product_type: string;
    scope: string;
    is_active: boolean;
    alternative_names: string[];
}

interface FinancialAccount {
    id: string;
    code: string;
    name: string;
    scope: string;
}

interface DepartmentalAccount {
    id: string;
    code: string;
    name: string;
    level: number;
    parent_id: string | null;
    full_path: string | null;
}

const PRODUCT_TYPES = [
    { value: "service", label: "Service" },
    { value: "product", label: "Product" },
    { value: "subscription", label: "Subscription" },
];

const CATEGORIES = [
    "Premium Course",
    "Standard Course",
    "Workshop/Module",
    "Clinic Fee",
    "Subscription",
    "Other",
];

const SCOPES = [
    { value: "GLOBAL", label: "Global" },
    { value: "ES", label: "Spain" },
    { value: "US", label: "United States" },
];

interface ProductSidePanelProps {
    open: boolean;
    onClose: () => void;
    editingProduct?: Product | null;
    onSuccess?: () => void;
}

export function ProductSidePanel({
    open,
    onClose,
    editingProduct,
    onSuccess
}: ProductSidePanelProps) {
    const [submitting, setSubmitting] = useState(false);
    const [loadingMasterData, setLoadingMasterData] = useState(true);

    // Master data
    const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([]);
    const [departmentalAccounts, setDepartmentalAccounts] = useState<DepartmentalAccount[]>([]);

    const [formData, setFormData] = useState({
        code: "",
        name: "",
        description: "",
        default_price: "",
        currency: "EUR",
        financial_account_id: "",
        departmental_account_group_id: "",
        departmental_account_subgroup_id: "",
        category: "",
        product_type: "service",
        scope: "GLOBAL",
        is_active: true,
        alternative_names: "",
    });

    useEffect(() => {
        if (open) {
            loadMasterData();
            if (editingProduct) {
                setFormData({
                    code: editingProduct.code || "",
                    name: editingProduct.name || "",
                    description: editingProduct.description || "",
                    default_price: editingProduct.default_price?.toString() || "",
                    currency: editingProduct.currency || "EUR",
                    financial_account_id: editingProduct.financial_account_id || "",
                    departmental_account_group_id: editingProduct.departmental_account_group_id || "",
                    departmental_account_subgroup_id: editingProduct.departmental_account_subgroup_id || "",
                    category: editingProduct.category || "",
                    product_type: editingProduct.product_type || "service",
                    scope: editingProduct.scope || "GLOBAL",
                    is_active: editingProduct.is_active ?? true,
                    alternative_names: editingProduct.alternative_names?.join(", ") || "",
                });
            } else {
                resetForm();
            }
        }
    }, [open, editingProduct]);

    function resetForm() {
        setFormData({
            code: "",
            name: "",
            description: "",
            default_price: "",
            currency: "EUR",
            financial_account_id: "",
            departmental_account_group_id: "",
            departmental_account_subgroup_id: "",
            category: "",
            product_type: "service",
            scope: "GLOBAL",
            is_active: true,
            alternative_names: "",
        });
    }

    async function loadMasterData() {
        setLoadingMasterData(true);
        try {
            const [faRes, daRes] = await Promise.all([
                supabase.from("financial_accounts").select("id, code, name, scope").eq("is_active", true).order("code"),
                supabase.from("departmental_accounts").select("id, code, name, level, parent_id, full_path").eq("is_active", true).order("code")
            ]);
            setFinancialAccounts(faRes.data || []);
            setDepartmentalAccounts(daRes.data || []);
        } catch (e: any) {
            console.error("Failed to load master data:", e);
        } finally {
            setLoadingMasterData(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);

        try {
            if (!formData.name.trim()) {
                toast({ title: "Error", description: "Name is required", variant: "destructive" });
                setSubmitting(false);
                return;
            }

            // Generate code if new
            let code = formData.code;
            if (!editingProduct && !code) {
                const prefix = formData.category?.substring(0, 3).toUpperCase() || "PRD";
                const { data: existing } = await supabase
                    .from("products")
                    .select("code")
                    .like("code", `DSD-${prefix}%`)
                    .order("code", { ascending: false })
                    .limit(1);

                if (existing && existing.length > 0) {
                    const lastNum = parseInt(existing[0].code.split("-").pop() || "0");
                    code = `DSD-${prefix}-${String(lastNum + 1).padStart(3, "0")}`;
                } else {
                    code = `DSD-${prefix}-001`;
                }
            }

            // Get financial account code
            const fa = financialAccounts.find((f) => f.id === formData.financial_account_id);

            const productData = {
                code,
                name: formData.name.trim(),
                description: formData.description.trim() || null,
                default_price: formData.default_price ? parseFloat(formData.default_price) : null,
                currency: formData.currency,
                financial_account_id: formData.financial_account_id || null,
                financial_account_code: fa?.code || null,
                departmental_account_group_id: formData.departmental_account_group_id || null,
                departmental_account_subgroup_id: formData.departmental_account_subgroup_id || null,
                category: formData.category || null,
                product_type: formData.product_type,
                scope: formData.scope,
                is_active: formData.is_active,
                alternative_names: formData.alternative_names
                    ? formData.alternative_names.split(",").map((n) => n.trim()).filter(Boolean)
                    : [],
            };

            if (editingProduct) {
                const { error } = await supabase
                    .from("products")
                    .update(productData)
                    .eq("id", editingProduct.id);

                if (error) throw error;
                toast({ title: "Success", description: "Product updated" });
            } else {
                const { error } = await supabase.from("products").insert(productData);
                if (error) throw error;
                toast({ title: "Success", description: "Product created" });
            }

            onClose();
            onSuccess?.();
        } catch (e: any) {
            toast({ title: "Error", description: e?.message || "Failed to save product", variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    }

    // Get subgroups for selected group
    const availableSubgroups = departmentalAccounts.filter(
        (da) => da.level === 2 && da.parent_id === formData.departmental_account_group_id
    );

    if (!open) return null;

    return (
        <div className="fixed right-0 top-0 h-screen w-[520px] bg-[#1e1f21] border-l border-gray-700 flex flex-col z-[9999] shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 bg-[#2a2b2d]">
                <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-blue-400" />
                    <h2 className="text-lg font-semibold text-white">
                        {editingProduct ? "Edit Product" : "New Product"}
                    </h2>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-700" onClick={onClose}>
                    <X className="h-5 w-5" />
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {loadingMasterData ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-5 space-y-5">
                        {/* Section: Basic Info */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Basic Information</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs text-gray-300">Code</Label>
                                    <Input
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        placeholder="Auto-generated"
                                        className="mt-1 h-9 bg-gray-800 text-white border-gray-600 placeholder:text-gray-500"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-300">Scope</Label>
                                    <Select value={formData.scope} onValueChange={(v) => setFormData({ ...formData, scope: v })}>
                                        <SelectTrigger className="mt-1 h-9 bg-gray-800 text-white border-gray-600">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SCOPES.map((s) => (
                                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <Label className="text-xs text-gray-300">Name *</Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Product name"
                                    required
                                    className="mt-1 h-9 bg-gray-800 text-white border-gray-600 placeholder:text-gray-500"
                                />
                            </div>

                            <div>
                                <Label className="text-xs text-gray-300">Description</Label>
                                <Textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Product description"
                                    rows={3}
                                    className="mt-1 bg-gray-800 text-white border-gray-600 placeholder:text-gray-500 resize-none"
                                />
                            </div>
                        </div>

                        {/* Section: Classification */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Classification</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs text-gray-300">Type</Label>
                                    <Select value={formData.product_type} onValueChange={(v) => setFormData({ ...formData, product_type: v })}>
                                        <SelectTrigger className="mt-1 h-9 bg-gray-800 text-white border-gray-600">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PRODUCT_TYPES.map((t) => (
                                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-300">Category</Label>
                                    <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                                        <SelectTrigger className="mt-1 h-9 bg-gray-800 text-white border-gray-600">
                                            <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CATEGORIES.map((cat) => (
                                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs text-gray-300">Currency</Label>
                                    <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                                        <SelectTrigger className="mt-1 h-9 bg-gray-800 text-white border-gray-600">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="EUR">EUR</SelectItem>
                                            <SelectItem value="USD">USD</SelectItem>
                                            <SelectItem value="GBP">GBP</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-300">Financial Account</Label>
                                    <Select
                                        value={formData.financial_account_id || "none"}
                                        onValueChange={(v) => setFormData({ ...formData, financial_account_id: v === "none" ? "" : v })}
                                    >
                                        <SelectTrigger className="mt-1 h-9 bg-gray-800 text-white border-gray-600">
                                            <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">None</SelectItem>
                                            {financialAccounts.map((fa) => (
                                                <SelectItem key={fa.id} value={fa.id}>
                                                    {fa.code} - {fa.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Section: Departmental Accounts */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Departmental Accounts</h3>

                            <div>
                                <Label className="text-xs text-gray-300">Group</Label>
                                <Select
                                    value={formData.departmental_account_group_id || "none"}
                                    onValueChange={(v) => setFormData({
                                        ...formData,
                                        departmental_account_group_id: v === "none" ? "" : v,
                                        departmental_account_subgroup_id: ""
                                    })}
                                >
                                    <SelectTrigger className="mt-1 h-9 bg-gray-800 text-white border-gray-600">
                                        <SelectValue placeholder="Select group..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {departmentalAccounts.filter((da) => da.level === 1).map((da) => (
                                            <SelectItem key={da.id} value={da.id}>
                                                {da.code} - {da.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-xs text-gray-300">Subgroup</Label>
                                <Select
                                    value={formData.departmental_account_subgroup_id || "none"}
                                    onValueChange={(v) => setFormData({ ...formData, departmental_account_subgroup_id: v === "none" ? "" : v })}
                                    disabled={!formData.departmental_account_group_id}
                                >
                                    <SelectTrigger className="mt-1 h-9 bg-gray-800 text-white border-gray-600">
                                        <SelectValue placeholder={formData.departmental_account_group_id ? "Select subgroup..." : "Select group first"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {availableSubgroups.map((da) => (
                                            <SelectItem key={da.id} value={da.id}>
                                                {da.code} - {da.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Section: Alternative Names */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Alternative Names</h3>
                            <div>
                                <Label className="text-xs text-gray-300">Names (comma separated)</Label>
                                <Input
                                    value={formData.alternative_names}
                                    onChange={(e) => setFormData({ ...formData, alternative_names: e.target.value })}
                                    placeholder="Name 1, Name 2, Name 3..."
                                    className="mt-1 h-9 bg-gray-800 text-white border-gray-600 placeholder:text-gray-500"
                                />
                                <p className="text-[10px] text-gray-500 mt-1">
                                    Use to map name variations, typos, etc.
                                </p>
                            </div>
                        </div>

                        {/* Active checkbox */}
                        <div className="flex items-center gap-3 pt-2">
                            <Checkbox
                                id="is_active"
                                checked={formData.is_active}
                                onCheckedChange={(checked) => setFormData({ ...formData, is_active: !!checked })}
                                className="border-gray-600 data-[state=checked]:bg-blue-600"
                            />
                            <Label htmlFor="is_active" className="cursor-pointer text-gray-300 text-sm">
                                Active product
                            </Label>
                        </div>
                    </form>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-700 bg-[#2a2b2d]">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="bg-transparent border-gray-600 text-white hover:bg-gray-700"
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                    {submitting ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Saving...
                        </>
                    ) : (
                        editingProduct ? "Save Changes" : "Create Product"
                    )}
                </Button>
            </div>
        </div>
    );
}
