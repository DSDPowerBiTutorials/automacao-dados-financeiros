"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
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
import { Globe, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FinancialAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  level: number;
  parent_id?: string;
  parent_code?: string;
  scope: "ES" | "US" | "GLOBAL";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function FinancialAccountsPage() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"ES" | "US" | "GLOBAL" | "ALL">("ALL");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "Expense",
    level: 1,
    parent_id: "",
    scope: "GLOBAL" as "ES" | "US" | "GLOBAL",
    is_active: true,
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    filterAccounts();
  }, [accounts, searchTerm, scopeFilter]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("financial_accounts")
        .select("*")
        .order("code", { ascending: true });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error("Error loading financial accounts:", error);
      toast({
        title: "Error",
        description: "Failed to load financial accounts",
        variant: "destructive",
        
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAccounts = () => {
    let filtered = [...accounts];

    // Filter by scope
    if (scopeFilter !== "ALL") {
      filtered = filtered.filter((acc) => acc.scope === scopeFilter);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (acc) =>
          acc.code.toLowerCase().includes(term) ||
          acc.name.toLowerCase().includes(term)
      );
    }

    setFilteredAccounts(filtered);
  };

  const handleOpenDialog = (account?: FinancialAccount) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        code: account.code,
        name: account.name,
        type: account.type,
        level: account.level,
        parent_id: account.parent_id || "",
        scope: account.scope,
        is_active: account.is_active,
      });
    } else {
      setEditingAccount(null);
      setFormData({
        code: "",
        name: "",
        type: "Expense",
        level: 1,
        parent_id: "",
        scope: "GLOBAL",
        is_active: true,
      });
    }
    setIsDialogOpen(true);
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

      if (editingAccount) {
        // Update existing account
        const { error } = await supabase
          .from("financial_accounts")
          .update({
            code: formData.code,
            name: formData.name,
            type: formData.type,
            level: formData.level,
            parent_id: formData.parent_id || null,
            scope: formData.scope,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingAccount.id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Financial account updated successfully",
          
        });
      } else {
        // Create new account
        const { error } = await supabase.from("financial_accounts").insert([
          {
            code: formData.code,
            name: formData.name,
            type: formData.type,
            level: formData.level,
            parent_id: formData.parent_id || null,
            scope: formData.scope,
            is_active: formData.is_active,
          },
        ]);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Financial account created successfully",
          
        });
      }

      setIsDialogOpen(false);
      loadAccounts();
    } catch (error) {
      console.error("Error saving financial account:", error);
      toast({
        title: "Error",
        description: "Failed to save financial account",
        variant: "destructive",
        
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this account?")) return;

    try {
      const { error } = await supabase
        .from("financial_accounts")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({
        title: "Success",
        description: "Financial account deleted successfully",
        
      });
      loadAccounts();
    } catch (error) {
      console.error("Error deleting financial account:", error);
      toast({
        title: "Error",
        description: "Failed to delete financial account",
        variant: "destructive",
        
      });
    }
  };

  const getParentCode = (parentId?: string) => {
    if (!parentId) return "-";
    const parent = accounts.find((acc) => acc.id === parentId);
    return parent ? parent.code : "-";
  };

  return (
    <div className="min-h-full px-6 space-y-6 py-6">
      {/* Header */}
      <header className="page-header-standard">
        <div>
          <h1 className="header-title">Financial Accounts</h1>
          <p className="header-subtitle">
            Manage Chart of Accounts (hierarchical structure up to 5 levels)
          </p>
        </div>
        <Button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleOpenDialog();
          }} 
          className="bg-blue-600 hover:bg-blue-700"
          type="button"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Account
        </Button>
      </header>

      {/* Filters */}
      <Card className="p-3 rounded-xl border-gray-200 shadow-sm">
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Filter by Scope</Label>
            <div className="flex gap-2">
              <Button
                variant={scopeFilter === "ES" ? "default" : "outline"}
                size="sm"
                onClick={() => setScopeFilter("ES")}
                className="h-8 text-xs"
              >
                🇪🇸 ES
              </Button>
              <Button
                variant={scopeFilter === "US" ? "default" : "outline"}
                size="sm"
                onClick={() => setScopeFilter("US")}
                className="h-8 text-xs"
              >
                🇺🇸 US
              </Button>
              <Button
                variant={scopeFilter === "GLOBAL" ? "default" : "outline"}
                size="sm"
                onClick={() => setScopeFilter("GLOBAL")}
                className="bg-blue-500 hover:bg-blue-600 h-8 text-xs"
              >
                🌐 GLOBAL
              </Button>
              <Button
                variant={scopeFilter === "ALL" ? "default" : "outline"}
                size="sm"
                onClick={() => setScopeFilter("ALL")}
                className="h-8 text-xs"
              >
                All
              </Button>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              Spain, United States, All Countries
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search financial accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="rounded-xl border-gray-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="table-standard">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Scope
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Level
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Parent
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr key="loading">
                  <td colSpan={8} className="px-3 py-6 text-center text-gray-500 text-sm">
                    Loading...
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr key="empty">
                  <td colSpan={8} className="px-3 py-6 text-center text-gray-500 text-sm">
                    No accounts found
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <Globe className="h-4 w-4 text-blue-500" />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenDialog(account)}
                          className="text-gray-600 hover:text-blue-600"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(account.id)}
                          className="text-gray-600 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{account.code}</td>
                    <td className="px-3 py-2.5 text-sm">{account.name}</td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs">{account.type}</td>
                    <td className="px-3 py-2.5 text-center text-xs">{account.level}</td>
                    <td className="px-3 py-2.5 text-xs">{getParentCode(account.parent_id)}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={
                          account.is_active
                            ? "badge-light-success"
                            : "badge-light-secondary"
                        }
                      >
                        {account.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white">
          <DialogHeader className="border-b border-gray-200 pb-3">
            <DialogTitle className="text-xl font-semibold">
              {editingAccount ? "Edit Financial Account" : "New Financial Account"}
            </DialogTitle>
            <DialogDescription className="text-gray-500 text-xs">
              {editingAccount
                ? "Update the financial account details below"
                : "Create a new financial account with hierarchical structure"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="code" className="text-xs font-medium text-gray-700">
                  Code *
                </Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="201.0"
                  className="h-9 text-sm rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scope" className="text-xs font-medium text-gray-700">
                  Scope
                </Label>
                <Select
                  value={formData.scope}
                  onValueChange={(value: "ES" | "US" | "GLOBAL") =>
                    setFormData({ ...formData, scope: value })
                  }
                >
                  <SelectTrigger className="h-9 text-sm rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ES">🇪🇸 Spain</SelectItem>
                    <SelectItem value="US">🇺🇸 United States</SelectItem>
                    <SelectItem value="GLOBAL">🌐 Global</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium text-gray-700">
                Name *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Cost of Goods Sold"
                className="h-9 text-sm rounded-lg"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="type" className="text-xs font-medium text-gray-700">
                  Type
                </Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger className="h-9 text-sm rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asset">Asset</SelectItem>
                    <SelectItem value="Liability">Liability</SelectItem>
                    <SelectItem value="Equity">Equity</SelectItem>
                    <SelectItem value="Revenue">Revenue</SelectItem>
                    <SelectItem value="Expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="level" className="text-xs font-medium text-gray-700">
                  Level
                </Label>
                <Select
                  value={formData.level.toString()}
                  onValueChange={(value) =>
                    setFormData({ ...formData, level: parseInt(value) })
                  }
                >
                  <SelectTrigger className="h-9 text-sm rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="parent" className="text-xs font-medium text-gray-700">
                  Parent Account
                </Label>
                <Select
                  value={formData.parent_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, parent_id: value })
                  }
                >
                  <SelectTrigger className="h-9 text-sm rounded-lg">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {accounts
                      .filter((acc) => acc.level < formData.level)
                      .map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="h-3.5 w-3.5 rounded border-gray-300"
              />
              <Label htmlFor="is_active" className="text-xs font-medium text-gray-700 cursor-pointer">
                Active Account
              </Label>
            </div>
          </div>

          <DialogFooter className="border-t border-gray-200 pt-3 gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              className="px-4 h-9 text-sm rounded-lg"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              className="bg-blue-600 hover:bg-blue-700 px-4 h-9 text-sm rounded-lg"
            >
              {editingAccount ? "Update Account" : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
