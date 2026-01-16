"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Package,
    Plus,
    Edit,
    Trash2,
    Search,
    Merge,
    CheckCircle,
    XCircle,
    RefreshCw,
    DollarSign,
    Building,
    Tag,
    Globe,
    AlertTriangle,
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

interface CostCenter {
    id: string;
    code: string;
    name: string;
}

const DEPARTMENTS = [
    "Education",
    "Marketing",
    "Sales",
    "Operations",
    "Technology",
    "Support",
    "Finance",
    "HR",
];

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
    const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([]);
    const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [scopeFilter, setScopeFilter] = useState("all");
    const [showInactive, setShowInactive] = useState(false);

    // Dialog states
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
    const [selectedForMerge, setSelectedForMerge] = useState<Product[]>([]);
    const [mergeTarget, setMergeTarget] = useState<string>("");
    const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
    const [syncing, setSyncing] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        code: "",
        name: "",
        description: "",
        default_price: "",
        currency: "EUR",
        financial_account_id: "",
        department: "",
        cost_center_id: "",
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
            // Load products
            const { data: productsData, error: productsError } = await supabase
                .from("products")
                .select("*")
                .is("merged_into_id", null) // Don't show merged products
                .order("name");

            if (productsError) throw productsError;
            setProducts(productsData || []);

            // Load financial accounts
            const { data: faData } = await supabase
                .from("financial_accounts")
                .select("id, code, name, scope")
                .eq("is_active", true)
                .order("code");
            setFinancialAccounts(faData || []);

            // Load cost centers
            const { data: ccData } = await supabase
                .from("cost_centers")
                .select("id, code, name")
                .eq("is_active", true)
                .order("code");
            setCostCenters(ccData || []);
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

    // Filtered products
    const filteredProducts = useMemo(() => {
        return products.filter((p) => {
            if (!showInactive && !p.is_active) return false;
            if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
            if (scopeFilter !== "all" && p.scope !== scopeFilter) return false;
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                return (
                    p.name.toLowerCase().includes(search) ||
                    p.code.toLowerCase().includes(search) ||
                    p.description?.toLowerCase().includes(search) ||
                    p.alternative_names?.some((n) => n.toLowerCase().includes(search))
                );
            }
            return true;
        });
    }, [products, searchTerm, categoryFilter, scopeFilter, showInactive]);

    // Detect potential duplicates
    const potentialDuplicates = useMemo(() => {
        const duplicates: { product: Product; similar: Product[] }[] = [];
        products.forEach((p, i) => {
            const similar = products.filter((other, j) => {
                if (i >= j) return false; // Avoid duplicates
                const nameYesilar = p.name.toLowerCase().includes(other.name.toLowerCase().substring(0, 5)) ||
                    other.name.toLowerCase().includes(p.name.toLowerCase().substring(0, 5));
                const priceYesilar = p.default_price && other.default_price &&
                    Math.abs(p.default_price - other.default_price) < 100;
                return nameYesilar || priceYesilar;
            });
            if (similar.length > 0) {
                duplicates.push({ product: p, similar });
            }
        });
        return duplicates;
    }, [products]);

    const resetForm = () => {
        setFormData({
            code: "",
            name: "",
            description: "",
            default_price: "",
            currency: "EUR",
            financial_account_id: "",
            department: "",
            cost_center_id: "",
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
            department: product.department || "",
            cost_center_id: product.cost_center_id || "",
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
            const cc = costCenters.find((c) => c.id === formData.cost_center_id);

            const productData = {
                code,
                name: formData.name.trim(),
                description: formData.description.trim() || null,
                default_price: formData.default_price ? parseFloat(formData.default_price) : null,
                currency: formData.currency,
                financial_account_id: formData.financial_account_id || null,
                financial_account_code: fa?.code || null,
                department: formData.department || null,
                cost_center_id: formData.cost_center_id || null,
                cost_center_code: cc?.code || null,
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

    const handleDelete = async () => {
        if (!deleteConfirm) return;

        try {
            const { error } = await supabase
                .from("products")
                .delete()
                .eq("id", deleteConfirm.id);

            if (error) throw error;
            toast({ title: "Success", description: "Product deleted" });
            setDeleteConfirm(null);
            loadData();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Error deleting product",
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
                // Create merge record
                await supabase.from("product_merges").insert({
                    source_product_id: product.id,
                    source_product_name: product.name,
                    source_product_code: product.code,
                    target_product_id: mergeTarget,
                    notes: `Merged into ${targetProduct.name}`,
                });

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

    const formatCurrency = (value: number | null, currency = "EUR") => {
        if (value === null) return "—";
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency,
        }).format(value);
    };

    // Stats
    const stats = useMemo(() => {
        const active = products.filter((p) => p.is_active).length;
        const withPrice = products.filter((p) => p.default_price && p.default_price > 0).length;
        const withFA = products.filter((p) => p.financial_account_id).length;
        return { total: products.length, active, withPrice, withFA };
    }, [products]);

    if (loading) {
        return (
            <div className="min-h-full px-6 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Loading products...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full px-6 py-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <header className="page-header-standard">
                    <h1 className="header-title flex items-center gap-3">
                        <Package className="h-8 w-8 text-blue-600" />
                        Products
                    </h1>
                    <p className="header-subtitle">
                        Manage DSD products - registration, unification and financial association
                    </p>
                </header>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={async () => {
                            setSyncing(true);
                            try {
                                const res = await fetch("/api/products/sync");
                                const data = await res.json();
                                if (data.success) {
                                    toast({
                                        title: "Sync completed",
                                        description: `${data.stats.inserted} novos produtos importados do HubSpot`,
                                    });
                                    if (data.stats.inserted > 0) loadData();
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
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                        {syncing ? "Syncing..." : "Sync HubSpot"}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setSelectedForMerge([]);
                            setIsMergeDialogOpen(true);
                        }}
                        disabled={selectedForMerge.length < 2}
                        className="gap-2"
                    >
                        <Merge className="h-4 w-4" />
                        Merge ({selectedForMerge.length})
                    </Button>
                    <Button
                        onClick={() => {
                            resetForm();
                            setIsDialogOpen(true);
                        }}
                        className="gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        New Product
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-2 rounded-lg">
                                <Package className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Total</p>
                                <p className="text-2xl font-bold">{stats.total}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-green-100 p-2 rounded-lg">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Active</p>
                                <p className="text-2xl font-bold">{stats.active}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-purple-100 p-2 rounded-lg">
                                <DollarSign className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">With Price</p>
                                <p className="text-2xl font-bold">{stats.withPrice}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-orange-100 p-2 rounded-lg">
                                <Building className="h-5 w-5 text-orange-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">With Financial Account</p>
                                <p className="text-2xl font-bold">{stats.withFA}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Duplicates Warning */}
            {potentialDuplicates.length > 0 && (
                <Card className="border-orange-200 bg-orange-50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-orange-700 flex items-center gap-2 text-lg">
                            <AlertTriangle className="h-5 w-5" />
                            Possible Duplicates Detected
                        </CardTitle>
                        <CardDescription className="text-orange-600">
                            {potentialDuplicates.length} group(s) of similar products found.
                            Consider merging them.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {potentialDuplicates.slice(0, 5).map(({ product, similar }) => (
                                <Badge
                                    key={product.id}
                                    variant="outline"
                                    className="bg-white cursor-pointer hover:bg-orange-100"
                                    onClick={() => {
                                        setSelectedForMerge([product, ...similar]);
                                        setMergeTarget(product.id);
                                        setIsMergeDialogOpen(true);
                                    }}
                                >
                                    {product.name} + {similar.length} similar
                                </Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="md:col-span-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search by name, code..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <div>
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger>
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
                        </div>
                        <div>
                            <Select value={scopeFilter} onValueChange={setScopeFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Scope" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Scopes</SelectItem>
                                    {SCOPES.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>
                                            {s.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="showInactive"
                                checked={showInactive}
                                onChange={(e) => setShowInactive(e.target.checked)}
                                className="rounded"
                            />
                            <Label htmlFor="showInactive" className="text-sm cursor-pointer">
                                Show inactive
                            </Label>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Products Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">
                        Products ({filteredProducts.length})
                    </CardTitle>
                    <CardDescription>
                        Select products to merge by clicking the checkbox
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table className="table-standard">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">
                                        <input
                                            type="checkbox"
                                            className="rounded"
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedForMerge(filteredProducts.slice(0, 10));
                                                } else {
                                                    setSelectedForMerge([]);
                                                }
                                            }}
                                        />
                                    </TableHead>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Price</TableHead>
                                    <TableHead>Financial Account</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Scope</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProducts.map((product) => (
                                    <TableRow
                                        key={product.id}
                                        className={
                                            selectedForMerge.find((p) => p.id === product.id)
                                                ? "bg-blue-50"
                                                : ""
                                        }
                                    >
                                        <TableCell>
                                            <input
                                                type="checkbox"
                                                className="rounded"
                                                checked={!!selectedForMerge.find((p) => p.id === product.id)}
                                                onChange={() => toggleMergeSelection(product)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <code className="text-xs bg-gray-100 px-1 rounded">
                                                {product.code}
                                            </code>
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{product.name}</div>
                                                {product.alternative_names?.length > 0 && (
                                                    <div className="text-xs text-gray-500">
                                                        aka: {product.alternative_names.slice(0, 2).join(", ")}
                                                        {product.alternative_names.length > 2 && "..."}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{product.category || "—"}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {formatCurrency(product.default_price, product.currency)}
                                        </TableCell>
                                        <TableCell>
                                            {product.financial_account_code ? (
                                                <Badge variant="secondary">
                                                    {product.financial_account_code}
                                                </Badge>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{product.department || "—"}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    product.scope === "GLOBAL"
                                                        ? "default"
                                                        : "outline"
                                                }
                                            >
                                                {product.scope}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {product.is_active ? (
                                                <span className="badge-light-success">
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="badge-light-danger">Inactive</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => openEditDialog(product)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-600 hover:text-red-700"
                                                    onClick={() => setDeleteConfirm(product)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredProducts.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                                            No products found
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Product Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingProduct ? "Edit Product" : "New Product"}
                        </DialogTitle>
                        <DialogDescription>
                            Fill in the product data. Fields with * are required.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="code">Code</Label>
                                <Input
                                    id="code"
                                    value={formData.code}
                                    onChange={(e) =>
                                        setFormData({ ...formData, code: e.target.value })
                                    }
                                    placeholder="Auto-gerado se vazio"
                                />
                            </div>
                            <div>
                                <Label htmlFor="name">Name *</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name: e.target.value })
                                    }
                                    placeholder="Product name"
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData({ ...formData, description: e.target.value })
                                }
                                placeholder="Product description"
                                rows={2}
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label htmlFor="default_price">Default Price</Label>
                                <Input
                                    id="default_price"
                                    type="number"
                                    step="0.01"
                                    value={formData.default_price}
                                    onChange={(e) =>
                                        setFormData({ ...formData, default_price: e.target.value })
                                    }
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <Label htmlFor="currency">Currency</Label>
                                <Select
                                    value={formData.currency}
                                    onValueChange={(v) =>
                                        setFormData({ ...formData, currency: v })
                                    }
                                >
                                    <SelectTrigger>
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
                                <Label htmlFor="product_type">Type</Label>
                                <Select
                                    value={formData.product_type}
                                    onValueChange={(v) =>
                                        setFormData({ ...formData, product_type: v })
                                    }
                                >
                                    <SelectTrigger>
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
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="category">Category</Label>
                                <Select
                                    value={formData.category}
                                    onValueChange={(v) =>
                                        setFormData({ ...formData, category: v })
                                    }
                                >
                                    <SelectTrigger>
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
                            <div>
                                <Label htmlFor="scope">Scope</Label>
                                <Select
                                    value={formData.scope}
                                    onValueChange={(v) =>
                                        setFormData({ ...formData, scope: v })
                                    }
                                >
                                    <SelectTrigger>
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

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="financial_account">Financial Account</Label>
                                <Select
                                    value={formData.financial_account_id}
                                    onValueChange={(v) =>
                                        setFormData({ ...formData, financial_account_id: v })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">None</SelectItem>
                                        {financialAccounts.map((fa) => (
                                            <SelectItem key={fa.id} value={fa.id}>
                                                {fa.code} - {fa.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="department">Department</Label>
                                <Select
                                    value={formData.department}
                                    onValueChange={(v) =>
                                        setFormData({ ...formData, department: v })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">None</SelectItem>
                                        {DEPARTMENTS.map((d) => (
                                            <SelectItem key={d} value={d}>
                                                {d}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="cost_center">Cost Center</Label>
                            <Select
                                value={formData.cost_center_id}
                                onValueChange={(v) =>
                                    setFormData({ ...formData, cost_center_id: v })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">None</SelectItem>
                                    {costCenters.map((cc) => (
                                        <SelectItem key={cc.id} value={cc.id}>
                                            {cc.code} - {cc.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="alternative_names">
                                Alternative Names (comma separated)
                            </Label>
                            <Input
                                id="alternative_names"
                                value={formData.alternative_names}
                                onChange={(e) =>
                                    setFormData({ ...formData, alternative_names: e.target.value })
                                }
                                placeholder="Name 1, Name 2, Name 3..."
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Use to map name variations, typos, etc.
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="is_active"
                                checked={formData.is_active}
                                onChange={(e) =>
                                    setFormData({ ...formData, is_active: e.target.checked })
                                }
                                className="rounded"
                            />
                            <Label htmlFor="is_active" className="cursor-pointer">
                                Produto ativo
                            </Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave}>
                            {editingProduct ? "Save" : "Criar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Merge Dialog */}
            <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Merge className="h-5 w-5" />
                            Unificar Produtos
                        </DialogTitle>
                        <DialogDescription>
                            Select the main product. Others will be marked as
                            &quot;merged&quot; e seus nomes adicionados como alternativos.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div>
                            <Label>Produtos selecionados ({selectedForMerge.length})</Label>
                            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                                {selectedForMerge.map((p) => (
                                    <div
                                        key={p.id}
                                        className={`flex items-center justify-between p-2 rounded border ${mergeTarget === p.id
                                            ? "border-blue-500 bg-blue-50"
                                            : "border-gray-200"
                                            }`}
                                    >
                                        <div>
                                            <div className="font-medium">{p.name}</div>
                                            <div className="text-xs text-gray-500">{p.code}</div>
                                        </div>
                                        <Button
                                            variant={mergeTarget === p.id ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setMergeTarget(p.id)}
                                        >
                                            {mergeTarget === p.id ? "Principal" : "Definir"}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {mergeTarget && (
                            <div className="bg-blue-50 p-3 rounded-lg">
                                <p className="text-sm text-blue-700">
                                    <strong>Result:</strong> Os {selectedForMerge.length - 1}{" "}
                                    product(s) will be merged into &quot;
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
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleMerge}
                            disabled={selectedForMerge.length < 2 || !mergeTarget}
                        >
                            Unificar Produtos
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Product</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir o produto &quot;{deleteConfirm?.name}
                            &quot;? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={handleDelete}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
