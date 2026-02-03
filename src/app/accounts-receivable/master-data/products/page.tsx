"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
    Package,
    Plus,
    Edit,
    Search,
    Merge,
    CheckCircle,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    Loader2,
    Filter,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProductSidePanel } from "@/components/app/product-side-panel";

interface Product {
    id: string;
    code: string;
    name: string;
    description: string | null;
    default_price: number | null;
    currency: string;
    financial_account_id: string | null;
    financial_account_code: string | null;
    department: string | null;
    cost_center_id: string | null;
    cost_center_code: string | null;
    departmental_account_id: string | null;
    departmental_account_group_id: string | null;
    departmental_account_subgroup_id: string | null;
    category: string | null;
    product_type: string;
    scope: string;
    is_active: boolean;
    alternative_names: string[];
    merged_into_id: string | null;
    source: string | null;
    external_id: string | null;
    created_at: string;
    updated_at: string;
}

interface FinancialAccount {
    id: string;  // Using code as id
    code: string;
    name: string;
    type?: string;
    level?: number;
    parent_code?: string | null;
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
    // Planning Center Services
    "Planning",
    "Guide Design",
    "Implant Planning",
    // Manufacturing / Lab
    "Surgical Guide",
    "Prosthesis",
    "Abutment",
    "Crown",
    "Denture",
    "Model",
    // Education
    "Course",
    "Residency",
    "Workshop/Module",
    "Certification",
    "Coaching",
    // Clinical
    "Clinic Fee",
    // Subscriptions & Software
    "Subscription",
    "License",
    // Other
    "Other",
];

