"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Globe,
  Pencil,
  Plus,
  Search,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  Building2,
  X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Provider {
  code: string;
  name: string;
  provider_type?: string;
  tax_id?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  currency?: string;
  payment_terms?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export default function ProvidersPage() {
  const searchParams = useSearchParams();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [scopeFilter, setScopeFilter] = useState<string>("ALL");
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    provider_type: "professional_services",
    tax_id: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "ES",
    currency: "EUR",
    payment_terms: "net_30",
    is_active: true,
    notes: "",
  });

  const OPTIONAL_PROVIDER_COLUMNS = [
    "provider_type",
    "tax_id",
    "email",
    "phone",
    "address",
    "city",
    "country",
    "currency",
    "payment_terms",
    "notes",
    "updated_at",
  ] as const;

  const isMissingProviderColumnError = (err: any, column: string) => {
    const message = `${err?.message || ""} ${err?.details || ""} ${err?.hint || ""}`.toLowerCase();
    return (
      message.includes("providers") &&
      message.includes(column) &&
      (
        message.includes("schema cache") ||
        message.includes("could not find") ||
        message.includes("column")
      )
    );
  };

  const getMissingOptionalProviderColumns = (err: any) => {
    return OPTIONAL_PROVIDER_COLUMNS.filter((column) => isMissingProviderColumnError(err, column));
  };

  const stripMissingColumnsAndRetry = async (
    mode: "insert" | "update",
    initialPayload: Record<string, any>,
    providerCodeForUpdate?: string
  ) => {
    const payload = { ...initialPayload };

    for (let attempt = 0; attempt <= OPTIONAL_PROVIDER_COLUMNS.length; attempt++) {
      if (mode === "insert") {
        const { error } = await supabase.from("providers").insert(payload);

        if (!error) return null;

        const missingColumns = getMissingOptionalProviderColumns(error);
        if (missingColumns.length === 0) return error;

        missingColumns.forEach((column) => {
          delete payload[column];
        });
      } else {
        const { error } = await supabase
          .from("providers")
          .update(payload)
          .eq("code", providerCodeForUpdate || "");

        if (!error) return null;

        const missingColumns = getMissingOptionalProviderColumns(error);
        if (missingColumns.length === 0) return error;

        missingColumns.forEach((column) => {
          delete payload[column];
        });
      }
    }

    return { message: "Falha ao salvar provider após fallback de colunas." } as any;
  };

  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    if (searchParams.get("openCreate") === "1") {
      handleOpenForm();
    }
  }, [searchParams]);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("providers")
        .select("*")
        .order("code", { ascending: true });
      if (error) throw error;
      setProviders(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to load providers", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredProviders = useMemo(() => {
    let filtered = [...providers];
    if (scopeFilter !== "ALL") {
      filtered = filtered.filter((p) => p.country === scopeFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.code.toLowerCase().includes(term) ||
          p.name.toLowerCase().includes(term) ||
          p.email?.toLowerCase().includes(term) ||
          p.tax_id?.toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [providers, searchTerm, scopeFilter]);

  const handleOpenForm = (provider?: Provider) => {
    if (provider) {
      setEditingProvider(provider);
      setFormData({
        code: provider.code,
        name: provider.name,
        provider_type: provider.provider_type || "professional_services",
        tax_id: provider.tax_id || "",
        email: provider.email || "",
        phone: provider.phone || "",
        address: provider.address || "",
        city: provider.city || "",
        country: provider.country || "ES",
        currency: provider.currency || "EUR",
        payment_terms: provider.payment_terms || "net_30",
        is_active: provider.is_active,
        notes: provider.notes || "",
      });
    } else {
      setEditingProvider(null);
      setFormData({
        code: "",
        name: "",
        provider_type: "professional_services",
        tax_id: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        country: "ES",
        currency: "EUR",
        payment_terms: "net_30",
        is_active: true,
        notes: "",
      });
    }
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    try {
      let finalCode = formData.code ? formData.code.trim() : "";

      if (!editingProvider && !finalCode) {
        const { data: maxCodeData } = await supabase
          .from("providers")
          .select("code")
          .like("code", `${formData.country}-PV%`)
          .order("code", { ascending: false })
          .limit(1);

        let nextNumber = 1;
        if (maxCodeData && maxCodeData.length > 0) {
          const match = maxCodeData[0].code.match(/-PV(\d+)$/);
          if (match) nextNumber = parseInt(match[1]) + 1;
        }
        finalCode = `${formData.country}-PV${String(nextNumber).padStart(5, "0")}`;
      }

      if (!finalCode || !formData.name.trim()) {
        toast({ title: "Validation Error", description: "Name is required", variant: "destructive" });
        return;
      }

      if (editingProvider) {
        const updatePayload: Record<string, any> = {
          name: formData.name,
          provider_type: formData.provider_type,
          tax_id: formData.tax_id || null,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          city: formData.city || null,
          country: formData.country,
          currency: formData.currency,
          payment_terms: formData.payment_terms,
          is_active: formData.is_active,
          notes: formData.notes || null,
          updated_at: new Date().toISOString(),
        };

        const error = await stripMissingColumnsAndRetry("update", updatePayload, editingProvider.code);

        if (error) throw error;
        toast({ title: "Provider updated successfully" });
      } else {
        const insertPayload: Record<string, any> = {
          code: finalCode,
          name: formData.name,
          provider_type: formData.provider_type,
          tax_id: formData.tax_id || null,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          city: formData.city || null,
          country: formData.country,
          currency: formData.currency,
          payment_terms: formData.payment_terms,
          is_active: formData.is_active,
          notes: formData.notes || null,
        };

        const error = await stripMissingColumnsAndRetry("insert", insertPayload);

        if (error) throw error;
        toast({ title: "Provider created successfully" });
      }
      setIsFormOpen(false);
      loadProviders();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm("Are you sure you want to delete this provider?")) return;
    try {
      const { error } = await supabase.from("providers").delete().eq("code", code);
      if (error) throw error;
      toast({ title: "Provider deleted successfully" });
      loadProviders();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-gray-900 dark:text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-blue-400" />
            <h1 className="text-xl font-semibold">Providers</h1>
            <span className="text-gray-500 dark:text-gray-400">•</span>
            <span className="text-gray-500 dark:text-gray-400 text-sm">Manage supplier and vendor master data</span>
          </div>
          <Button
            onClick={() => handleOpenForm()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-1" />
            New Provider
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {["ALL", "ES", "US", "GLOBAL"].map((scope) => (
              <button
                key={scope}
                onClick={() => setScopeFilter(scope)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${scopeFilter === scope
                  ? "bg-blue-600 text-white"
                  : "bg-transparent border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111111]"
                  }`}
              >
                {scope === "ES" ? "🇪🇸 ES" : scope === "US" ? "🇺🇸 US" : scope === "GLOBAL" ? "🌐 Global" : "All"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
              <Input
                placeholder="Search providers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-500"
              />
            </div>
            <span className="text-gray-500 dark:text-gray-400 text-sm">{filteredProviders.length} providers</span>
          </div>
        </div>
      </div>

      {/* Table Header */}
      <div className="sticky top-0 z-10 bg-gray-50 dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1 px-4 py-2 text-[11px] text-gray-500 dark:text-gray-400 font-medium uppercase">
          <div className="w-[40px] flex-shrink-0"></div>
          <div className="w-[50px] flex-shrink-0">Actions</div>
          <div className="w-[120px] flex-shrink-0">Code</div>
          <div className="flex-1 min-w-[180px]">Name</div>
          <div className="w-[100px] flex-shrink-0">Tax ID</div>
          <div className="w-[180px] flex-shrink-0">Email</div>
          <div className="w-[80px] flex-shrink-0">Country</div>
          <div className="w-[80px] flex-shrink-0">Currency</div>
          <div className="w-[100px] flex-shrink-0">Pay Terms</div>
          <div className="w-[80px] flex-shrink-0">Status</div>
        </div>
      </div>

      {/* Table Body */}
      <div className="pb-20">
        {filteredProviders.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">No providers found</p>
            <p className="text-sm mt-1">Add your first provider to get started</p>
          </div>
        ) : (
          filteredProviders.map((provider) => (
            <div
              key={provider.code}
              className="flex items-center gap-1 px-4 py-2 hover:bg-gray-50 dark:bg-black/30 border-b border-gray-200 dark:border-gray-800/50 group cursor-pointer"
              onClick={() => handleOpenForm(provider)}
            >
              <div className="w-[40px] flex-shrink-0">
                <Globe className="h-4 w-4 text-blue-400" />
              </div>
              <div className="w-[50px] flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <div className="flex gap-1">
                  <button onClick={() => handleOpenForm(provider)} className="text-gray-500 hover:text-blue-400 transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(provider.code)} className="text-gray-500 hover:text-red-400 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="w-[120px] flex-shrink-0">
                <span className="font-mono text-[12px] text-gray-700 dark:text-gray-300">{provider.code}</span>
              </div>
              <div className="flex-1 min-w-[180px]">
                <span className="text-[13px] text-gray-900 dark:text-white font-medium">{provider.name}</span>
              </div>
              <div className="w-[100px] flex-shrink-0">
                <span className="text-[12px] text-gray-500 dark:text-gray-400">{provider.tax_id || "\u2014"}</span>
              </div>
              <div className="w-[180px] flex-shrink-0">
                <span className="text-[12px] text-gray-500 dark:text-gray-400 truncate block">{provider.email || "\u2014"}</span>
              </div>
              <div className="w-[80px] flex-shrink-0">
                <span className="text-[11px] px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                  {provider.country || "\u2014"}
                </span>
              </div>
              <div className="w-[80px] flex-shrink-0">
                <span className="text-[12px] text-gray-500 dark:text-gray-400">{provider.currency || "\u2014"}</span>
              </div>
              <div className="w-[100px] flex-shrink-0">
                <span className="text-[12px] text-gray-500 dark:text-gray-400">{provider.payment_terms?.replace(/_/g, " ") || "\u2014"}</span>
              </div>
              <div className="w-[80px] flex-shrink-0">
                {provider.is_active ? (
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
          ))
        )}
      </div>

      {/* Side Panel Form */}
      {isFormOpen && (
        <div className="fixed right-0 top-0 h-full w-[500px] bg-white dark:bg-black border-l border-gray-200 dark:border-gray-700 flex flex-col z-[1040] shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingProvider ? "Edit Provider" : "New Provider"}
              </h2>
              {editingProvider && <span className="text-xs font-mono text-blue-400">{editingProvider.code}</span>}
              {!editingProvider && <span className="text-xs text-green-400">Code will be auto-generated</span>}
            </div>
            <button onClick={() => setIsFormOpen(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-gray-500 dark:text-gray-400 uppercase font-medium">Name *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="bg-gray-50 dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white h-9" placeholder="Provider name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-gray-500 dark:text-gray-400 uppercase font-medium">Country</Label>
                <select value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} className="w-full h-9 px-3 rounded-md bg-gray-50 dark:bg-[#0a0a0a] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm">
                  <option value="ES" className="bg-gray-100 dark:bg-black">Spain</option>
                  <option value="US" className="bg-gray-100 dark:bg-black">United States</option>
                  <option value="PT" className="bg-gray-100 dark:bg-black">Portugal</option>
                  <option value="FR" className="bg-gray-100 dark:bg-black">France</option>
                  <option value="DE" className="bg-gray-100 dark:bg-black">Germany</option>
                  <option value="GB" className="bg-gray-100 dark:bg-black">United Kingdom</option>
                  <option value="GLOBAL" className="bg-gray-100 dark:bg-black">Global</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-gray-500 dark:text-gray-400 uppercase font-medium">Currency</Label>
                <select value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} className="w-full h-9 px-3 rounded-md bg-gray-50 dark:bg-[#0a0a0a] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm">
                  <option value="EUR" className="bg-gray-100 dark:bg-black">EUR</option>
                  <option value="USD" className="bg-gray-100 dark:bg-black">USD</option>
                  <option value="GBP" className="bg-gray-100 dark:bg-black">GBP</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-gray-500 dark:text-gray-400 uppercase font-medium">Tax ID</Label>
                <Input value={formData.tax_id} onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })} className="bg-gray-50 dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white h-9" placeholder="B12345678" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-gray-500 dark:text-gray-400 uppercase font-medium">Payment Terms</Label>
                <select value={formData.payment_terms} onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })} className="w-full h-9 px-3 rounded-md bg-gray-50 dark:bg-[#0a0a0a] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm">
                  <option value="immediate" className="bg-gray-100 dark:bg-black">Immediate</option>
                  <option value="net_15" className="bg-gray-100 dark:bg-black">Net 15</option>
                  <option value="net_30" className="bg-gray-100 dark:bg-black">Net 30</option>
                  <option value="net_45" className="bg-gray-100 dark:bg-black">Net 45</option>
                  <option value="net_60" className="bg-gray-100 dark:bg-black">Net 60</option>
                  <option value="net_90" className="bg-gray-100 dark:bg-black">Net 90</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-gray-500 dark:text-gray-400 uppercase font-medium">Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="bg-gray-50 dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white h-9" placeholder="provider@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-gray-500 dark:text-gray-400 uppercase font-medium">Phone</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="bg-gray-50 dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white h-9" placeholder="+34 123 456 789" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-gray-500 dark:text-gray-400 uppercase font-medium">Address</Label>
              <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="bg-gray-50 dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white h-9" placeholder="Street address" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-gray-500 dark:text-gray-400 uppercase font-medium">City</Label>
              <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="bg-gray-50 dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white h-9" placeholder="Madrid" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-gray-500 dark:text-gray-400 uppercase font-medium">Provider Type</Label>
              <select value={formData.provider_type} onChange={(e) => setFormData({ ...formData, provider_type: e.target.value })} className="w-full h-9 px-3 rounded-md bg-gray-50 dark:bg-[#0a0a0a] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm">
                <option value="professional_services" className="bg-gray-100 dark:bg-black">Professional Services</option>
                <option value="software" className="bg-gray-100 dark:bg-black">Software</option>
                <option value="supplies" className="bg-gray-100 dark:bg-black">Supplies</option>
                <option value="utilities" className="bg-gray-100 dark:bg-black">Utilities</option>
                <option value="rent" className="bg-gray-100 dark:bg-black">Rent</option>
                <option value="other" className="bg-gray-100 dark:bg-black">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-gray-500 dark:text-gray-400 uppercase font-medium">Notes</Label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-3 py-2 rounded-md bg-gray-50 dark:bg-[#0a0a0a] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm min-h-[60px] resize-none placeholder:text-gray-500" placeholder="Additional notes..." />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="is_active" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="h-4 w-4 rounded border-gray-300 dark:border-gray-600" />
              <Label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">Active Provider</Label>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center gap-3 justify-end">
            <Button variant="outline" onClick={() => setIsFormOpen(false)} className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111111]">Cancel</Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">{editingProvider ? "Update Provider" : "Create Provider"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
