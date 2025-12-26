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
  id: string;
  code: string;
  name: string;
  description?: string;
  manager?: string;
  scope: "ES" | "US" | "GLOBAL";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function CostCentersPage() {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [filteredCostCenters, setFilteredCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"ES" | "US" | "GLOBAL" | "ALL">("ALL");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCostCenter, setEditingCostCenter] = useState<CostCenter | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    manager: "",
    scope: "GLOBAL" as "ES" | "US" | "GLOBAL",
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
      filtered = filtered.filter((cc) => cc.scope === scopeFilter);
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
        description: costCenter.description || "",
        manager: costCenter.manager || "",
        scope: costCenter.scope,
        is_active: costCenter.is_active,
      });
    } else {
      setEditingCostCenter(null);
      setFormData({
        code: "",
        name: "",
        description: "",
        manager: "",
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

      if (editingCostCenter) {
        const { error } = await supabase
          .from("cost_centers")
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq("id", editingCostCenter.id);

        if (error) throw error;
        toast({ title: "Success", description: "Cost center updated successfully" });
      } else {
        const { error } = await supabase.from("cost_centers").insert([formData]);
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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this cost center?")) return;

    try {
      const { error } = await supabase.from("cost_centers").delete().eq("id", id);
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cost Centers</h1>
          <p className="text-gray-500 mt-1">Manage organizational cost centers</p>
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
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scope</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Manager</th>
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
                filteredCostCenters.map((cc) => (
                  <tr key={cc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Globe className="h-5 w-5 text-blue-500" />
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
                          onClick={() => handleDelete(cc.id)}
                          className="text-gray-600 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{cc.code}</td>
                    <td className="px-4 py-3">{cc.name}</td>
                    <td className="px-4 py-3 text-gray-600">{cc.description || "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{cc.manager || "-"}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={cc.is_active ? "default" : "secondary"}
                        className={cc.is_active ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                      >
                        {cc.is_active ? "Active" : "Inactive"}
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
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium text-gray-700">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manager" className="text-sm font-medium text-gray-700">Manager</Label>
              <Input
                id="manager"
                value={formData.manager}
                onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                className="h-11"
              />
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
