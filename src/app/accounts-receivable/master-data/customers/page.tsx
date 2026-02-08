"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Users,
    Pencil,
    Plus,
    Search,
    Trash2,
    Loader2,
    CheckCircle,
    XCircle,
    X,
    RefreshCw,
    AlertTriangle,
    Zap,
    Eye,
    Info,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Customer {
    code: string;
    name: string;
    tax_id: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    country: string;
    currency: string;
    payment_terms: string;
    credit_limit: number | null;
    is_active: boolean;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

interface HomogenizationGroup {
    canonical_name: string;
    canonical_email: string;
    all_names: string[];
    all_emails: string[];
    invoice_count: number;
    total_revenue: number;
    first_date: string;
    last_date: string;
    name_variations: { name: string; count: number }[];
    email_variations: { email: string; count: number }[];
    homogenization_notes: string[];
    invoice_ids: string[];
}

interface HomogenizationStats {
    total_invoices: number;
    unique_customers: number;
    customers_with_variations: number;
    name_conflicts: number;
    email_conflicts: number;
}

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

    // Homogenization state
    const [analyzing, setAnalyzing] = useState(false);
    const [homogenizing, setHomogenizing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<{
        stats: HomogenizationStats;
        customers: HomogenizationGroup[];
    } | null>(null);
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [selectedVariation, setSelectedVariation] = useState<HomogenizationGroup | null>(null);

    const [formData, setFormData] = useState({
        code: "",
        name: "",
        tax_id: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        postal_code: "",
        country: "ES",
        currency: "EUR",
        payment_terms: "net_30",
        credit_limit: "",
        notes: "",
    });

    useEffect(() => {
        loadCustomers();
    }, []);

    async function loadCustomers() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("customers")
                .select("*")
                .order("name");
            if (error) throw error;
            setCustomers(data || []);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }

    const filteredCustomers = useMemo(() => {
        let filtered = [...customers];
        if (statusFilter === "ACTIVE") filtered = filtered.filter((c) => c.is_active);
        if (statusFilter === "INACTIVE") filtered = filtered.filter((c) => !c.is_active);
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (c) =>
                    c.name.toLowerCase().includes(term) ||
                    c.code.toLowerCase().includes(term) ||
                    c.email?.toLowerCase().includes(term) ||
                    c.tax_id?.toLowerCase().includes(term)
            );
        }
        return filtered;
    }, [customers, searchTerm, statusFilter]);

    const handleOpenForm = (customer?: Customer) => {
        if (customer) {
            setEditingCustomer(customer);
            setFormData({
                code: customer.code,
                name: customer.name,
                tax_id: customer.tax_id || "",
                email: customer.email || "",
                phone: customer.phone || "",
                address: customer.address || "",
                city: customer.city || "",
                postal_code: customer.postal_code || "",
                country: customer.country,
                currency: customer.currency,
                payment_terms: customer.payment_terms,
                credit_limit: customer.credit_limit?.toString() || "",
                notes: customer.notes || "",
            });
        } else {
            setEditingCustomer(null);
            setFormData({
                code: "",
                name: "",
                tax_id: "",
                email: "",
                phone: "",
                address: "",
                city: "",
                postal_code: "",
                country: "ES",
                currency: "EUR",
                payment_terms: "net_30",
                credit_limit: "",
                notes: "",
            });
        }
        setIsFormOpen(true);
    };

    async function handleSave() {
        try {
            if (!formData.name || !formData.country) {
                toast({ title: "Validation Error", description: "Name and Country are required", variant: "destructive" });
                return;
            }

            let code = formData.code;
            if (!editingCustomer) {
                const { data: existing } = await supabase
                    .from("customers")
                    .select("code")
                    .like("code", `${formData.country}-CU%`)
                    .order("code", { ascending: false })
                    .limit(1);
                if (existing && existing.length > 0) {
                    const lastNumber = parseInt(existing[0].code.split("-CU")[1]) || 0;
                    code = `${formData.country}-CU${String(lastNumber + 1).padStart(5, "0")}`;
                } else {
                    code = `${formData.country}-CU00001`;
                }
            }

            const customerData = {
                code,
                name: formData.name,
                tax_id: formData.tax_id || null,
                email: formData.email || null,
                phone: formData.phone || null,
                address: formData.address || null,
                city: formData.city || null,
                postal_code: formData.postal_code || null,
                country: formData.country,
                currency: formData.currency,
                payment_terms: formData.payment_terms,
                credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : null,
                notes: formData.notes || null,
                is_active: true,
                updated_at: new Date().toISOString(),
            };

            if (editingCustomer) {
                const { error } = await supabase.from("customers").update(customerData).eq("code", editingCustomer.code);
                if (error) throw error;
                toast({ title: "Customer updated successfully" });
            } else {
                const { error } = await supabase.from("customers").insert(customerData);
                if (error) throw error;
                toast({ title: "Customer created successfully" });
            }
            setIsFormOpen(false);
            loadCustomers();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    }

    async function handleDelete(customer: Customer) {
        if (!confirm(`Delete customer ${customer.name}?`)) return;
        try {
            const { error } = await supabase.from("customers").delete().eq("code", customer.code);
            if (error) throw error;
            toast({ title: "Customer deleted successfully" });
            loadCustomers();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    }

    // Homogenization: Analyze
    async function runAnalysis() {
        try {
            setAnalyzing(true);
            const res = await fetch("/api/customers/homogenize");
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            setAnalysisResult(data);
            setShowAnalysis(true);
            toast({ title: `Analysis complete: ${data.stats.unique_customers} unique customers found, ${data.stats.customers_with_variations} with name/email variations` });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setAnalyzing(false);
        }
    }

    // Homogenization: Execute
    async function executeHomogenization() {
        if (!analysisResult) return;
        if (!confirm(`This will homogenize ${analysisResult.stats.customers_with_variations} customers with variations and populate ${analysisResult.stats.unique_customers} customers into master data. Continue?`)) return;

        try {
            setHomogenizing(true);
            const res = await fetch("/api/customers/homogenize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customers: analysisResult.customers }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            toast({
                title: "Homogenization complete",
                description: `Created: ${data.results.customers_created}, Updated: ${data.results.customers_updated}, Invoices annotated: ${data.results.invoices_annotated}`,
            });
            setShowAnalysis(false);
            setAnalysisResult(null);
            loadCustomers();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setHomogenizing(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#1e1f21]">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
        );
    }

    // Analysis Panel View
    if (showAnalysis && analysisResult) {
        const variationsOnly = analysisResult.customers.filter((c) => c.homogenization_notes.length > 0);
        return (
            <div className="min-h-screen bg-[#1e1f21] text-white">
                <div className="border-b border-gray-700 px-6 py-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <Zap className="h-5 w-5 text-yellow-400" />
                            <h1 className="text-xl font-semibold">Customer Analysis & Homogenization</h1>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setShowAnalysis(false)}
                                className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700"
                            >
                                Back to Customers
                            </Button>
                            <Button
                                onClick={executeHomogenization}
                                disabled={homogenizing}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                {homogenizing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                                Execute Homogenization & Populate
                            </Button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400">Total Invoices:</span>
                            <span className="text-white font-medium">{analysisResult.stats.total_invoices.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400">Unique Customers:</span>
                            <span className="text-white font-medium">{analysisResult.stats.unique_customers}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400">Name Conflicts:</span>
                            <span className="text-yellow-400 font-medium">{analysisResult.stats.name_conflicts}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400">Email Conflicts:</span>
                            <span className="text-yellow-400 font-medium">{analysisResult.stats.email_conflicts}</span>
                        </div>
                    </div>
                </div>

                {/* Table Header */}
                <div className="sticky top-0 z-10 bg-[#2a2b2d] border-b border-gray-700">
                    <div className="flex items-center gap-1 px-4 py-2 text-[11px] text-gray-400 font-medium uppercase">
                        <div className="w-[30px] flex-shrink-0"></div>
                        <div className="flex-1 min-w-[200px]">Canonical Name</div>
                        <div className="w-[200px] flex-shrink-0">Email</div>
                        <div className="w-[80px] flex-shrink-0 text-right">Invoices</div>
                        <div className="w-[120px] flex-shrink-0 text-right">Total Revenue</div>
                        <div className="w-[100px] flex-shrink-0">Period</div>
                        <div className="w-[250px] flex-shrink-0">Variations</div>
                    </div>
                </div>

                {/* Customers with variations first, then clean ones */}
                <div className="pb-20">
                    {variationsOnly.length > 0 && (
                        <div className="px-4 py-2 bg-yellow-900/20 border-b border-yellow-700/50 text-yellow-400 text-xs font-medium flex items-center gap-2">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {variationsOnly.length} customers with name/email variations detected
                        </div>
                    )}
                    {analysisResult.customers.map((group, idx) => {
                        const hasVariations = group.homogenization_notes.length > 0;
                        return (
                            <div
                                key={idx}
                                className={`flex items-center gap-1 px-4 py-2 border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer ${hasVariations ? "bg-yellow-900/10" : ""}`}
                                onClick={() => setSelectedVariation(selectedVariation === group ? null : group)}
                            >
                                <div className="w-[30px] flex-shrink-0">
                                    {hasVariations ? (
                                        <AlertTriangle className="h-4 w-4 text-yellow-400" />
                                    ) : (
                                        <CheckCircle className="h-4 w-4 text-green-500/50" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-[200px]">
                                    <span className="text-[13px] text-white font-medium">{group.canonical_name}</span>
                                </div>
                                <div className="w-[200px] flex-shrink-0">
                                    <span className="text-[12px] text-gray-400 truncate block">{group.canonical_email || "\u2014"}</span>
                                </div>
                                <div className="w-[80px] flex-shrink-0 text-right">
                                    <span className="text-[12px] text-gray-300">{group.invoice_count}</span>
                                </div>
                                <div className="w-[120px] flex-shrink-0 text-right">
                                    <span className="text-[12px] text-green-400 font-mono">\u20ac{group.total_revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="w-[100px] flex-shrink-0">
                                    <span className="text-[10px] text-gray-500">{group.first_date?.slice(0, 7)} - {group.last_date?.slice(0, 7)}</span>
                                </div>
                                <div className="w-[250px] flex-shrink-0">
                                    {hasVariations ? (
                                        <div className="flex flex-wrap gap-1">
                                            {group.name_variations.length > 1 && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/30 text-yellow-400 border border-yellow-700">
                                                    {group.name_variations.length} names
                                                </span>
                                            )}
                                            {group.email_variations.length > 1 && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400 border border-blue-700">
                                                    {group.email_variations.length} emails
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-[10px] text-gray-600">Clean</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Variation Detail Popup */}
                {selectedVariation && (
                    <div className="fixed right-0 top-0 h-full w-[450px] bg-[#1e1f21] border-l border-gray-700 flex flex-col z-[100] shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                            <div>
                                <h2 className="text-lg font-semibold text-white">{selectedVariation.canonical_name}</h2>
                                <span className="text-xs text-gray-400">{selectedVariation.canonical_email}</span>
                            </div>
                            <button onClick={() => setSelectedVariation(null)} className="text-gray-400 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                            <div className="bg-[#2a2b2d] rounded-lg p-3 space-y-2">
                                <h3 className="text-xs text-gray-400 uppercase font-medium">Summary</h3>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div><span className="text-gray-400">Invoices:</span> <span className="text-white">{selectedVariation.invoice_count}</span></div>
                                    <div><span className="text-gray-400">Revenue:</span> <span className="text-green-400">\u20ac{selectedVariation.total_revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></div>
                                    <div><span className="text-gray-400">First:</span> <span className="text-gray-300">{selectedVariation.first_date}</span></div>
                                    <div><span className="text-gray-400">Last:</span> <span className="text-gray-300">{selectedVariation.last_date}</span></div>
                                </div>
                            </div>

                            {selectedVariation.name_variations.length > 1 && (
                                <div className="bg-[#2a2b2d] rounded-lg p-3 space-y-2">
                                    <h3 className="text-xs text-yellow-400 uppercase font-medium flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" /> Name Variations
                                    </h3>
                                    {selectedVariation.name_variations.map((v, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm">
                                            <span className={i === 0 ? "text-white font-medium" : "text-gray-400"}>
                                                {v.name} {i === 0 && <span className="text-green-400 text-[10px]">CANONICAL</span>}
                                            </span>
                                            <span className="text-gray-500 text-xs">{v.count}x</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {selectedVariation.email_variations.length > 1 && (
                                <div className="bg-[#2a2b2d] rounded-lg p-3 space-y-2">
                                    <h3 className="text-xs text-blue-400 uppercase font-medium flex items-center gap-1">
                                        <Info className="h-3 w-3" /> Email Variations
                                    </h3>
                                    {selectedVariation.email_variations.map((v, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm">
                                            <span className={i === 0 ? "text-white font-medium" : "text-gray-400"}>
                                                {v.email} {i === 0 && <span className="text-green-400 text-[10px]">PRIMARY</span>}
                                            </span>
                                            <span className="text-gray-500 text-xs">{v.count}x</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {selectedVariation.homogenization_notes.length > 0 && (
                                <div className="bg-[#2a2b2d] rounded-lg p-3 space-y-2">
                                    <h3 className="text-xs text-gray-400 uppercase font-medium">Homogenization Notes</h3>
                                    {selectedVariation.homogenization_notes.map((note, i) => (
                                        <p key={i} className="text-sm text-gray-300">{note}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Main Customers View
    return (
        <div className="min-h-screen bg-[#1e1f21] text-white">
            {/* Header */}
            <div className="border-b border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-blue-400" />
                        <h1 className="text-xl font-semibold">Customers</h1>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-400 text-sm">Manage customer master data for Accounts Receivable</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={runAnalysis}
                            disabled={analyzing}
                            variant="outline"
                            className="bg-transparent border-yellow-600 text-yellow-400 hover:bg-yellow-900/30"
                        >
                            {analyzing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
                            Analyze & Sync from Invoices
                        </Button>
                        <Button
                            onClick={() => handleOpenForm()}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            New Customer
                        </Button>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {(["ALL", "ACTIVE", "INACTIVE"] as const).map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${statusFilter === status
                                        ? "bg-blue-600 text-white"
                                        : "bg-transparent border border-gray-600 text-gray-300 hover:bg-gray-700"
                                    }`}
                            >
                                {status === "ALL" ? "All" : status === "ACTIVE" ? "Active" : "Inactive"}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search customers..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 w-64 bg-transparent border-gray-600 text-white placeholder:text-gray-500"
                            />
                        </div>
                        <span className="text-gray-400 text-sm">{filteredCustomers.length} customers</span>
                    </div>
                </div>
            </div>

            {/* Table Header */}
            <div className="sticky top-0 z-10 bg-[#2a2b2d] border-b border-gray-700">
                <div className="flex items-center gap-1 px-4 py-2 text-[11px] text-gray-400 font-medium uppercase">
                    <div className="w-[50px] flex-shrink-0">Actions</div>
                    <div className="w-[120px] flex-shrink-0">Code</div>
                    <div className="flex-1 min-w-[180px]">Name</div>
                    <div className="w-[100px] flex-shrink-0">Tax ID</div>
                    <div className="w-[200px] flex-shrink-0">Email</div>
                    <div className="w-[80px] flex-shrink-0">Country</div>
                    <div className="w-[80px] flex-shrink-0">Currency</div>
                    <div className="w-[100px] flex-shrink-0">Pay Terms</div>
                    <div className="w-[100px] flex-shrink-0 text-right">Credit Limit</div>
                    <div className="w-[80px] flex-shrink-0">Status</div>
                </div>
            </div>

            {/* Table Body */}
            <div className="pb-20">
                {filteredCustomers.length === 0 ? (
                    <div className="text-center py-20 text-gray-500">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p className="text-lg">No customers found</p>
                        <p className="text-sm mt-1">Add customers manually or use "Analyze & Sync from Invoices" to auto-populate</p>
                    </div>
                ) : (
                    filteredCustomers.map((customer) => {
                        const hasNotes = customer.notes && (customer.notes.includes("homogeniz") || customer.notes.includes("variation"));
                        return (
                            <div
                                key={customer.code}
                                className={`flex items-center gap-1 px-4 py-2 hover:bg-gray-800/30 border-b border-gray-800/50 group cursor-pointer ${hasNotes ? "bg-yellow-900/5" : ""}`}
                                onClick={() => handleOpenForm(customer)}
                            >
                                <div className="w-[50px] flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleOpenForm(customer)} className="text-gray-500 hover:text-blue-400 transition-colors">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={() => handleDelete(customer)} className="text-gray-500 hover:text-red-400 transition-colors">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <div className="w-[120px] flex-shrink-0">
                                    <span className="font-mono text-[12px] text-gray-300">{customer.code}</span>
                                </div>
                                <div className="flex-1 min-w-[180px] flex items-center gap-1.5">
                                    <span className="text-[13px] text-white font-medium">{customer.name}</span>
                                    {hasNotes && <AlertTriangle className="h-3 w-3 text-yellow-400 flex-shrink-0" title="Homogenized customer" />}
                                </div>
                                <div className="w-[100px] flex-shrink-0">
                                    <span className="text-[12px] text-gray-400">{customer.tax_id || "\u2014"}</span>
                                </div>
                                <div className="w-[200px] flex-shrink-0">
                                    <span className="text-[12px] text-gray-400 truncate block">{customer.email || "\u2014"}</span>
                                </div>
                                <div className="w-[80px] flex-shrink-0">
                                    <span className="text-[11px] px-2 py-0.5 rounded border border-gray-600 text-gray-300">{customer.country}</span>
                                </div>
                                <div className="w-[80px] flex-shrink-0">
                                    <span className="text-[12px] text-gray-400">{customer.currency}</span>
                                </div>
                                <div className="w-[100px] flex-shrink-0">
                                    <span className="text-[12px] text-gray-400">{customer.payment_terms.replace(/_/g, " ")}</span>
                                </div>
                                <div className="w-[100px] flex-shrink-0 text-right">
                                    <span className="text-[12px] text-gray-400">
                                        {customer.credit_limit ? `${customer.currency} ${customer.credit_limit.toLocaleString()}` : "\u2014"}
                                    </span>
                                </div>
                                <div className="w-[80px] flex-shrink-0">
                                    {customer.is_active ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-700">
                                            <CheckCircle className="h-3 w-3" />Active
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-red-900/30 text-red-400 border border-red-700">
                                            <XCircle className="h-3 w-3" />Inactive
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Side Panel Form */}
            {isFormOpen && (
                <div className="fixed right-0 top-0 h-full w-[500px] bg-[#1e1f21] border-l border-gray-700 flex flex-col z-[100] shadow-2xl">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                        <div>
                            <h2 className="text-lg font-semibold text-white">
                                {editingCustomer ? "Edit Customer" : "New Customer"}
                            </h2>
                            {editingCustomer && <span className="text-xs font-mono text-blue-400">{editingCustomer.code}</span>}
                            {!editingCustomer && <span className="text-xs text-green-400">Code will be auto-generated</span>}
                        </div>
                        <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-white">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-[11px] text-gray-400 uppercase font-medium">Name *</Label>
                            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="bg-[#2a2b2d] border-gray-600 text-white h-9" placeholder="Customer name" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-[11px] text-gray-400 uppercase font-medium">Country *</Label>
                                <select value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} className="w-full h-9 px-3 rounded-md bg-[#2a2b2d] border border-gray-600 text-white text-sm">
                                    <option value="ES" className="bg-gray-800">Spain</option>
                                    <option value="US" className="bg-gray-800">United States</option>
                                    <option value="PT" className="bg-gray-800">Portugal</option>
                                    <option value="FR" className="bg-gray-800">France</option>
                                    <option value="DE" className="bg-gray-800">Germany</option>
                                    <option value="GB" className="bg-gray-800">United Kingdom</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[11px] text-gray-400 uppercase font-medium">Currency</Label>
                                <select value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} className="w-full h-9 px-3 rounded-md bg-[#2a2b2d] border border-gray-600 text-white text-sm">
                                    <option value="EUR" className="bg-gray-800">EUR</option>
                                    <option value="USD" className="bg-gray-800">USD</option>
                                    <option value="GBP" className="bg-gray-800">GBP</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-[11px] text-gray-400 uppercase font-medium">Tax ID / VAT</Label>
                                <Input value={formData.tax_id} onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })} className="bg-[#2a2b2d] border-gray-600 text-white h-9" placeholder="B12345678" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[11px] text-gray-400 uppercase font-medium">Payment Terms</Label>
                                <select value={formData.payment_terms} onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })} className="w-full h-9 px-3 rounded-md bg-[#2a2b2d] border border-gray-600 text-white text-sm">
                                    <option value="immediate" className="bg-gray-800">Immediate</option>
                                    <option value="net_15" className="bg-gray-800">Net 15</option>
                                    <option value="net_30" className="bg-gray-800">Net 30</option>
                                    <option value="net_45" className="bg-gray-800">Net 45</option>
                                    <option value="net_60" className="bg-gray-800">Net 60</option>
                                    <option value="net_90" className="bg-gray-800">Net 90</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[11px] text-gray-400 uppercase font-medium">Email</Label>
                            <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="bg-[#2a2b2d] border-gray-600 text-white h-9" placeholder="customer@example.com" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[11px] text-gray-400 uppercase font-medium">Phone</Label>
                            <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="bg-[#2a2b2d] border-gray-600 text-white h-9" placeholder="+34 123 456 789" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[11px] text-gray-400 uppercase font-medium">Address</Label>
                            <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="bg-[#2a2b2d] border-gray-600 text-white h-9" placeholder="Street address" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-[11px] text-gray-400 uppercase font-medium">City</Label>
                                <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="bg-[#2a2b2d] border-gray-600 text-white h-9" placeholder="Madrid" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[11px] text-gray-400 uppercase font-medium">Postal Code</Label>
                                <Input value={formData.postal_code} onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })} className="bg-[#2a2b2d] border-gray-600 text-white h-9" placeholder="28001" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[11px] text-gray-400 uppercase font-medium">Credit Limit</Label>
                            <Input type="number" step="0.01" value={formData.credit_limit} onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })} className="bg-[#2a2b2d] border-gray-600 text-white h-9" placeholder="50000.00" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[11px] text-gray-400 uppercase font-medium">Notes</Label>
                            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-3 py-2 rounded-md bg-[#2a2b2d] border border-gray-600 text-white text-sm min-h-[80px] resize-none placeholder:text-gray-500" placeholder="Additional notes..." />
                        </div>
                    </div>
                    <div className="border-t border-gray-700 px-6 py-3 flex items-center gap-3 justify-end">
                        <Button variant="outline" onClick={() => setIsFormOpen(false)} className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700">Cancel</Button>
                        <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">{editingCustomer ? "Update Customer" : "Create Customer"}</Button>
                    </div>
                </div>
            )}
        </div>
    );
}