const SCOPES = [
    { value: "GLOBAL", label: "Global" },
    { value: "ES", label: "Spain" },
    { value: "US", label: "United States" },
];

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [mergedProducts, setMergedProducts] = useState<Product[]>([]);
    const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([]);
    const [departmentalAccounts, setDepartmentalAccounts] = useState<DepartmentalAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [scopeFilter, setScopeFilter] = useState("all");
    const [showInactive, setShowInactive] = useState(false);

    // Expanded products (to show merged children)
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

    // Side Panel states
    const [sidePanelOpen, setSidePanelOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    // Merge Dialog states
    const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
    const [selectedForMerge, setSelectedForMerge] = useState<Product[]>([]);
    const [mergeTarget, setMergeTarget] = useState<string>("");
    const [syncing, setSyncing] = useState(false);

    const { toast } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load main products (not merged into another)
            const { data: productsData, error: productsError } = await supabase
                .from("products")
                .select("*")
                .is("merged_into_id", null)
                .order("name");

            if (productsError) throw productsError;
            setProducts(productsData || []);

            // Load merged products (products that were merged into others)
            const { data: mergedData, error: mergedError } = await supabase
                .from("products")
                .select("*")
                .not("merged_into_id", "is", null)
                .order("name");

            if (!mergedError) {
                setMergedProducts(mergedData || []);
            }

            // Load financial accounts (REVENUE only for AR products)
            const { data: faData } = await supabase
                .from("financial_accounts")
                .select("code, name, type, level, parent_code")
                .eq("is_active", true)
                .eq("type", "revenue")
                .order("code");
            // Map code to id for compatibility with existing code
            const faWithId = (faData || []).map(fa => ({ ...fa, id: fa.code }));
            setFinancialAccounts(faWithId);

            // Load departmental accounts
            const { data: daData } = await supabase
                .from("departmental_accounts")
                .select("id, code, name, level, parent_id, full_path")
                .eq("is_active", true)
                .order("code");
            setDepartmentalAccounts(daData || []);
        } catch (error) {
            console.error("Error loading data:", error);
            toast({
                title: "Error",
                description: "Error loading data",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    // Get merged children for a product
    const getMergedChildren = (productId: string): Product[] => {
        return mergedProducts.filter((p) => p.merged_into_id === productId);
    };

    // Filtered products
    const filteredProducts = useMemo(() => {
        return products.filter((p) => {
            if (!showInactive && !p.is_active) return false;
            if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
            if (scopeFilter !== "all" && p.scope !== scopeFilter) return false;
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                const matchesMain =
                    p.name.toLowerCase().includes(search) ||
                    p.code.toLowerCase().includes(search) ||
                    p.description?.toLowerCase().includes(search) ||
                    p.alternative_names?.some((n) => n.toLowerCase().includes(search));

                // Also check if any merged children match
                const children = getMergedChildren(p.id);
                const matchesChildren = children.some((c) =>
                    c.name.toLowerCase().includes(search) ||
                    c.code.toLowerCase().includes(search)
                );

                return matchesMain || matchesChildren;
            }
            return true;
        });
    }, [products, mergedProducts, searchTerm, categoryFilter, scopeFilter, showInactive]);

    const toggleProductExpansion = (productId: string) => {
        setExpandedProducts((prev) => {
            const next = new Set(prev);
            if (next.has(productId)) {
                next.delete(productId);
            } else {
                next.add(productId);
            }
            return next;
        });
    };

    const openSidePanel = (product: Product | null) => {
        setEditingProduct(product);
        setSidePanelOpen(true);
    };

    const closeSidePanel = () => {
        setSidePanelOpen(false);
        setEditingProduct(null);
    };

    const toggleMergeSelection = (product: Product) => {
        setSelectedForMerge((prev) => {
            const exists = prev.find((p) => p.id === product.id);
            if (exists) {
                return prev.filter((p) => p.id !== product.id);
            }
            return [...prev, product];
        });
    };

    const handleMerge = async () => {
        if (selectedForMerge.length < 2 || !mergeTarget) {
            toast({
                title: "Error",
                description: "Select at least 2 products and define the main product",
                variant: "destructive",
            });
            return;
        }

        try {
            const targetProduct = products.find((p) => p.id === mergeTarget);
            if (!targetProduct) return;

            // Products to merge (excluding target)
            const toMerge = selectedForMerge.filter((p) => p.id !== mergeTarget);

            // Collect alternative names from merged products
            const allAltNames = new Set(targetProduct.alternative_names || []);
            toMerge.forEach((p) => {
                allAltNames.add(p.name);
                p.alternative_names?.forEach((n) => allAltNames.add(n));
            });

            // Update target product with all alternative names
            const { error: updateError } = await supabase
                .from("products")
                .update({
                    alternative_names: Array.from(allAltNames),
                })
                .eq("id", mergeTarget);

            if (updateError) throw updateError;

            // Record merge history and mark products as merged
            for (const product of toMerge) {
                // Create merge record (if table exists)
                try {
                    await supabase.from("product_merges").insert({
                        source_product_id: product.id,
                        source_product_name: product.name,
                        source_product_code: product.code,
                        target_product_id: mergeTarget,
                        notes: `Merged into ${targetProduct.name}`,
                    });
                } catch {
                    // Table might not exist, continue anyway
                }

                // Mark product as merged (soft delete)
                await supabase
                    .from("products")
                    .update({
                        merged_into_id: mergeTarget,
                        is_active: false,
                    })
                    .eq("id", product.id);
            }

            toast({
                title: "Success",
                description: `${toMerge.length} product(s) merged into "${targetProduct.name}"`,
            });

            setIsMergeDialogOpen(false);
            setSelectedForMerge([]);
            setMergeTarget("");
            loadData();
        } catch (error: any) {
            console.error("Error merging products:", error);
            toast({
                title: "Error",
                description: error.message || "Error merging products",
                variant: "destructive",
            });
        }
    };

    // Stats
    const stats = useMemo(() => {
        const active = products.filter((p) => p.is_active).length;
        const withFA = products.filter((p) => p.financial_account_id).length;
        const withMerged = products.filter((p) => getMergedChildren(p.id).length > 0).length;
        return { total: products.length, active, withFA, withMerged };
    }, [products, mergedProducts]);

    // Get financial account display
    const getFinancialAccountDisplay = (product: Product) => {
        if (product.financial_account_code) return product.financial_account_code;
        if (product.financial_account_id) {
            const fa = financialAccounts.find((f) => f.id === product.financial_account_id);
            return fa?.code || "—";
        }
        return "—";
    };

    // Get departmental account display
    const getDepartmentalDisplay = (product: Product) => {
        if (product.departmental_account_group_id) {
            const group = departmentalAccounts.find((d) => d.id === product.departmental_account_group_id);
            const subgroup = product.departmental_account_subgroup_id
                ? departmentalAccounts.find((d) => d.id === product.departmental_account_subgroup_id)
                : null;
            if (group) {
                return subgroup ? `${group.name} > ${subgroup.name}` : group.name;
            }
        }
        return "—";
    };

    // Inline update functions
    const updateProductFinancialAccount = async (productId: string, financialAccountCode: string | null) => {
        try {
            const fa = financialAccountCode ? financialAccounts.find((f) => f.code === financialAccountCode) : null;
            const { error } = await supabase
                .from("products")
                .update({
                    financial_account_id: null,  // Clear UUID field (not used with code-based lookup)
                    financial_account_code: financialAccountCode || null,
                })
                .eq("id", productId);

            if (error) throw error;

            // Update local state
            setProducts((prev) =>
                prev.map((p) =>
                    p.id === productId
                        ? { ...p, financial_account_id: null, financial_account_code: financialAccountCode || null }
                        : p
                )
            );
            toast({ title: "Updated", description: "Financial account updated" });
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        }
    };

    const updateProductDepartmentalGroup = async (productId: string, groupId: string | null) => {
        try {
            const { error } = await supabase
                .from("products")
                .update({
                    departmental_account_group_id: groupId,
                    departmental_account_subgroup_id: null, // Reset subgroup when group changes
                })
                .eq("id", productId);

            if (error) throw error;

            setProducts((prev) =>
                prev.map((p) =>
                    p.id === productId
                        ? { ...p, departmental_account_group_id: groupId, departmental_account_subgroup_id: null }
                        : p
                )
            );
            toast({ title: "Updated", description: "Departmental group updated" });
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        }
    };

    const updateProductDepartmentalSubgroup = async (productId: string, subgroupId: string | null) => {
        try {
            const { error } = await supabase
                .from("products")
                .update({
                    departmental_account_subgroup_id: subgroupId,
                })
                .eq("id", productId);

            if (error) throw error;

            setProducts((prev) =>
                prev.map((p) =>
                    p.id === productId ? { ...p, departmental_account_subgroup_id: subgroupId } : p
                )
            );
            toast({ title: "Updated", description: "Departmental subgroup updated" });
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        }
    };

    // Inline update for category
    const updateProductCategory = async (productId: string, category: string | null) => {
        try {
            const { error } = await supabase
                .from("products")
                .update({ category })
                .eq("id", productId);

            if (error) throw error;

            setProducts((prev) =>
                prev.map((p) =>
                    p.id === productId ? { ...p, category } : p
                )
            );
            toast({ title: "Updated", description: "Category updated" });
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        }
    };

    // Get subgroups for a specific group
    const getSubgroupsForGroup = (groupId: string | null) => {
        if (!groupId) return [];
        return departmentalAccounts.filter((da) => da.level === 2 && da.parent_id === groupId);
    };

    // Get groups (level 1)
    const departmentalGroups = useMemo(() => {
        return departmentalAccounts.filter((da) => da.level === 1);
    }, [departmentalAccounts]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#1e1f21]">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#1e1f21] text-white">
            {/* Header */}
            <div className="border-b border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <Package className="h-6 w-6 text-blue-400" />
                        <h1 className="text-xl font-semibold">Products</h1>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-400 text-sm">
                            {stats.total} products • {stats.withMerged} with merged
                        </span>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-transparent border-gray-600 text-white hover:bg-gray-700"
                            onClick={() => openSidePanel(null)}
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Product
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-transparent border-gray-600 text-white hover:bg-gray-700"
                            onClick={async () => {
                                setSyncing(true);
                                try {
                                    const res = await fetch("/api/products/sync");
                                    const data = await res.json();
                                    if (data.success) {
                                        toast({
                                            title: "Sync completed",
                                            description: `${data.stats?.inserted || 0} new products imported`,
                                        });
                                        loadData();
                                    } else {
                                        throw new Error(data.error);
                                    }
                                } catch (error: any) {
                                    toast({
                                        title: "Sync error",
                                        description: error.message,
                                        variant: "destructive",
                                    });
                                } finally {
                                    setSyncing(false);
                                }
                            }}
                            disabled={syncing}
                        >
                            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
                            {syncing ? "Syncing..." : "Sync HubSpot"}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className={`bg-transparent border-gray-600 hover:bg-gray-700 ${selectedForMerge.length >= 2 ? "text-blue-400" : "text-gray-500"
                                }`}
                            onClick={() => {
                                if (selectedForMerge.length >= 2) {
                                    setMergeTarget(selectedForMerge[0].id);
                                    setIsMergeDialogOpen(true);
                                }
                            }}
                            disabled={selectedForMerge.length < 2}
                        >
                            <Merge className="h-4 w-4 mr-1" />
                            Merge ({selectedForMerge.length})
                        </Button>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 w-64 bg-transparent border-gray-600 text-white placeholder:text-gray-500"
                            />
                        </div>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-44 bg-transparent border-gray-600 text-white">
                                <Filter className="h-4 w-4 mr-1" />
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent className="z-[9999] bg-white border-gray-300 max-h-[350px]">
                                <SelectItem value="all" className="text-gray-900">All Categories</SelectItem>
                                {CATEGORIES.map((cat) => (
                                    <SelectItem key={cat} value={cat} className="text-gray-900">
                                        {cat}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowInactive(!showInactive)}
                            className={`bg-transparent border-gray-600 hover:bg-gray-700 ${showInactive ? "text-yellow-400" : "text-white"
                                }`}
                        >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            {showInactive ? "Hide Inactive" : "Show Inactive"}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Table Header */}
            <div className="sticky top-0 z-[5] bg-[#2a2b2d] border-b border-gray-700">
                <div className="flex items-center gap-1 px-4 py-2 text-[11px] text-gray-400 font-medium uppercase">
                    <div className="w-[30px] flex-shrink-0"></div>
                    <div className="w-[30px] flex-shrink-0"></div>
                    <div className="w-[100px] flex-shrink-0">Code</div>
                    <div className="w-[200px] flex-shrink-0">Name</div>
                    <div className="w-[130px] flex-shrink-0">Category</div>
                    <div className="w-[140px] flex-shrink-0">Financial Acc</div>
                    <div className="w-[150px] flex-shrink-0">Dept Group</div>
                    <div className="w-[150px] flex-shrink-0">Dept Subgroup</div>
                    <div className="w-[60px] flex-shrink-0">Scope</div>
                    <div className="w-[60px] flex-shrink-0">Status</div>
                </div>
            </div>

            {/* Content */}
            <div className="pb-20">
                {filteredProducts.map((product) => {
                    const children = getMergedChildren(product.id);
                    const hasChildren = children.length > 0;
                    const isExpanded = expandedProducts.has(product.id);

                    return (
                        <div key={product.id}>
                            {/* Main Product Row */}
                            <div
                                className={`flex items-center gap-1 px-4 py-2 border-b border-gray-800 hover:bg-gray-800/50 ${selectedForMerge.find((p) => p.id === product.id)
                                    ? "bg-blue-900/30"
                                    : ""
                                    }`}
                            >
                                {/* Checkbox for merge */}
                                <div className="w-[30px] flex-shrink-0">
                                    <input
                                        type="checkbox"
                                        className="rounded bg-gray-700 border-gray-600"
                                        checked={!!selectedForMerge.find((p) => p.id === product.id)}
                                        onChange={() => toggleMergeSelection(product)}
                                    />
                                </div>

                                {/* Edit button */}
                                <div className="w-[30px] flex-shrink-0">
                                    <button
                                        onClick={() => openSidePanel(product)}
                                        className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
                                    >
                                        <Edit className="h-3.5 w-3.5" />
                                    </button>
                                </div>

                                {/* Code */}
                                <div className="w-[100px] flex-shrink-0 flex items-center gap-1">
                                    {hasChildren && (
                                        <button
                                            onClick={() => toggleProductExpansion(product.id)}
                                            className="p-0.5 rounded hover:bg-gray-700"
                                        >
                                            {isExpanded ? (
                                                <ChevronDown className="h-3 w-3 text-gray-400" />
                                            ) : (
                                                <ChevronRight className="h-3 w-3 text-gray-400" />
                                            )}
                                        </button>
                                    )}
                                    <code className="text-[11px] text-gray-300">{product.code}</code>
                                    {hasChildren && (
                                        <Badge
                                            variant="outline"
                                            className="text-[9px] px-1 py-0 border-blue-500 text-blue-400"
                                        >
                                            +{children.length}
                                        </Badge>
                                    )}
                                </div>

                                {/* Name */}
                                <div className="w-[200px] flex-shrink-0">
                                    <div className="text-[12px] text-white truncate">{product.name}</div>
                                    {product.alternative_names?.length > 0 && (
                                        <div className="text-[10px] text-gray-500 truncate">
                                            aka: {product.alternative_names.slice(0, 2).join(", ")}
                                            {product.alternative_names.length > 2 && "..."}
                                        </div>
                                    )}
                                </div>

                                {/* Category - INLINE DROPDOWN */}
                                <div className="w-[130px] flex-shrink-0">
                                    <Select
                                        value={product.category || "none"}
                                        onValueChange={(v) => updateProductCategory(product.id, v === "none" ? null : v)}
                                    >
                                        <SelectTrigger className="h-7 text-[10px] bg-transparent border-gray-700 text-white hover:bg-gray-800">
                                            <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent className="z-[9999] bg-white border-gray-300 max-h-[300px]">
                                            <SelectItem value="none" className="text-gray-900">—</SelectItem>
                                            {CATEGORIES.map((cat) => (
                                                <SelectItem key={cat} value={cat} className="text-gray-900">
                                                    {cat}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Financial Account - INLINE DROPDOWN */}
                                <div className="w-[140px] flex-shrink-0">
                                    <Select
                                        value={product.financial_account_code || "none"}
                                        onValueChange={(v) => updateProductFinancialAccount(product.id, v === "none" ? null : v)}
                                    >
                                        <SelectTrigger className="h-7 text-[10px] bg-transparent border-gray-700 text-white hover:bg-gray-800">
                                            <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent className="z-[9999] bg-white border-gray-300">
                                            <SelectItem value="none" className="text-gray-900">—</SelectItem>
                                            {financialAccounts.map((fa) => (
                                                <SelectItem key={fa.code} value={fa.code} className="text-gray-900">
                                                    {fa.code} - {fa.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Departmental Group - INLINE DROPDOWN */}
                                <div className="w-[150px] flex-shrink-0">
                                    <Select
                                        value={product.departmental_account_group_id || "none"}
                                        onValueChange={(v) => updateProductDepartmentalGroup(product.id, v === "none" ? null : v)}
                                    >
                                        <SelectTrigger className="h-7 text-[10px] bg-transparent border-gray-700 text-white hover:bg-gray-800">
                                            <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent className="z-[9999] bg-white border-gray-300">
                                            <SelectItem value="none" className="text-gray-900">—</SelectItem>
                                            {departmentalGroups.map((da) => (
                                                <SelectItem key={da.id} value={da.id} className="text-gray-900">
                                                    {da.code} - {da.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Departmental Subgroup - INLINE DROPDOWN */}
                                <div className="w-[150px] flex-shrink-0">
                                    <Select
                                        value={product.departmental_account_subgroup_id || "none"}
                                        onValueChange={(v) => updateProductDepartmentalSubgroup(product.id, v === "none" ? null : v)}
                                        disabled={!product.departmental_account_group_id}
                                    >
                                        <SelectTrigger className={`h-7 text-[10px] bg-transparent border-gray-700 text-white hover:bg-gray-800 ${!product.departmental_account_group_id ? "opacity-50" : ""}`}>
                                            <SelectValue placeholder={product.departmental_account_group_id ? "Select..." : "—"} />
                                        </SelectTrigger>
                                        <SelectContent className="z-[9999] bg-white border-gray-300">
                                            <SelectItem value="none" className="text-gray-900">—</SelectItem>
                                            {getSubgroupsForGroup(product.departmental_account_group_id).map((da) => (
                                                <SelectItem key={da.id} value={da.id} className="text-gray-900">
                                                    {da.code} - {da.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Scope */}
                                <div className="w-[60px] flex-shrink-0">
                                    <Badge
                                        variant={product.scope === "GLOBAL" ? "default" : "outline"}
                                        className="text-[9px] px-1 py-0"
                                    >
                                        {product.scope}
                                    </Badge>
                                </div>

                                {/* Status */}
                                <div className="w-[60px] flex-shrink-0">
                                    {product.is_active ? (
                                        <span className="text-[9px] px-1 py-0.5 rounded bg-green-900/50 text-green-400">
                                            Active
                                        </span>
                                    ) : (
                                        <span className="text-[9px] px-1 py-0.5 rounded bg-red-900/50 text-red-400">
                                            Inactive
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Merged Children Rows */}
                            {hasChildren && isExpanded && (
                                <div className="bg-gray-900/30">
                                    {children.map((child) => (
                                        <div
                                            key={child.id}
                                            className="flex items-center gap-1 px-4 py-1.5 border-b border-gray-800/50 hover:bg-gray-800/30"
                                        >
                                            <div className="w-[30px] flex-shrink-0"></div>
                                            <div className="w-[30px] flex-shrink-0"></div>
                                            <div className="w-[100px] flex-shrink-0 pl-4">
                                                <code className="text-[10px] text-gray-500">{child.code}</code>
                                            </div>
                                            <div className="w-[200px] flex-shrink-0">
                                                <span className="text-[11px] text-gray-400 italic">
                                                    ↳ {child.name}
                                                </span>
                                                <Badge
                                                    variant="outline"
                                                    className="ml-2 text-[9px] px-1 py-0 border-orange-500 text-orange-400"
                                                >
                                                    merged
                                                </Badge>
                                            </div>
                                            <div className="w-[120px] flex-shrink-0">
                                                <span className="text-[10px] text-gray-500">
                                                    {child.category || "—"}
                                                </span>
                                            </div>
                                            <div className="w-[140px] flex-shrink-0"></div>
                                            <div className="w-[150px] flex-shrink-0"></div>
                                            <div className="w-[150px] flex-shrink-0"></div>
                                            <div className="w-[60px] flex-shrink-0"></div>
                                            <div className="w-[60px] flex-shrink-0">
                                                <span className="text-[9px] px-1 py-0.5 rounded bg-gray-800 text-gray-500">
                                                    Merged
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {filteredProducts.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        No products found
                    </div>
                )}
            </div>

            {/* Product Side Panel */}
            <ProductSidePanel
                open={sidePanelOpen}
                onClose={closeSidePanel}
                editingProduct={editingProduct}
                onSuccess={() => {
                    closeSidePanel();
                    loadData();
                }}
            />

            {/* Merge Dialog */}
            <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
                <DialogContent className="max-w-none max-h-[90vh] bg-[#2a2b2d] border-gray-700 text-white" style={{ width: '80vw' }}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-white">
                            <Merge className="h-5 w-5" />
                            Merge Products
                        </DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Select the main product. Others will be marked as &quot;merged&quot;
                            and their names added as alternatives.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div>
                            <Label className="text-gray-300 text-xs">
                                Selected products ({selectedForMerge.length})
                            </Label>
                            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                                {selectedForMerge.map((p) => (
                                    <div
                                        key={p.id}
                                        className={`flex items-center justify-between p-2 rounded border ${mergeTarget === p.id
                                            ? "border-blue-500 bg-blue-900/30"
                                            : "border-gray-600"
                                            }`}
                                    >
                                        <div>
                                            <div className="text-sm text-white">{p.name}</div>
                                            <div className="text-[10px] text-gray-500">{p.code}</div>
                                        </div>
                                        <Button
                                            variant={mergeTarget === p.id ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setMergeTarget(p.id)}
                                            className={
                                                mergeTarget === p.id
                                                    ? "bg-blue-600"
                                                    : "bg-transparent border-gray-600 text-white"
                                            }
                                        >
                                            {mergeTarget === p.id ? "Main" : "Set as Main"}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {mergeTarget && (
                            <div className="bg-blue-900/30 p-3 rounded-lg border border-blue-700">
                                <p className="text-sm text-blue-300">
                                    <strong>Result:</strong> {selectedForMerge.length - 1} product(s)
                                    will be merged into &quot;
                                    {products.find((p) => p.id === mergeTarget)?.name}&quot;
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsMergeDialogOpen(false);
                                setSelectedForMerge([]);
                                setMergeTarget("");
                            }}
                            className="bg-transparent border-gray-600 text-white hover:bg-gray-700"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleMerge}
                            disabled={selectedForMerge.length < 2 || !mergeTarget}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            Merge Products
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
