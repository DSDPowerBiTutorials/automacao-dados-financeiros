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
import { useGlobalScope } from "@/contexts/global-scope-context";

interface BankAccount {
  id: string;
  code: string;
  name: string;
  bank_name: string;
  account_number: string;
  iban?: string;
  swift_bic?: string;
  currency: string;
  country: "ES" | "US";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function BankAccountsPage() {
  const { selectedScope } = useGlobalScope();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [countryFilter, setCountryFilter] = useState<"ES" | "US" | "ALL">("ALL");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    bank_name: "",
    account_number: "",
    iban: "",
    swift_bic: "",
    currency: "EUR",
    country: "ES" as "ES" | "US",
    is_active: true,
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    filterAccounts();
  }, [accounts, searchTerm, countryFilter, selectedScope]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .order("code", { ascending: true });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error("Error loading bank accounts:", error);
      toast({
        title: "Error",
        description: "Failed to load bank accounts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAccounts = () => {
    let filtered = [...accounts];

    // Apply GlobalScopeContext filter first
    if (selectedScope !== "GLOBAL") {
      filtered = filtered.filter((acc) => acc.country === selectedScope);
    }

    // Then apply manual country filter
    if (countryFilter !== "ALL") {
      filtered = filtered.filter((acc) => acc.country === countryFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (acc) =>
          acc.code.toLowerCase().includes(term) ||
          acc.name.toLowerCase().includes(term) ||
          acc.bank_name.toLowerCase().includes(term) ||
          acc.account_number.toLowerCase().includes(term)
      );
    }

    setFilteredAccounts(filtered);
  };

  const handleOpenDialog = (account?: BankAccount) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        code: account.code,
        name: account.name,
        bank_name: account.bank_name,
        account_number: account.account_number,
        iban: account.iban || "",
        swift_bic: account.swift_bic || "",
        currency: account.currency,
        country: account.country,
        is_active: account.is_active,
      });
    } else {
      setEditingAccount(null);
      setFormData({
        code: "",
        name: "",
        bank_name: "",
        account_number: "",
        iban: "",
        swift_bic: "",
        currency: "EUR",
        country: selectedScope === "GLOBAL" ? "ES" : selectedScope,
        is_active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.code.trim() || !formData.name.trim() || !formData.bank_name.trim()) {
        toast({
          title: "Validation Error",
          description: "Code, Name and Bank Name are required",
          variant: "destructive",
        });
        return;
      }

      // Prepare data object with only the fields that exist in the database
      const dataToSave = {
        code: formData.code.trim(),
        name: formData.name.trim(),
        bank_name: formData.bank_name.trim(),
        account_number: formData.account_number.trim(),
        iban: formData.iban.trim() || null,
        swift_bic: formData.swift_bic.trim() || null,
        currency: formData.currency,
        country: formData.country,
        is_active: formData.is_active,
      };

      if (editingAccount) {
        const { error } = await supabase
          .from("bank_accounts")
          .update({ ...dataToSave, updated_at: new Date().toISOString() })
          .eq("id", editingAccount.id);

        if (error) {
          console.error("Supabase error details:", error);
          throw new Error(error.message || "Failed to update bank account");
        }
        toast({ title: "Success", description: "Bank account updated successfully" });
      } else {
        const { error } = await supabase
          .from("bank_accounts")
          .insert([{ ...dataToSave, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
        
        if (error) {
          console.error("Supabase error details:", error);
          throw new Error(error.message || "Failed to create bank account");
        }
        toast({ title: "Success", description: "Bank account created successfully" });
      }

      setIsDialogOpen(false);
      loadAccounts();
    } catch (error: any) {
      console.error("Error saving bank account:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save bank account",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this bank account?")) return;

    try {
      const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Bank account deleted successfully" });
      loadAccounts();
    } catch (error) {
      console.error("Error deleting bank account:", error);
      toast({
        title: "Error",
        description: "Failed to delete bank account",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bank Accounts</h1>
          <p className="text-gray-500 mt-1">Manage company bank accounts and payment methods</p>
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
          New Bank Account
        </Button>
      </div>

      <Card className="p-4">
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Current View: {selectedScope === "GLOBAL" ? "🌐 All Countries" : selectedScope === "ES" ? "🇪🇸 Spain" : "🇺🇸 United States"}</Label>
            <Label className="text-sm font-medium mb-2 block">Additional Filter by Country</Label>
            <div className="flex gap-2">
              <Button
                variant={countryFilter === "ES" ? "default" : "outline"}
                size="sm"
                onClick={() => setCountryFilter("ES")}
              >
                🇪🇸 Spain
              </Button>
              <Button
                variant={countryFilter === "US" ? "default" : "outline"}
                size="sm"
                onClick={() => setCountryFilter("US")}
              >
                🇺🇸 United States
              </Button>
              <Button
                variant={countryFilter === "ALL" ? "default" : "outline"}
                size="sm"
                onClick={() => setCountryFilter("ALL")}
              >
                All
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search bank accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bank Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Currency</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr key="loading">
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading...</td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr key="empty">
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No bank accounts found</td>
                </tr>
              ) : (
                filteredAccounts.map((account, index) => (
                  <tr key={`bank-account-${account.code}-${index}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-semibold">
                        {account.country === "ES" ? "🇪🇸 ES" : "🇺🇸 US"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
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
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{account.code}</td>
                    <td className="px-4 py-3">{account.name}</td>
                    <td className="px-4 py-3 text-gray-600">{account.bank_name}</td>
                    <td className="px-4 py-3 font-mono text-sm">{account.account_number}</td>
                    <td className="px-4 py-3">{account.currency}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={account.is_active ? "default" : "secondary"}
                        className={account.is_active ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                      >
                        {account.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-2xl font-semibold">
              {editingAccount ? "Edit Bank Account" : "New Bank Account"}
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              {editingAccount ? "Update bank account details" : "Create a new bank account"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-sm font-medium text-gray-700">Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scope" className="text-sm font-medium text-gray-700">Scope</Label>
                <Select
                  value={formData.scope}
                  onValueChange={(value: "ES" | "US" | "GLOBAL") =>
                    setFormData({ ...formData, scope: value })
                  }
                >
                  <SelectTrigger className="h-11">
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

            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">Account Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="bank_name" className="text-sm font-medium text-gray-700">Bank Name *</Label>
                <Input
                  id="bank_name"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country" className="text-sm font-medium text-gray-700">Country/Headquarters *</Label>
                <Select
                  value={formData.country}
                  onValueChange={(value: "ES" | "US") => setFormData({ ...formData, country: value })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ES">🇪🇸 Spain (ES)</SelectItem>
                    <SelectItem value="US">🇺🇸 United States (US)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="currency" className="text-sm font-medium text-gray-700">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger className="h-11">
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
                <Label htmlFor="account_number" className="text-sm font-medium text-gray-700">Account Number</Label>
                <Input
                  id="account_number"
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  className="h-11"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="iban" className="text-sm font-medium text-gray-700">IBAN</Label>
                <Input
                  id="iban"
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="swift_bic" className="text-sm font-medium text-gray-700">SWIFT/BIC</Label>
                <Input
                  id="swift_bic"
                  value={formData.swift_bic}
                  onChange={(e) => setFormData({ ...formData, swift_bic: e.target.value })}
                  className="h-11"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="is_active" className="text-sm font-medium text-gray-700 cursor-pointer">Active Bank Account</Label>
            </div>
          </div>

          <DialogFooter className="border-t pt-4 gap-3">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="px-6 h-11"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 px-6 h-11"
            >
              {editingAccount ? "Update Bank Account" : "Create Bank Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
