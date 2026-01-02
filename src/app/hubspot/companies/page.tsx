"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Download,
    ArrowLeft,
    Loader2,
    CheckCircle,
    XCircle,
    RefreshCw,
    Building2,
    Globe,
    Phone,
    MapPin,
    DollarSign,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/formatters";

interface Company {
    id: string;
    created_at: string;
    name: string;
    domain?: string;
    industry?: string;
    city?: string;
    state?: string;
    country?: string;
    phone?: string;
    annual_revenue?: number;
    number_of_employees?: number;
    lifecycle_stage?: string;
    type?: string;
    owner?: string;
    custom_data?: any;
}

export default function HubSpotCompaniesPage() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState<string>("all");
    const [alert, setAlert] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    useEffect(() => {
        fetchCompanies();
    }, []);

    useEffect(() => {
        filterCompanies();
    }, [companies, searchTerm, filterType]);

    const fetchCompanies = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("hubspot_companies")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) {
                console.log("Tabela hubspot_companies não encontrada, usando dados mock");
                setCompanies([]);
            } else {
                setCompanies(data || []);
            }
        } catch (error: any) {
            console.error("Erro ao carregar empresas:", error);
            setCompanies([]);
        } finally {
            setLoading(false);
        }
    };

    const filterCompanies = () => {
        let filtered = [...companies];

        if (searchTerm) {
            filtered = filtered.filter(
                (company) =>
                    company.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    company.domain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    company.industry?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (filterType !== "all") {
            filtered = filtered.filter((company) => company.type === filterType);
        }

        setFilteredCompanies(filtered);
    };

    const syncFromHubSpot = async () => {
        try {
            setSyncing(true);
            showAlert("success", "Sincronizando empresas do HubSpot...");

            const response = await fetch("/api/hubspot/companies/sync", {
                method: "POST",
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Erro na sincronização");
            }

            showAlert("success", result.message || "Sincronização concluída!");
            await fetchCompanies();
        } catch (error: any) {
            showAlert("error", `Erro ao sincronizar: ${error.message}`);
        } finally {
            setSyncing(false);
        }
    };

    const exportToCSV = () => {
        const headers = ["Nome", "Domínio", "Indústria", "Cidade", "País", "Telefone", "Funcionários", "Receita Anual"];
        const csvData = filteredCompanies.map((company) => [
            company.name,
            company.domain || "",
            company.industry || "",
            company.city || "",
            company.country || "",
            company.phone || "",
            company.number_of_employees || "",
            company.annual_revenue || "",
        ]);

        const csv = [headers, ...csvData].map((row) => row.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `hubspot-companies-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
    };

    const showAlert = (type: "success" | "error", message: string) => {
        setAlert({ type, message });
        setTimeout(() => setAlert(null), 5000);
    };

    const stats = useMemo(() => {
        return {
            total: companies.length,
            customers: companies.filter((c) => c.type === "customer").length,
            prospects: companies.filter((c) => c.type === "prospect").length,
            partners: companies.filter((c) => c.type === "partner").length,
        };
    }, [companies]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard">
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold">HubSpot Companies</h1>
                        <p className="text-gray-500">
                            Gestão de empresas sincronizadas do HubSpot CRM
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={syncFromHubSpot}
                        disabled={syncing}
                        variant="outline"
                        className="gap-2"
                    >
                        {syncing ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Sincronizando...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-4 h-4" />
                                Sincronizar
                            </>
                        )}
                    </Button>
                    <Button onClick={exportToCSV} variant="outline" className="gap-2">
                        <Download className="w-4 h-4" />
                        Exportar
                    </Button>
                </div>
            </div>

            {/* Alert */}
            {alert && (
                <Alert
                    className={
                        alert.type === "success"
                            ? "bg-green-50 border-green-200"
                            : "bg-red-50 border-red-200"
                    }
                >
                    {alert.type === "success" ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <AlertDescription>{alert.message}</AlertDescription>
                </Alert>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Total Empresas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Clientes
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {stats.customers}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Prospects
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">
                            {stats.prospects}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Parceiros
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {stats.partners}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle>Filtros</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-4">
                    <Input
                        placeholder="Buscar por nome, domínio ou indústria..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-md"
                    />
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="border rounded px-3 py-2"
                    >
                        <option value="all">Todos os Tipos</option>
                        <option value="customer">Clientes</option>
                        <option value="prospect">Prospects</option>
                        <option value="partner">Parceiros</option>
                    </select>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Empresa
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Indústria
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Localização
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Funcionários
                                    </th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                                        Receita Anual
                                    </th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                                        Tipo
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredCompanies.map((company) => (
                                    <tr key={company.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm">
                                            <div>
                                                <div className="flex items-center gap-2 font-medium">
                                                    <Building2 className="w-4 h-4 text-gray-400" />
                                                    {company.name}
                                                </div>
                                                {company.domain && (
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                        <Globe className="w-3 h-3" />
                                                        {company.domain}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {company.industry || "-"}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {company.city || company.country ? (
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="w-4 h-4 text-gray-400" />
                                                    <span>
                                                        {[company.city, company.country]
                                                            .filter(Boolean)
                                                            .join(", ")}
                                                    </span>
                                                </div>
                                            ) : (
                                                "-"
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {company.number_of_employees || "-"}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-medium">
                                            {company.annual_revenue ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <DollarSign className="w-4 h-4 text-gray-400" />
                                                    {formatCurrency(company.annual_revenue)}
                                                </div>
                                            ) : (
                                                "-"
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Badge
                                                variant="outline"
                                                className={
                                                    company.type === "customer"
                                                        ? "bg-green-50 text-green-700"
                                                        : company.type === "prospect"
                                                            ? "bg-yellow-50 text-yellow-700"
                                                            : "bg-blue-50 text-blue-700"
                                                }
                                            >
                                                {company.type || "N/A"}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {filteredCompanies.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Nenhuma empresa encontrada</p>
                            <Button
                                onClick={syncFromHubSpot}
                                variant="outline"
                                className="mt-4"
                            >
                                Sincronizar Empresas
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
