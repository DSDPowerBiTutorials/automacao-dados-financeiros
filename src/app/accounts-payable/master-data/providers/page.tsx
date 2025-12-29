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

interface Provider {
  code: string;
  name: string;
  provider_type?: string;
  country?: string;
  currency?: string;
  payment_terms?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [filteredProviders, setFilteredProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"ES" | "US" | "ALL">("ALL");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    provider_type: "professional_services",
    country: "ES",
    currency: "EUR",
    payment_terms: "net_30",
    is_active: true,
  });

  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    filterProviders();
  }, [providers, searchTerm, scopeFilter]);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("providers")
        .select("*")
        .order("code", { ascending: true });

      if (error) throw error;
      setProviders(data || []);
    } catch (error) {
      console.error("Error loading providers:", error);
      toast({
        title: "Error",
        description: "Failed to load providers",
        variant: "destructive",
        className: "bg-white"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterProviders = () => {
    let filtered = [...providers];

    if (scopeFilter !== "ALL") {
      filtered = filtered.filter((p) => p.country === scopeFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.code.toLowerCase().includes(term) ||
          p.name.toLowerCase().includes(term)
      );
    }

    setFilteredProviders(filtered);
  };

  const handleOpenDialog = (provider?: Provider) => {
    if (provider) {
      setEditingProvider(provider);
      setFormData({
        code: provider.code,
        name: provider.name,
        provider_type: provider.provider_type || "professional_services",
        country: provider.country || "ES",
        currency: provider.currency || "EUR",
        payment_terms: provider.payment_terms || "net_30",
        is_active: provider.is_active,
      });
    } else {
      setEditingProvider(null);
      setFormData({
        code: "",
        name: "",
        provider_type: "professional_services",
        country: "ES",
        currency: "EUR",
        payment_terms: "net_30",
        is_active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      // For new providers, generate automatic code if empty
      let finalCode = formData.code ? formData.code.trim() : "";

      if (!editingProvider && !finalCode) {
        // Generate automatic sequential code based on country
        const { data: maxCodeData, error: queryError } = await supabase
          .from("providers")
          .select("code")
          .like("code", `${formData.country}-PV%`)
          .order("code", { ascending: false })
          .limit(1);

        if (queryError) {
          console.error("Error querying max code:", queryError);
          throw queryError;
        }

        let nextNumber = 1;
        if (maxCodeData && maxCodeData.length > 0 && maxCodeData[0].code) {
          const lastCode = maxCodeData[0].code;
          const match = lastCode.match(/-PV(\d+)$/);
          if (match) {
            nextNumber = parseInt(match[1]) + 1;
          }
        }

        finalCode = `${formData.country}-PV${String(nextNumber).padStart(5, '0')}`;
        console.log("Generated code:", finalCode);
      }

      if (!finalCode || !formData.name.trim()) {
        toast({
          title: "Validation Error",
          description: "Name is required",
          variant: "destructive",
          className: "bg-white"
        });
        return;
      }

      if (editingProvider) {
        const { error } = await supabase
          .from("providers")
          .update({
            name: formData.name,
            provider_type: formData.provider_type,
            country: formData.country,
            currency: formData.currency,
            payment_terms: formData.payment_terms,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("code", editingProvider.code);

        if (error) {
          console.error("Update error:", error);
          throw error;
        }
        toast({ title: "Success", description: "Provider updated successfully", className: "bg-white" });
      } else {
        const insertData = {
          code: finalCode,
          name: formData.name,
          provider_type: formData.provider_type,
          country: formData.country,
          currency: formData.currency,
          payment_terms: formData.payment_terms,
          is_active: formData.is_active
        };
        console.log("Inserting provider:", insertData);

        const { data, error } = await supabase.from("providers").insert([insertData]).select();

        if (error) {
          console.error("Insert error:", error);
          throw error;
        }
        console.log("Insert success:", data);
        toast({ title: "Success", description: "Provider created successfully", className: "bg-white" });
      }

      setIsDialogOpen(false);
      loadProviders();
    } catch (error: any) {
      console.error("Error saving provider:", error);
      const errorMessage = error?.message || error?.error_description || "Failed to save provider";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
        className: "bg-white"
      });
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm("Are you sure you want to delete this provider?")) return;

    try {
      const { error } = await supabase.from("providers").delete().eq("code", code);
      if (error) throw error;
      toast({ title: "Success", description: "Provider deleted successfully", className: "bg-white" });
      loadProviders();
    } catch (error) {
      console.error("Error deleting provider:", error);
      toast({
        title: "Error",
        description: "Failed to delete provider",
        variant: "destructive",
        className: "bg-white"
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Providers</h1>
          <p className="text-gray-500 mt-1">
            Manage supplier and vendor master data
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
          New Provider
        </Button>
      </div>

      <Card className="p-4">
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Filter by Scope</Label>
            <div className="flex gap-2">
              <Button
                variant={scopeFilter === "ES" ? "default" : "outline"}
                size="sm"
                onClick={() => setScopeFilter("ES")}
              >
                🇪🇸 ES
              </Button>
              <Button
                variant={scopeFilter === "US" ? "default" : "outline"}
                size="sm"
                onClick={() => setScopeFilter("US")}
              >
                🇺🇸 US
              </Button>
              <Button
                variant={scopeFilter === "GLOBAL" ? "default" : "outline"}
                size="sm"
                onClick={() => setScopeFilter("GLOBAL")}
              >
                🌐 GLOBAL
              </Button>
              <Button
                variant={scopeFilter === "ALL" ? "default" : "outline"}
                size="sm"
                onClick={() => setScopeFilter("ALL")}
              >
                All
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search providers..."
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scope</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tax ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Terms</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr key="loading">
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading...</td>
                </tr>
              ) : filteredProviders.length === 0 ? (
                <tr key="empty">
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No providers found</td>
                </tr>
              ) : (
                filteredProviders.map((provider, index) => (
                  <tr key={`provider-${provider.code}-${index}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Globe className="h-5 w-5 text-blue-500" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenDialog(provider)}
                          className="text-gray-600 hover:text-blue-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(provider.code)}
                          className="text-gray-600 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{provider.code}</td>
                    <td className="px-4 py-3">{provider.name}</td>
                    <td className="px-4 py-3 text-gray-600">{provider.country || "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{provider.currency || "-"}</td>
                    <td className="px-4 py-3">{provider.payment_terms || "-"}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={provider.is_active ? "default" : "secondary"}
                        className={provider.is_active ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                      >
                        {provider.is_active ? "Active" : "Inactive"}
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
              {editingProvider ? "Edit Provider" : "New Provider"}
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              {editingProvider ? "Update provider details" : "Create a new provider with auto-generated code"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-6">
            {editingProvider && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-blue-700">Provider Code:</span>
                  <span className="font-mono text-sm font-semibold text-blue-900">{formData.code}</span>
                </div>
              </div>
            )}

            {!editingProvider && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-green-700">Code will be auto-generated:</span>
                  <span className="font-mono text-sm font-semibold text-green-900">{formData.country}-PV#####</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6">
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
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="tax_id" className="text-sm font-medium text-gray-700">Tax ID</Label>
                <Input
                  id="tax_id"
                  value={formData.tax_id}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_terms" className="text-sm font-medium text-gray-700">Payment Terms</Label>
                <Select
                  value={formData.payment_terms}
                  onValueChange={(value) => setFormData({ ...formData, payment_terms: value })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NET15">NET15</SelectItem>
                    <SelectItem value="NET30">NET30</SelectItem>
                    <SelectItem value="NET45">NET45</SelectItem>
                    <SelectItem value="NET60">NET60</SelectItem>
                    <SelectItem value="DUE_ON_RECEIPT">Due on Receipt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium text-gray-700">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="text-sm font-medium text-gray-700">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="city" className="text-sm font-medium text-gray-700">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country" className="text-sm font-medium text-gray-700">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
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
              <Label htmlFor="is_active" className="text-sm font-medium text-gray-700 cursor-pointer">Active Provider</Label>
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
              {editingProvider ? "Update Provider" : "Create Provider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
