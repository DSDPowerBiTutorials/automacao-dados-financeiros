"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ChevronRight, FolderTree, Pencil, Plus, Search, Trash2, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DepartmentalAccount {
    id: string;
    code: string;
    name: string;
    description: string | null;
    level: number;
    parent_id: string | null;
    full_path: string | null;
    scope: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    children?: DepartmentalAccount[];
}

export default function DepartmentalAccountsPage() {
    const [accounts, setAccounts] = useState<DepartmentalAccount[]>([]);
    const [flatAccounts, setFlatAccounts] = useState<DepartmentalAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [levelFilter, setLevelFilter] = useState<string>("all");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<DepartmentalAccount | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        code: "",
        name: "",
        description: "",
        level: 1,
        parent_id: "",
        scope: "GLOBAL",
        is_active: true,
    });

    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("departmental_accounts")
                .select("*")
                .order("code", { ascending: true });

            if (error) throw error;

            setFlatAccounts(data || []);

            // Build tree structure
            const tree = buildTree(data || []);
            setAccounts(tree);

            // Expand all groups by default
            const groupIds = (data || []).filter(a => a.level === 1).map(a => a.id);
            setExpandedGroups(new Set(groupIds));
        } catch (error) {
            console.error("Error loading departmental accounts:", error);
            toast({
                title: "Error",
                description: "Failed to load departmental accounts",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const buildTree = (flat: DepartmentalAccount[]): DepartmentalAccount[] => {
        const map = new Map<string, DepartmentalAccount>();
        const roots: DepartmentalAccount[] = [];

        flat.forEach(item => {
            map.set(item.id, { ...item, children: [] });
        });

        flat.forEach(item => {
            const node = map.get(item.id)!;
            if (item.parent_id && map.has(item.parent_id)) {
                const parent = map.get(item.parent_id)!;
                parent.children = parent.children || [];
                parent.children.push(node);
            } else {
                roots.push(node);
            }
        });

        return roots;
    };

    const filteredAccounts = useMemo(() => {
        let filtered = flatAccounts;

        if (levelFilter !== "all") {
            filtered = filtered.filter(a => a.level === parseInt(levelFilter));
        }

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(
                a =>
                    a.code.toLowerCase().includes(term) ||
                    a.name.toLowerCase().includes(term) ||
                    (a.full_path || "").toLowerCase().includes(term)
            );
        }

        return filtered;
    }, [flatAccounts, searchTerm, levelFilter]);

    const parentOptions = useMemo(() => {
        // Get potential parents (level 1 for level 2, level 2 for level 3)
        const targetLevel = formData.level - 1;
        if (targetLevel < 1) return [];
        return flatAccounts.filter(a => a.level === targetLevel && a.is_active);
    }, [flatAccounts, formData.level]);

    const handleOpenDialog = (account?: DepartmentalAccount) => {
        if (account) {
            setEditingAccount(account);
            setFormData({
                code: account.code,
                name: account.name,
                description: account.description || "",
                level: account.level,
                parent_id: account.parent_id || "",
                scope: account.scope || "GLOBAL",
                is_active: account.is_active,
            });
        } else {
            setEditingAccount(null);
            setFormData({
                code: "",
                name: "",
                description: "",
                level: 1,
                parent_id: "",
                scope: "GLOBAL",
                is_active: true,
            });
        }
        setIsDialogOpen(true);
    };

    const generateFullPath = (parentId: string | null, name: string): string => {
        if (!parentId) return name;
        const parent = flatAccounts.find(a => a.id === parentId);
        if (!parent) return name;
        return `${parent.full_path || parent.name} > ${name}`;
    };

    const handleSave = async () => {
        try {
            if (!formData.code.trim() || !formData.name.trim()) {
                toast({
                    title: "Validation Error",
                    description: "Code and Name are required",
                    variant: "destructive",
                });
                return;
            }

            const fullPath = generateFullPath(formData.parent_id || null, formData.name.trim());

            const dataToSave = {
                code: formData.code.trim(),
                name: formData.name.trim(),
                description: formData.description.trim() || null,
                level: formData.level,
                parent_id: formData.parent_id || null,
                full_path: fullPath,
                scope: formData.scope,
                is_active: formData.is_active,
            };

            if (editingAccount) {
                const { error } = await supabase
                    .from("departmental_accounts")
                    .update({ ...dataToSave, updated_at: new Date().toISOString() })
                    .eq("id", editingAccount.id);

                if (error) throw error;
                toast({ title: "Success", description: "Departmental account updated successfully" });
            } else {
                const { error } = await supabase.from("departmental_accounts").insert([dataToSave]);
                if (error) throw error;
                toast({ title: "Success", description: "Departmental account created successfully" });
            }

            setIsDialogOpen(false);
            loadAccounts();
        } catch (error: unknown) {
            console.error("Error saving departmental account:", error);
            const errorMessage = error instanceof Error ? error.message : "Failed to save departmental account";
            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive",
            });
        }
    };

    const handleDelete = async (id: string) => {
        // Check if has children
        const hasChildren = flatAccounts.some(a => a.parent_id === id);
        if (hasChildren) {
            toast({
                title: "Cannot Delete",
                description: "This account has sub-accounts. Delete them first.",
                variant: "destructive",
            });
            return;
        }

        if (!confirm("Are you sure you want to delete this departmental account?")) return;

        try {
            const { error } = await supabase.from("departmental_accounts").delete().eq("id", id);
            if (error) throw error;
            toast({ title: "Success", description: "Departmental account deleted successfully" });
            loadAccounts();
        } catch (error) {
            console.error("Error deleting departmental account:", error);
            toast({
                title: "Error",
                description: "Failed to delete departmental account",
                variant: "destructive",
            });
        }
    };

    const toggleGroup = (id: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const getLevelBadge = (level: number) => {
        switch (level) {
            case 1:
                return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Group</Badge>;
            case 2:
                return <Badge className="bg-green-100 text-green-800 border-green-200">Subgroup</Badge>;
            case 3:
                return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Account</Badge>;
            default:
                return <Badge variant="outline">Level {level}</Badge>;
        }
    };

    const renderTreeRow = (account: DepartmentalAccount, depth: number = 0) => {
        const hasChildren = account.children && account.children.length > 0;
        const isExpanded = expandedGroups.has(account.id);

        return (
            <>
                <TableRow key={account.id} className="hover:bg-gray-50">
                    <TableCell className="font-mono text-sm" style={{ paddingLeft: `${16 + depth * 24}px` }}>
                        <div className="flex items-center gap-2">
                            {hasChildren ? (
                                <button onClick={() => toggleGroup(account.id)} className="hover:bg-gray-200 rounded p-0.5">
                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                            ) : (
                                <span className="w-5" />
                            )}
                            {account.code}
                        </div>
                    </TableCell>
                    <TableCell>{account.name}</TableCell>
                    <TableCell>{getLevelBadge(account.level)}</TableCell>
                    <TableCell className="text-gray-500 text-sm max-w-xs truncate">
                        {account.full_path || account.name}
                    </TableCell>
                    <TableCell>
                        <Badge variant={account.is_active ? "default" : "secondary"}>
                            {account.is_active ? "Active" : "Inactive"}
                        </Badge>
                    </TableCell>
                    <TableCell>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleOpenDialog(account)}
                                className="text-gray-600 hover:text-blue-600"
                            >
                                <Pencil className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => handleDelete(account.id)}
                                className="text-gray-600 hover:text-red-600"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </TableCell>
                </TableRow>
                {hasChildren && isExpanded && account.children!.map(child => renderTreeRow(child, depth + 1))}
            </>
        );
    };

    // Stats
    const stats = useMemo(() => ({
        total: flatAccounts.length,
        groups: flatAccounts.filter(a => a.level === 1).length,
        subgroups: flatAccounts.filter(a => a.level === 2).length,
        accounts: flatAccounts.filter(a => a.level === 3).length,
        active: flatAccounts.filter(a => a.is_active).length,
    }), [flatAccounts]);

    return (
        <div className="min-h-full px-6 space-y-6 py-6">
            <header className="page-header-standard">
                <div>
                    <h1 className="header-title">Departmental Accounts</h1>
                    <p className="header-subtitle">Manage organizational structure for revenue allocation</p>
                </div>
                <Button
                    onClick={() => handleOpenDialog()}
                    className="bg-blue-600 hover:bg-blue-700"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    New Account
                </Button>
            </header>

            {/* Stats Cards */}
            <div className="grid grid-cols-5 gap-4">
                <Card className="p-4">
                    <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                    <div className="text-sm text-gray-500">Total Accounts</div>
                </Card>
                <Card className="p-4">
                    <div className="text-2xl font-bold text-blue-600">{stats.groups}</div>
                    <div className="text-sm text-gray-500">Groups</div>
                </Card>
                <Card className="p-4">
                    <div className="text-2xl font-bold text-green-600">{stats.subgroups}</div>
                    <div className="text-sm text-gray-500">Subgroups</div>
                </Card>
                <Card className="p-4">
                    <div className="text-2xl font-bold text-purple-600">{stats.accounts}</div>
                    <div className="text-sm text-gray-500">Accounts</div>
                </Card>
                <Card className="p-4">
                    <div className="text-2xl font-bold text-emerald-600">{stats.active}</div>
                    <div className="text-sm text-gray-500">Active</div>
                </Card>
            </div>

            {/* Filters */}
            <Card className="p-4">
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <Label className="text-sm font-medium mb-2 block">Search</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <Input
                                type="text"
                                placeholder="Search by code, name, or path..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                    <div className="w-48">
                        <Label className="text-sm font-medium mb-2 block">Filter by Level</Label>
                        <Select value={levelFilter} onValueChange={setLevelFilter}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Levels</SelectItem>
                                <SelectItem value="1">Groups Only</SelectItem>
                                <SelectItem value="2">Subgroups Only</SelectItem>
                                <SelectItem value="3">Accounts Only</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </Card>

            {/* Table */}
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50">
                            <TableHead className="w-48">Code</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="w-32">Level</TableHead>
                            <TableHead>Full Path</TableHead>
                            <TableHead className="w-24">Status</TableHead>
                            <TableHead className="w-24">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                    Loading...
                                </TableCell>
                            </TableRow>
                        ) : searchTerm || levelFilter !== "all" ? (
                            // Flat view when filtering
                            filteredAccounts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                        No departmental accounts found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredAccounts.map(account => (
                                    <TableRow key={account.id} className="hover:bg-gray-50">
                                        <TableCell className="font-mono text-sm">{account.code}</TableCell>
                                        <TableCell>{account.name}</TableCell>
                                        <TableCell>{getLevelBadge(account.level)}</TableCell>
                                        <TableCell className="text-gray-500 text-sm max-w-xs truncate">
                                            {account.full_path || account.name}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={account.is_active ? "default" : "secondary"}>
                                                {account.is_active ? "Active" : "Inactive"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleOpenDialog(account)}
                                                    className="text-gray-600 hover:text-blue-600"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(account.id)}
                                                    className="text-gray-600 hover:text-red-600"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )
                        ) : (
                            // Tree view
                            accounts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                        No departmental accounts found. Run the migration to create the initial structure.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                accounts.map(account => renderTreeRow(account, 0))
                            )
                        )}
                    </TableBody>
                </Table>
            </Card>

            {/* Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-none max-h-[90vh] bg-white" style={{ width: '80vw' }}>
                    <DialogHeader className="border-b pb-4">
                        <DialogTitle className="text-xl font-semibold">
                            {editingAccount ? "Edit Departmental Account" : "New Departmental Account"}
                        </DialogTitle>
                        <DialogDescription className="text-gray-500">
                            {editingAccount ? "Update account details" : "Create a new departmental account"}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="code">Code *</Label>
                                <Input
                                    id="code"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    placeholder="e.g., DEP-EDU"
                                    disabled={!!editingAccount}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="level">Level *</Label>
                                <Select
                                    value={formData.level.toString()}
                                    onValueChange={(value) => setFormData({ ...formData, level: parseInt(value), parent_id: "" })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">1 - Group</SelectItem>
                                        <SelectItem value="2">2 - Subgroup</SelectItem>
                                        <SelectItem value="3">3 - Account</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Account name"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Input
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Optional description"
                            />
                        </div>

                        {formData.level > 1 && (
                            <div className="space-y-2">
                                <Label htmlFor="parent_id">Parent {formData.level === 2 ? "Group" : "Subgroup"} *</Label>
                                <Select
                                    value={formData.parent_id}
                                    onValueChange={(value) => setFormData({ ...formData, parent_id: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select parent..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {parentOptions.map(option => (
                                            <SelectItem key={option.id} value={option.id}>
                                                {option.code} - {option.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="scope">Scope</Label>
                                <Select
                                    value={formData.scope}
                                    onValueChange={(value) => setFormData({ ...formData, scope: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="GLOBAL">🌐 Global</SelectItem>
                                        <SelectItem value="ES">🇪🇸 Spain</SelectItem>
                                        <SelectItem value="US">🇺🇸 United States</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="h-4 w-4 rounded border-gray-300"
                                    />
                                    <Label htmlFor="is_active" className="cursor-pointer">Active</Label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="border-t pt-4 gap-3">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                            {editingAccount ? "Update" : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
