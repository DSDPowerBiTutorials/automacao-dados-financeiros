"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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

    // Dialog states
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
    const [selectedForMerge, setSelectedForMerge] = useState<Product[]>([]);
    const [mergeTarget, setMergeTarget] = useState<string>("");
    const [syncing, setSyncing] = useState(false);

    // Form state
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

            // Load financial accounts
            const { data: faData } = await supabase
                .from("financial_accounts")
                .select("id, code, name, scope")
                .eq("is_active", true)
                .order("code");
            setFinancialAccounts(faData || []);

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

    const resetForm = () => {
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
        setEditingProduct(null);
    };

    const openEditDialog = (product: Product) => {
        setEditingProduct(product);
        setFormData({
            code: product.code,
            name: product.name,
            description: product.description || "",
            default_price: product.default_price?.toString() || "",
            currency: product.currency,
            financial_account_id: product.financial_account_id || "",
            departmental_account_group_id: product.departmental_account_group_id || "",
            departmental_account_subgroup_id: product.departmental_account_subgroup_id || "",
            category: product.category || "",
            product_type: product.product_type,
            scope: product.scope,
            is_active: product.is_active,
            alternative_names: product.alternative_names?.join(", ") || "",
        });
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        try {
            if (!formData.name.trim()) {
                toast({
                    title: "Error",
                    description: "Name is required",
                    variant: "destructive",
                });
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

            setIsDialogOpen(false);
            resetForm();
            loadData();
        } catch (error: any) {
            console.error("Error saving product:", error);
            toast({
                title: "Error",
                description: error.message || "Error saving product",
                variant: "destructive",
            });
        }
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
                            onClick={() => {
                                resetForm();
                                setIsDialogOpen(true);
                            }}
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
                            <SelectTrigger className="w-40 bg-transparent border-gray-600 text-white">
                                <Filter className="h-4 w-4 mr-1" />
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {CATEGORIES.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
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
            <div className="sticky top-0 z-10 bg-[#2a2b2d] border-b border-gray-700">
                <div className="flex items-center gap-1 px-4 py-2 text-[11px] text-gray-400 font-medium uppercase">
                    <div className="w-[30px] flex-shrink-0"></div>
                    <div className="w-[30px] flex-shrink-0"></div>
                    <div className="w-[100px] flex-shrink-0">Code</div>
                    <div className="w-[250px] flex-shrink-0">Name</div>
                    <div className="w-[120px] flex-shrink-0">Category</div>
                    <div className="w-[100px] flex-shrink-0">Financial Acc</div>
                    <div className="w-[180px] flex-shrink-0">Departmental</div>
                    <div className="w-[80px] flex-shrink-0">Scope</div>
                    <div className="w-[80px] flex-shrink-0">Status</div>
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
                                        onClick={() => openEditDialog(product)}
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
                                <div className="w-[250px] flex-shrink-0">
                                    <div className="text-[12px] text-white truncate">{product.name}</div>
                                    {product.alternative_names?.length > 0 && (
                                        <div className="text-[10px] text-gray-500 truncate">
                                            aka: {product.alternative_names.slice(0, 2).join(", ")}
                                            {product.alternative_names.length > 2 && "..."}
                                        </div>
                                    )}
                                </div>

                                {/* Category */}
                                <div className="w-[120px] flex-shrink-0">
                                    <span className="text-[11px] text-gray-300">
                                        {product.category || "—"}
                                    </span>
                                </div>

                                {/* Financial Account */}
                                <div className="w-[100px] flex-shrink-0">
                                    {getFinancialAccountDisplay(product) !== "—" ? (
                                        <Badge
                                            variant="outline"
                                            className="text-[10px] px-1 py-0 border-green-600 text-green-400"
                                        >
                                            {getFinancialAccountDisplay(product)}
                                        </Badge>
                                    ) : (
                                        <span className="text-[11px] text-gray-500">—</span>
                                    )}
                                </div>

                                {/* Departmental */}
                                <div className="w-[180px] flex-shrink-0">
                                    <span className="text-[11px] text-gray-300 truncate block">
                                        {getDepartmentalDisplay(product)}
                                    </span>
                                </div>

                                {/* Scope */}
                                <div className="w-[80px] flex-shrink-0">
                                    <Badge
                                        variant={product.scope === "GLOBAL" ? "default" : "outline"}
                                        className="text-[10px] px-1 py-0"
                                    >
                                        {product.scope}
                                    </Badge>
                                </div>

                                {/* Status */}
                                <div className="w-[80px] flex-shrink-0">
                                    {product.is_active ? (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/50 text-green-400">
                                            Active
                                        </span>
                                    ) : (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/50 text-red-400">
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
                                            <div className="w-[250px] flex-shrink-0">
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
                                            <div className="w-[100px] flex-shrink-0"></div>
                                            <div className="w-[180px] flex-shrink-0"></div>
                                            <div className="w-[80px] flex-shrink-0"></div>
                                            <div className="w-[80px] flex-shrink-0">
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

            {/* Product Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="w-[900px] max-w-[95vw] max-h-[85vh] overflow-y-auto bg-[#1e1f21] border-gray-600 text-white p-8">
                    <DialogHeader className="mb-6">
                        <DialogTitle className="text-white text-xl">
                            {editingProduct ? "Edit Product" : "New Product"}
                        </DialogTitle>
                        <DialogDescription className="text-gray-400 text-sm">
                            Fill in the product data. Fields with * are required.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6">
                        {/* Row 1: Code and Name */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="code" className="text-gray-300 text-sm font-medium">
                                    Code
                                </Label>
                                <Input
                                    id="code"
                                    value={formData.code}
                                    onChange={(e) =>
                                        setFormData({ ...formData, code: e.target.value })
                                    }
                                    placeholder="Auto-generated if empty"
                                    className="bg-gray-800 border-gray-600 text-white h-10"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-gray-300 text-sm font-medium">
                                    Name *
                                </Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name: e.target.value })
                                    }
                                    placeholder="Product name"
                                    className="bg-gray-800 border-gray-600 text-white h-10"
                                />
                            </div>
                        </div>

                        {/* Row 2: Description */}
                        <div className="space-y-2">
                            <Label htmlFor="description" className="text-gray-300 text-sm font-medium">
                                Description
                            </Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData({ ...formData, description: e.target.value })
                                }
                                placeholder="Product description"
                                rows={3}
                                className="bg-gray-800 border-gray-600 text-white resize-none"
                            />
                        </div>

                        {/* Row 3: Currency, Type, Scope */}
                        <div className="grid grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="currency" className="text-gray-300 text-sm font-medium">
                                    Currency
                                </Label>
                                <Select
                                    value={formData.currency}
                                    onValueChange={(v) =>
                                        setFormData({ ...formData, currency: v })
                                    }
                                >
                                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white h-10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="EUR">EUR</SelectItem>
                                        <SelectItem value="USD">USD</SelectItem>
                                        <SelectItem value="GBP">GBP</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="product_type" className="text-gray-300 text-sm font-medium">
                                    Type
                                </Label>
                                <Select
                                    value={formData.product_type}
                                    onValueChange={(v) =>
                                        setFormData({ ...formData, product_type: v })
                                    }
                                >
                                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white h-10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PRODUCT_TYPES.map((t) => (
                                            <SelectItem key={t.value} value={t.value}>
                                                {t.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="scope" className="text-gray-300 text-sm font-medium">
                                    Scope
                                </Label>
                                <Select
                                    value={formData.scope}
                                    onValueChange={(v) =>
                                        setFormData({ ...formData, scope: v })
                                    }
                                >
                                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white h-10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SCOPES.map((s) => (
                                            <SelectItem key={s.value} value={s.value}>
                                                {s.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Row 4: Category and Financial Account */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="category" className="text-gray-300 text-sm font-medium">
                                    Category
                                </Label>
                                <Select
                                    value={formData.category}
                                    onValueChange={(v) =>
                                        setFormData({ ...formData, category: v })
                                    }
                                >
                                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white h-10">
                                        <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map((cat) => (
                                            <SelectItem key={cat} value={cat}>
                                                {cat}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="financial_account" className="text-gray-300 text-sm font-medium">
                                    Financial Account
                                </Label>
                                <Select
                                    value={formData.financial_account_id}
                                    onValueChange={(v) =>
                                        setFormData({ ...formData, financial_account_id: v === "none" ? "" : v })
                                    }
                                >
                                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white h-10">
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

                        {/* Row 5: Departmental Accounts */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="departmental_group" className="text-gray-300 text-sm font-medium">
                                    Departmental Group
                                </Label>
                                <Select
                                    value={formData.departmental_account_group_id}
                                    onValueChange={(v) =>
                                        setFormData({
                                            ...formData,
                                            departmental_account_group_id: v === "none" ? "" : v,
                                            departmental_account_subgroup_id: "",
                                        })
                                    }
                                >
                                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white h-10">
                                        <SelectValue placeholder="Select group..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {departmentalAccounts
                                            .filter((da) => da.level === 1)
                                            .map((da) => (
                                                <SelectItem key={da.id} value={da.id}>
                                                    {da.code} - {da.name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="departmental_subgroup" className="text-gray-300 text-sm font-medium">
                                    Departmental Subgroup
                                </Label>
                                <Select
                                    value={formData.departmental_account_subgroup_id}
                                    onValueChange={(v) =>
                                        setFormData({
                                            ...formData,
                                            departmental_account_subgroup_id: v === "none" ? "" : v,
                                        })
                                    }
                                    disabled={!formData.departmental_account_group_id}
                                >
                                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white h-10">
                                        <SelectValue
                                            placeholder={
                                                formData.departmental_account_group_id
                                                    ? "Select subgroup..."
                                                    : "Select group first"
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {departmentalAccounts
                                            .filter(
                                                (da) =>
                                                    da.level === 2 &&
                                                    da.parent_id === formData.departmental_account_group_id
                                            )
                                            .map((da) => (
                                                <SelectItem key={da.id} value={da.id}>
                                                    {da.code} - {da.name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Row 6: Alternative Names */}
                        <div className="space-y-2">
                            <Label htmlFor="alternative_names" className="text-gray-300 text-sm font-medium">
                                Alternative Names (comma separated)
                            </Label>
                            <Input
                                id="alternative_names"
                                value={formData.alternative_names}
                                onChange={(e) =>
                                    setFormData({ ...formData, alternative_names: e.target.value })
                                }
                                placeholder="Name 1, Name 2, Name 3..."
                                className="bg-gray-800 border-gray-600 text-white h-10"
                            />
                            <p className="text-xs text-gray-500">
                                Use to map name variations, typos, etc.
                            </p>
                        </div>

                        {/* Row 7: Active checkbox */}
                        <div className="flex items-center gap-3 pt-2">
                            <input
                                type="checkbox"
                                id="is_active"
                                checked={formData.is_active}
                                onChange={(e) =>
                                    setFormData({ ...formData, is_active: e.target.checked })
                                }
                                className="rounded bg-gray-700 border-gray-600 h-5 w-5"
                            />
                            <Label htmlFor="is_active" className="cursor-pointer text-gray-300 text-sm">
                                Active product
                            </Label>
                        </div>
                    </div>

                    <DialogFooter className="mt-6 pt-4 border-t border-gray-700">
                        <Button
                            variant="outline"
                            onClick={() => setIsDialogOpen(false)}
                            className="bg-transparent border-gray-600 text-white hover:bg-gray-700 h-10 px-6"
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 h-10 px-6">
                            {editingProduct ? "Save Changes" : "Create Product"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Merge Dialog */}
            <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
                <DialogContent className="max-w-lg bg-[#2a2b2d] border-gray-700 text-white">
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
