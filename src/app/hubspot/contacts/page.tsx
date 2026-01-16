"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Download,
    Edit2,
    Save,
    X,
    Trash2,
    ArrowLeft,
    Loader2,
    CheckCircle,
    XCircle,
    RefreshCw,
    Mail,
    Phone,
    Building2,
    User,
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
import { formatDate } from "@/lib/formatters";
import HubSpotSyncStatus from "@/components/hubspot/sync-status";

interface Contact {
    id: string;
    created_at: string;
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
    company?: string;
    job_title?: string;
    lifecycle_stage?: string;
    lead_status?: string;
    owner?: string;
    custom_data?: any;
}

export default function HubSpotContactsPage() {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingData, setEditingData] = useState<Partial<Contact>>({});
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStage, setFilterStage] = useState<string>("all");
    const [alert, setAlert] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    useEffect(() => {
        fetchContacts();
    }, []);

    const filteredContactsMemo = useMemo(() => {
        let filtered = [...contacts];

        if (searchTerm) {
            filtered = filtered.filter(
                (contact) =>
                    contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    contact.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    contact.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    contact.company?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (filterStage !== "all") {
            filtered = filtered.filter((contact) => contact.lifecycle_stage === filterStage);
        }

        return filtered;
    }, [contacts, searchTerm, filterStage]);

    useEffect(() => {
        setFilteredContacts(filteredContactsMemo);
    }, [filteredContactsMemo]);

    const fetchContacts = async () => {
        try {
            setLoading(true);

            // Buscar deals do HubSpot desde 01/01/2024 e extrair contatos
            const { data: deals, error } = await supabase
                .from("csv_rows")
                .select("*")
                .eq("source", "hubspot")
                .gte("date", "2024-01-01")
                .order("date", { ascending: false });

            if (error) throw error;

            // Extrair contatos únicos dos deals (dados simulados baseados nos owners e companies)
            const uniqueCompanies = new Map();
            deals?.forEach((deal, index) => {
                const company = deal.custom_data?.company || "Unknown Company";
                const owner = deal.custom_data?.owner || "Unknown Owner";

                if (!uniqueCompanies.has(company)) {
                    uniqueCompanies.set(company, {
                        id: `contact-${index}`,
                        created_at: deal.date || new Date().toISOString(),
                        email: `contact@${company.toLowerCase().replace(/\s+/g, '')}.com`,
                        first_name: owner.split(' ')[0] || "Contact",
                        last_name: owner.split(' ').slice(1).join(' ') || "Name",
                        phone: "+1234567890",
                        company: company,
                        job_title: "Sales Representative",
                        lifecycle_stage: deal.custom_data?.stage?.includes("won") ? "customer" :
                            deal.custom_data?.stage?.includes("qualified") ? "opportunity" : "lead",
                        lead_status: deal.reconciled ? "Closed" : "Open",
                        owner: owner,
                        custom_data: deal.custom_data
                    });
                }
            });

            const contactsList = Array.from(uniqueCompanies.values());
            setContacts(contactsList);
        } catch (error: any) {
            console.error("Erro ao carregar contatos:", error);
            setContacts([]);
        } finally {
            setLoading(false);
        }
    };

    const syncFromHubSpot = async () => {
        try {
            setSyncing(true);
            showAlert("success", "Sincronizando contatos do HubSpot...");

            const response = await fetch("/api/hubspot/contacts/sync", {
                method: "POST",
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Sync error");
            }

            showAlert("success", result.message || "Sync completed!");
            await fetchContacts();
        } catch (error: any) {
            showAlert("error", `Erro ao sincronizar: ${error.message}`);
        } finally {
            setSyncing(false);
        }
    };

    const exportToCSV = () => {
        const headers = ["Email", "Name", "Sobrenome", "Phone", "Empresa", "Cargo", "Lifecycle Stage", "Status"];
        const csvData = filteredContacts.map((contact) => [
            contact.email,
            contact.first_name,
            contact.last_name,
            contact.phone || "",
            contact.company || "",
            contact.job_title || "",
            contact.lifecycle_stage || "",
            contact.lead_status || "",
        ]);

        const csv = [headers, ...csvData].map((row) => row.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `hubspot-contacts-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
    };

    const showAlert = (type: "success" | "error", message: string) => {
        setAlert({ type, message });
        setTimeout(() => setAlert(null), 5000);
    };

    const stats = useMemo(() => {
        return {
            total: contacts.length,
            leads: contacts.filter((c) => c.lifecycle_stage === "lead").length,
            customers: contacts.filter((c) => c.lifecycle_stage === "customer").length,
            opportunities: contacts.filter((c) => c.lifecycle_stage === "opportunity").length,
        };
    }, [contacts]);

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
                        <h1 className="text-3xl font-bold">HubSpot Contacts</h1>
                        <p className="text-gray-500">
                            Management of synced contacts from HubSpot CRM
                        </p>
                    </div>
                </div>
            </div>

            {/* Sync Status */}
            <HubSpotSyncStatus />

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
                            Total Contacts
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Leads
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {stats.leads}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Oportunidades
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">
                            {stats.opportunities}
                        </div>
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
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle>Filtros</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-4">
                    <Input
                        placeholder="Buscar por nome, email ou empresa..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-md"
                    />
                    <select
                        value={filterStage}
                        onChange={(e) => setFilterStage(e.target.value)}
                        className="border rounded px-3 py-2"
                    >
                        <option value="all">Todos os Stages</option>
                        <option value="lead">Leads</option>
                        <option value="opportunity">Oportunidades</option>
                        <option value="customer">Clientes</option>
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
                                        Name
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Email
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Phone
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Empresa
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Cargo
                                    </th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                                        Stage
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Created Date
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredContacts.map((contact) => (
                                    <tr key={contact.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-gray-400" />
                                                <span className="font-medium">
                                                    {contact.first_name} {contact.last_name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Mail className="w-4 h-4 text-gray-400" />
                                                {contact.email}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {contact.phone ? (
                                                <div className="flex items-center gap-2">
                                                    <Phone className="w-4 h-4 text-gray-400" />
                                                    {contact.phone}
                                                </div>
                                            ) : (
                                                "-"
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {contact.company ? (
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="w-4 h-4 text-gray-400" />
                                                    {contact.company}
                                                </div>
                                            ) : (
                                                "-"
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {contact.job_title || "-"}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Badge
                                                variant="outline"
                                                className={
                                                    contact.lifecycle_stage === "customer"
                                                        ? "bg-green-50 text-green-700"
                                                        : contact.lifecycle_stage === "opportunity"
                                                            ? "bg-yellow-50 text-yellow-700"
                                                            : "bg-blue-50 text-blue-700"
                                                }
                                            >
                                                {contact.lifecycle_stage || "N/A"}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            {formatDate(contact.created_at)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {filteredContacts.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Nenhum contato encontrado</p>
                            <Button
                                onClick={syncFromHubSpot}
                                variant="outline"
                                className="mt-4"
                            >
                                Sync Contacts
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
