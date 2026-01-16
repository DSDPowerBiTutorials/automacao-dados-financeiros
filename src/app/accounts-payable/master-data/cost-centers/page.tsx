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

interface CostCenter {
  code: string;
  name: string;
  level?: number;
  parent_code?: string | null;
  country_code?: string;
  applies_to_all_countries?: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function CostCentersPage() {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [filteredCostCenters, setFilteredCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"ES" | "US" | "ALL">("ALL");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCostCenter, setEditingCostCenter] = useState<CostCenter | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    level: 1,
    parent_code: "",
    country_code: "ES",
    applies_to_all_countries: true,
    is_active: true,
  });

  useEffect(() => {
    loadCostCenters();
  }, []);

  useEffect(() => {
    filterCostCenters();
  }, [costCenters, searchTerm, scopeFilter]);

  const loadCostCenters = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("cost_centers")
        .select("*")
        .order("code", { ascending: true });

      if (error) throw error;
      setCostCenters(data || []);
    } catch (error) {
      console.error("Error loading cost centers:", error);
      toast({
        title: "Error",
        description: "Failed to load cost centers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterCostCenters = () => {
    let filtered = [...costCenters];

    if (scopeFilter !== "ALL") {
      filtered = filtered.filter((cc) =>
        cc.applies_to_all_countries || cc.country_code === scopeFilter
      );
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (cc) =>
          cc.code.toLowerCase().includes(term) ||
          cc.name.toLowerCase().includes(term)
      );
    }

    setFilteredCostCenters(filtered);
  };

  const handleOpenDialog = (costCenter?: CostCenter) => {
    if (costCenter) {
      setEditingCostCenter(costCenter);
      setFormData({
        code: costCenter.code,
        name: costCenter.name,
        level: costCenter.level || 1,
        parent_code: costCenter.parent_code || "",
        country_code: costCenter.country_code || "ES",
        applies_to_all_countries: costCenter.applies_to_all_countries ?? true,
        is_active: costCenter.is_active,
      });
    } else {
      setEditingCostCenter(null);
      setFormData({
        code: "",
        name: "",
        level: 1,
        parent_code: "",
        country_code: "ES",
        applies_to_all_countries: true,
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

      const dataToSave = {
        code: formData.code.trim(),
        name: formData.name.trim(),
        level: formData.level,
        parent_code: formData.parent_code?.trim() || null,
        country_code: formData.country_code,
        applies_to_all_countries: formData.applies_to_all_countries,
        is_active: formData.is_active,
      };

      if (editingCostCenter) {
        const { error } = await supabase
          .from("cost_centers")
          .update({ ...dataToSave, updated_at: new Date().toISOString() })
          .eq("code", editingCostCenter.code);

        if (error) throw error;
        toast({ title: "Success", description: "Cost center updated successfully" });
      } else {
        const { error } = await supabase.from("cost_centers").insert([dataToSave]);
        if (error) throw error;
        toast({ title: "Success", description: "Cost center created successfully" });
      }

      setIsDialogOpen(false);
      loadCostCenters();
    } catch (error) {
      console.error("Error saving cost center:", error);
      toast({
        title: "Error",
        description: "Failed to save cost center",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm("Are you sure you want to delete this cost center?")) return;

    try {
      const { error } = await supabase.from("cost_centers").delete().eq("code", code);
      if (error) throw error;
      toast({ title: "Success", description: "Cost center deleted successfully" });
      loadCostCenters();
    } catch (error) {
      console.error("Error deleting cost center:", error);
      toast({
        title: "Error",
        description: "Failed to delete cost center",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-full px-6 space-y-6 py-6">
      <header className="page-header-standard">
        <div>
          <h1 className="header-title">Cost Centers</h1>
          <p className="header-subtitle">Manage organizational cost centers</p>
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
          New Cost Center
        </Button>
      </header>

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
              placeholder="Search cost centers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="table-standard">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parent</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr key="loading">
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td>
                </tr>
              ) : filteredCostCenters.length === 0 ? (
                <tr key="empty">
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No cost centers found</td>
                </tr>
              ) : (
                filteredCostCenters.map((cc, index) => (
                  <tr key={`cost-center-${cc.code}-${index}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {cc.applies_to_all_countries ? (
                        <span title="All Countries">🌐</span>
                      ) : cc.country_code === "ES" ? (
                        <span title="Spain">🇪🇸</span>
                      ) : (
                        <span title="United States">🇺🇸</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenDialog(cc)}
                          className="text-gray-600 hover:text-blue-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(cc.code)}
                          className="text-gray-600 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{cc.code}</td>
                    <td className="px-4 py-3">{cc.name}</td>
                    <td className="px-4 py-3 text-gray-600">{cc.level || 1}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-sm">{cc.parent_code || "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cc.is_active ? "badge-light-success" : "badge-light-secondary"}
                      >
                        {cc.is_active ? "Active" : "Inactive"}
                      </span>
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
              {editingCostCenter ? "Edit Cost Center" : "New Cost Center"}
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              {editingCostCenter ? "Update cost center details" : "Create a new cost center"}
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
                  placeholder="e.g., 1.0.0"
                  disabled={!!editingCostCenter}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="level" className="text-sm font-medium text-gray-700">Level</Label>
                <Input
                  id="level"
                  type="number"
                  min="1"
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 1 })}
                  className="h-11"
                />
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
                <Label htmlFor="parent_code" className="text-sm font-medium text-gray-700">Parent Code</Label>
                <Input
                  id="parent_code"
                  value={formData.parent_code}
                  onChange={(e) => setFormData({ ...formData, parent_code: e.target.value })}
                  className="h-11"
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country_code" className="text-sm font-medium text-gray-700">Country</Label>
                <Select
                  value={formData.country_code}
                  onValueChange={(value: "ES" | "US") =>
                    setFormData({ ...formData, country_code: value })
                  }
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

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="applies_to_all_countries"
                checked={formData.applies_to_all_countries}
                onChange={(e) => setFormData({ ...formData, applies_to_all_countries: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="applies_to_all_countries" className="text-sm font-medium text-gray-700 cursor-pointer">
                Applies to All Countries
              </Label>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="is_active" className="text-sm font-medium text-gray-700 cursor-pointer">Active Cost Center</Label>
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
              {editingCostCenter ? "Update Cost Center" : "Create Cost Center"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
