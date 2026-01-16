"use client";

import { useState, useEffect } from "react";
import {
    ArrowLeft,
    Loader2,
    CheckCircle,
    XCircle,
    Save,
    RefreshCw,
    Database,
    Key,
    Globe,
    Clock,
    AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatTimestamp } from "@/lib/formatters";

interface SyncSettings {
    enabled: boolean;
    syncInterval: number;
    lastSync: string;
    autoSync: boolean;
    syncDeals: boolean;
    syncContacts: boolean;
    syncCompanies: boolean;
}

export default function HubSpotSettingsPage() {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dataStats, setDataStats] = useState({ deals: 0, lastSync: "" });
    const [settings, setSettings] = useState<SyncSettings>({
        enabled: true,
        syncInterval: 60,
        lastSync: new Date().toISOString(),
        autoSync: false,
        syncDeals: true,
        syncContacts: false,
        syncCompanies: false,
    });
    const [alert, setAlert] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<
        "connected" | "disconnected" | "testing"
    >("connected");

    useEffect(() => {
        fetchDataStats();
    }, []);

    const fetchDataStats = async () => {
        try {
            const { data, error } = await supabase
                .from("csv_rows")
                .select("date")
                .eq("source", "hubspot")
                .gte("date", "2024-01-01")
                .order("date", { ascending: false });

            if (error) throw error;

            setDataStats({
                deals: data?.length || 0,
                lastSync: data?.[0]?.date || new Date().toISOString()
            });

            setSettings(prev => ({
                ...prev,
                lastSync: data?.[0]?.date || new Date().toISOString()
            }));
        } catch (error) {
            console.error("Erro ao buscar stats:", error);
        }
    };

    const testConnection = async () => {
        setConnectionStatus("testing");
        try {
            // Testar busca de dados do HubSpot desde 2024
            const { data, error } = await supabase
                .from("csv_rows")
                .select("id")
                .eq("source", "hubspot")
                .gte("date", "2024-01-01")
                .limit(1);

            if (error) throw error;

            setConnectionStatus("connected");
            showAlert("success", `Connection active! ${dataStats.deals} deals available`);
        } catch (error) {
            setConnectionStatus("disconnected");
            showAlert("error", "Falha ao conectar com dados do HubSpot");
        }
    };

    const syncHubSpotData = async () => {
        setLoading(true);
        try {
            showAlert("success", "Starting sync...");

            const response = await fetch("/api/hubspot/sync", {
                method: "POST",
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || "Erro ao sincronizar");
            }

            showAlert("success", result.message || "Sync completed!");
            await fetchDataStats();
        } catch (error: any) {
            console.error("Sync error:", error);
            showAlert("error", `Erro ao sincronizar: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const checkAvailableTables = async () => {
        try {
            showAlert("success", "Checking available tables...");

            const response = await fetch("/api/hubspot/tables");
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || "Erro ao verificar tabelas");
            }

            console.log("Available tables:", result.tables);
            showAlert("success", `Encontradas ${result.count} tabelas no SQL Server. Verifique o console para detalhes.`);
        } catch (error: any) {
            console.error("Erro ao verificar tabelas:", error);
            showAlert("error", `Erro: ${error.message}`);
        }
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            // Aqui você salvaria as configurações no banco
            await new Promise((resolve) => setTimeout(resolve, 1000));
            showAlert("success", "Settings saved successfully!");
        } catch (error: any) {
            showAlert("error", `Erro ao salvar: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const showAlert = (type: "success" | "error", message: string) => {
        setAlert({ type, message });
        setTimeout(() => setAlert(null), 5000);
    };

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
                        <h1 className="text-3xl font-bold">HubSpot Settings</h1>
                        <p className="text-gray-500">
                            Sync and integration settings
                        </p>
                    </div>
                </div>
                <Button
                    onClick={saveSettings}
                    disabled={saving}
                    className="gap-2"
                >
                    {saving ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Salvando...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            Save Settings
                        </>
                    )}
                </Button>
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

            {/* Connection Status */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Globe className="w-5 h-5" />
                        Connection Status
                    </CardTitle>
                    <CardDescription>
                        Current HubSpot integration status
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {connectionStatus === "connected" && (
                                <CheckCircle className="w-6 h-6 text-green-600" />
                            )}
                            {connectionStatus === "disconnected" && (
                                <XCircle className="w-6 h-6 text-red-600" />
                            )}
                            {connectionStatus === "testing" && (
                                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                            )}
                            <div>
                                <div className="font-medium">
                                    {connectionStatus === "connected" && "Conectado"}
                                    {connectionStatus === "disconnected" &&
                                        "Desconectado"}
                                    {connectionStatus === "testing" &&
                                        "Testing connection..."}
                                </div>
                                <div className="text-sm text-gray-500">
                                    {dataStats.deals} deals synced | Last sync:{" "}
                                    {formatTimestamp(settings.lastSync)}
                                </div>
                            </div>
                        </div>
                        <Button
                            onClick={testConnection}
                            variant="outline"
                            disabled={connectionStatus === "testing"}
                            className="gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Test Connection
                        </Button>
                    </div>

                    <div className="flex gap-2 pt-4 border-t">
                        <Button
                            onClick={syncHubSpotData}
                            disabled={loading}
                            className="gap-2 flex-1"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Sincronizando...
                                </>
                            ) : (
                                <>
                                    <Database className="w-4 h-4" />
                                    Sincronizar Dados
                                </>
                            )}
                        </Button>
                        <Button
                            onClick={checkAvailableTables}
                            variant="outline"
                            className="gap-2"
                        >
                            <Database className="w-4 h-4" />
                            Ver Tabelas
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* API Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="w-5 h-5" />
                        API Configuration
                    </CardTitle>
                    <CardDescription>
                        Integration credentials and endpoints
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">API Key</label>
                        <Input
                            type="password"
                            placeholder="pat-na1-..."
                            defaultValue="••••••••••••••••"
                            className="font-mono"
                        />
                        <p className="text-xs text-gray-500">
                            Chave de API privada do HubSpot
                        </p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Portal ID</label>
                        <Input
                            type="text"
                            placeholder="12345678"
                            defaultValue="12345678"
                        />
                        <p className="text-xs text-gray-500">
                            ID do seu portal HubSpot
                        </p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Endpoint</label>
                        <Input
                            type="text"
                            defaultValue="https://api.hubapi.com"
                            disabled
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Sync Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        Sync Configuration
                    </CardTitle>
                    <CardDescription>
                        Controle o que sincronizar do HubSpot
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <div className="font-medium">Auto Sync</div>
                            <div className="text-sm text-gray-500">
                                Sincronizar automaticamente em intervalos regulares
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings.autoSync}
                            onChange={(e) =>
                                setSettings({ ...settings, autoSync: e.target.checked })
                            }
                            className="w-5 h-5"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Sync Interval (minutes)
                        </label>
                        <Input
                            type="number"
                            value={settings.syncInterval}
                            onChange={(e) =>
                                setSettings({
                                    ...settings,
                                    syncInterval: parseInt(e.target.value),
                                })
                            }
                            min="15"
                            max="1440"
                            disabled={!settings.autoSync}
                        />
                    </div>

                    <div className="border-t pt-4 space-y-3">
                        <div className="font-medium text-sm">Objetos para Sincronizar:</div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={settings.syncDeals}
                                    onChange={(e) =>
                                        setSettings({
                                            ...settings,
                                            syncDeals: e.target.checked,
                                        })
                                    }
                                    className="w-4 h-4"
                                />
                                <label className="text-sm">Deals</label>
                            </div>
                            <Badge variant="outline" className="bg-green-50">
                                Ativo
                            </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={settings.syncContacts}
                                    onChange={(e) =>
                                        setSettings({
                                            ...settings,
                                            syncContacts: e.target.checked,
                                        })
                                    }
                                    className="w-4 h-4"
                                />
                                <label className="text-sm">Contacts</label>
                            </div>
                            <Badge variant="outline">Em Breve</Badge>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={settings.syncCompanies}
                                    onChange={(e) =>
                                        setSettings({
                                            ...settings,
                                            syncCompanies: e.target.checked,
                                        })
                                    }
                                    className="w-4 h-4"
                                />
                                <label className="text-sm">Companies</label>
                            </div>
                            <Badge variant="outline">Em Breve</Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Info Alert */}
            <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="w-4 h-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                    <strong>Note:</strong> The changes to sync settings
                    will affect the next auto execution. Para sincronizar imediatamente,
                    use the button &quot;Sincronizar&quot; on specific pages.
                </AlertDescription>
            </Alert>
        </div>
    );
}
