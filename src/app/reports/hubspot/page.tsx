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
    Database,
    Zap,
    Link as LinkIcon,
    AlertTriangle,
    TrendingUp,
    Eye,
    Package,
    ShoppingCart,
    Key,
    Calendar,
    DollarSign,
    User,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/formatters";

interface HubSpotDeal {
    id: string;
    date: string; // closedate
    description: string;
    amount: number;
    customer_email?: string;
    customer_name?: string;
    custom_data?: {
        // ==========================================
        // IDs e Códigos (CRÍTICO para linkagem)
        // ==========================================
        deal_id?: string; // HubSpot Deal ID
        order_code?: string; // Order Code (e437d54, a3d2c9a) - NOVO!
        dealname?: string; // Alias para order_code
        ecomm_order_number?: string; // Também guarda Order Code
        website_order_id?: string; // Web Order ID (2831851)
        reference?: string; // Alias para order_code

        // ==========================================
        // Status
        // ==========================================
        status?: string; // Status do deal - NOVO!
        dealstage?: string;
        stage?: string; // Alias for dealstage
        pipeline?: string;
        paid_status?: string; // "Paid", "Unpaid", etc
        owner?: string; // Owner ID or name
        owner_id?: string;

        // ==========================================
        // Datas
        // ==========================================
        date_ordered?: string; // Date Ordered - NOVO!
        date_paid?: string; // Date Paid - NOVO!
        closedate?: string; // Alias para date_ordered
        hs_closed_won_date?: string; // Alias para date_paid
        hs_lastmodifieddate?: string; // Last Updated
        last_updated?: string;
        createdate?: string;

        // ==========================================
        // Customer - Informações Completas
        // ==========================================
        customer_firstname?: string;
        customer_lastname?: string;
        customer_email?: string;
        customer_phone?: string;
        customer_jobtitle?: string;
        customer_clinic?: string;
        customer_address?: string;
        customer_city?: string;
        customer_state?: string;
        customer_country?: string;
        customer_zip?: string;

        // ==========================================
        // Company
        // ==========================================
        company?: string; // Company name
        company_name?: string;
        company_id?: string;
        company_industry?: string;
        company_website?: string;
        company_city?: string;
        company_country?: string;
        company_phone?: string;

        // ==========================================
        // Valores e Pagamento
        // ==========================================
        currency?: string;
        total_payment?: number; // Paid Amount
        paid_amount?: number; // Alias - NOVO!
        discount_amount?: number;
        tax_amount?: number;
        total_amount?: number;
        total_price?: number;
        final_price?: number;

        // ==========================================
        // Produtos (LineItems)
        // ==========================================
        product_name?: string;
        product_short_name?: string; // Nome curto - NOVO!
        product_name_full?: string; // Nome completo - NOVO!
        product_name_raw?: string;
        product_quantity?: number;
        product_amount?: number;
        product_unit_price?: number; // NOVO!
        product_sku?: string; // NOVO!
        product_cost?: number; // NOVO!
        product_discount?: number;
        quantity?: number;
        items_total?: number;

        // ==========================================
        // E-commerce e Origem
        // ==========================================
        coupon_code?: string;
        website_source?: string; // Origin
        order_site?: string; // Alias - NOVO!
        source_app_id?: string;
        source_store_id?: string;

        // ==========================================
        // Metadados
        // ==========================================
        synced_at?: string;
        query_type?: string; // "enriched", "intermediate", "simple"
        contact_id?: string;

        // ==========================================
        // 🔗 Linkagem Braintree (preenchido pela app)
        // ==========================================
        braintree_order_id?: string;
        braintree_transaction_id?: string;
        braintree_transaction_ids?: string[];
        braintree_status?: string;
        braintree_status_history?: Array<{ status: string; timestamp: string }>;
        braintree_settlement_batch_id?: string;
        braintree_settlement_date?: string;
        braintree_disbursement_date?: string;
        braintree_settlement_amount?: number;
        braintree_settlement_currency_iso_code?: string;
        braintree_settlement_currency_exchange_rate?: number;
        braintree_merchant_account_id?: string;
        bank_destination_account?: string;
        linked_at?: string;
    };
    [key: string]: any;
}

export default function HubSpotReportPage() {
    const [rows, setRows] = useState<HubSpotDeal[]>([]);
    const [filteredRows, setFilteredRows] = useState<HubSpotDeal[]>([]);
    const [paginatedRows, setPaginatedRows] = useState<HubSpotDeal[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    const [verifyingSchema, setVerifyingSchema] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingData, setEditingData] = useState<Partial<HubSpotDeal>>({});
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("all"); // all, paid, unpaid
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(50);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [orderDetailsDialog, setOrderDetailsDialog] = useState<HubSpotDeal | null>(null);
    const [alert, setAlert] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    useEffect(() => {
        fetchRows();
    }, []);

    useEffect(() => {
        filterRows();
    }, [rows, searchTerm, filterStatus]);

    useEffect(() => {
        // Aplicar paginação aos filteredRows
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        setPaginatedRows(filteredRows.slice(startIndex, endIndex));
    }, [filteredRows, currentPage, pageSize]);

    const fetchRows = async () => {
        try {
            console.log('🔄 [FETCH] Iniciando fetchRows...');
            setLoading(true);
            setCurrentPage(1); // Resetar página ao carregar novos dados

            console.log('📡 [FETCH] Fazendo query no Supabase...');
            // Buscar todas as orders e filtrar no cliente para evitar problemas com JSONB
            const { data, error, count } = await supabase
                .from("csv_rows")
                .select("*", { count: "exact" })
                .eq("source", "hubspot")
                .order("date", { ascending: false })
                .limit(2000);

            console.log(`✅ [FETCH] Query completou: ${data?.length} registros, total: ${count}`);

            if (error) {
                console.error('❌ [FETCH] Erro na query:', error);
                throw error;
            }

            // Filtrar por date_ordered >= 2024-12-01 (últimos 13 meses)
            const cutoffDate = "2024-12-01";
            const filteredData = (data || []).filter((row: any) => {
                const dateOrdered = row.custom_data?.date_ordered || row.custom_data?.Date_Ordered || row.date;
                if (!dateOrdered) return false;
                return dateOrdered >= cutoffDate;
            });

            console.log(`📊 [FILTER] ${filteredData.length} orders desde ${cutoffDate}`);

            setRows(filteredData);
            console.log('✅ [FETCH] Dados carregados com sucesso!');
        } catch (error: any) {
            console.error('❌ [FETCH] Erro ao carregar dados:', error);
            showAlert("error", `Erro ao carregar dados: ${error.message}`);
        } finally {
            setLoading(false);
            console.log('🏁 [FETCH] fetchRows finalizado');
        }
    };

    const filterRows = () => {
        let filtered = [...rows];

        if (searchTerm) {
            filtered = filtered.filter(
                (row) =>
                    row.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    row.custom_data?.deal_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    row.custom_data?.company?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (filterStatus !== "all") {
            filtered = filtered.filter((row) => {
                const paidStatus = row.custom_data?.paid_status?.toLowerCase();
                if (filterStatus === "paid") return paidStatus === "paid";
                if (filterStatus === "unpaid") return paidStatus !== "paid";
                return true;
            });
        }

        setFilteredRows(filtered);
    };

    const syncFromSQLServer = async () => {
        try {
            console.log('🔄 [HUBSPOT FRONTEND] Iniciando sincronização...');
            setSyncing(true);
            showAlert("success", "Sincronizando dados do SQL Server... (pode levar até 2 minutos)");

            console.log('📡 [HUBSPOT FRONTEND] Fazendo requisição para /api/hubspot/sync...');

            // Criar um controller para controlar timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutos

            const response = await fetch("/api/hubspot/sync", {
                method: "POST",
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            console.log('📥 [HUBSPOT FRONTEND] Resposta recebida:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log('📋 [HUBSPOT FRONTEND] Resultado:', result);

            if (!result.success) {
                throw new Error(result.error || "Erro na sincronização");
            }

            showAlert("success", result.message);
            console.log('🔄 [HUBSPOT FRONTEND] Recarregando dados...');
            await fetchRows();
            console.log('✅ [HUBSPOT FRONTEND] Sincronização completa!');
        } catch (error: any) {
            console.error('❌ [HUBSPOT FRONTEND] Erro na sincronização:', error);
            if (error.name === 'AbortError') {
                showAlert("error", "Sincronização cancelada: tempo limite excedido (3 min)");
            } else {
                showAlert("error", `Erro ao sincronizar: ${error.message}`);
            }
        } finally {
            setSyncing(false);
        }
    };

    const cleanAndResync = async () => {
        if (!confirm('⚠️ Isso vai deletar TODOS os dados do HubSpot e re-sincronizar. Continuar?')) {
            return;
        }

        try {
            console.log('🗑️ Iniciando limpeza e re-sincronização...');
            setCleaning(true);

            // Passo 1: Deletar dados antigos
            showAlert("success", "Deletando dados antigos do HubSpot...");
            const cleanupResponse = await fetch("/api/hubspot/cleanup", {
                method: "DELETE",
            });
            const cleanupResult = await cleanupResponse.json();

            if (!cleanupResult.success) {
                throw new Error(cleanupResult.error || "Erro ao deletar dados");
            }

            console.log(`✅ ${cleanupResult.deleted} registros deletados`);

            // Passo 2: Sincronizar novamente
            showAlert("success", "Re-sincronizando dados do SQL Server...");
            await syncFromSQLServer();

            showAlert("success", "Limpeza e re-sincronização concluídas!");
        } catch (error: any) {
            console.error('❌ Erro na limpeza:', error);
            showAlert("error", `Erro: ${error.message}`);
        } finally {
            setCleaning(false);
        }
    };

    const verifySchema = async () => {
        try {
            console.log('🔍 Verificando schema do HubSpot...');
            setVerifyingSchema(true);
            showAlert("success", "Verificando estrutura do banco de dados...");

            const response = await fetch("/api/hubspot/schema");
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Erro ao verificar schema");
            }

            console.log('📊 Schema verificado:', result);

            // Mostrar resumo
            const message = `
Schema verificado! 
✓ ${result.totalColumns} colunas na tabela Deal
✓ ${result.criticalFields.filter((f: any) => f.exists).length}/${result.criticalFields.length} campos críticos encontrados
✓ ${result.relatedTables.filter((t: any) => t.exists).length}/${result.relatedTables.length} tabelas relacionadas disponíveis

${result.recommendations.join('\n')}
            `.trim();

            showAlert("success", message);

            // Abrir console para ver detalhes completos
            console.table(result.criticalFields);
            console.table(result.relatedTables);
            console.log('💡 Recomendações:', result.recommendations);

        } catch (error: any) {
            console.error('❌ Erro ao verificar schema:', error);
            showAlert("error", `Erro: ${error.message}`);
        } finally {
            setVerifyingSchema(false);
        }
    };

    /* REMOVED: Auto-Match functionality - this is a view-only deals page
    const runAutoMatch = async (dryRun: boolean = false) => {
        try {
            setMatching(true);
            showAlert("success", dryRun ? "Analisando matches possíveis..." : "Executando auto-match...");

            const response = await fetch("/api/hubspot/auto-match", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dryRun }),
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Erro no auto-match");
            }

            setMatchStats(result.stats);
            showAlert("success", dryRun
                ? `Análise completa: ${result.stats.matched} matches encontrados (${result.stats.averageConfidence}% confiança média)`
                : `Auto-match completo: ${result.stats.matched} registros reconciliados`
            );

            if (!dryRun) {
                await fetchRows();
            }
        } catch (error: any) {
            showAlert("error", `Erro no auto-match: ${error.message}`);
        } finally {
            setMatching(false);
        }
    };
    */

    // getMatchIndicator removed - not needed for deals view page

    // Extrair Order Code (e437d54) - priorizar ecomm_order_number
    const extractOrderCode = (row: HubSpotDeal): string => {
        // 1. Tentar ecomm_order_number primeiro
        if (row.custom_data?.ecomm_order_number) {
            return row.custom_data.ecomm_order_number.trim();
        }

        // 2. Fallback: pegar primeiros 7 caracteres do dealname
        const dealname = row.custom_data?.dealname;
        if (!dealname) return "";

        const cleaned = dealname.trim().toLowerCase();
        const match = cleaned.match(/^[a-z0-9]{7}/);
        return match ? match[0] : cleaned.substring(0, 7);
    };

    // Gerar Invoice Number no padrão #DSDESE437D54-24819 (order_code + web_order_id)
    const getInvoiceNumber = (row: HubSpotDeal): string => {
        const orderCode = extractOrderCode(row);
        const webOrderId = row.custom_data?.website_order_id || "";

        if (!orderCode) return "";

        // Se tiver web order ID, usar formato completo: #DSDESE437D54-24819
        if (webOrderId) {
            return `#DSDES${orderCode.toUpperCase()}-${webOrderId}`;
        }

        // Fallback: usar apenas order code: #DSDESE437D54
        return `#DSDES${orderCode.toUpperCase()}`;
    };

    // Pegar ÚLTIMO status do paid_status (ex: "Unpaid;Paid;Partial" -> "Partial")
    const getLastPaidStatus = (paidStatus: string | undefined): string => {
        if (!paidStatus) return 'Unpaid';

        // Se tiver ; significa histórico (ex: "Unpaid;Paid;Partial")
        if (paidStatus.includes(';')) {
            const statuses = paidStatus.split(';').map(s => s.trim());
            return statuses[statuses.length - 1]; // Pegar o ÚLTIMO
        }

        return paidStatus;
    };

    // Extrair Short Number (LEGACY - manter para compatibilidade)
    const extractShortNumber = (dealname: string | undefined): string => {
        if (!dealname) return "";
        const cleaned = dealname.trim().toLowerCase();
        const match = cleaned.match(/^[a-z0-9]{7}/);
        return match ? match[0] : cleaned.substring(0, 7);
    };

    // Extrair Long Number (32 caracteres - hash MD5 completo)
    const extractLongNumber = (dealname: string | undefined): string => {
        if (!dealname) return "";
        const cleaned = dealname.trim().toLowerCase();
        // Se tem 32 caracteres, é o long number
        if (cleaned.length === 32) return cleaned;
        // Senão, pegar primeiros 32
        return cleaned.substring(0, Math.min(32, cleaned.length));
    };

    const getStatusIcon = (stage: string) => {
        // Mapear status do HubSpot para ícones coloridos
        const stageColors: Record<string, string> = {
            'closedwon': 'text-green-500',
            'closedlost': 'text-red-500',
            'contractsent': 'text-blue-500',
            'qualifiedtobuy': 'text-yellow-500',
            'appointmentscheduled': 'text-orange-500',
            'presentationscheduled': 'text-purple-500',
        };

        const normalizedStage = stage?.toLowerCase().replace(/[^a-z]/g, '') || '';
        const color = stageColors[normalizedStage] || 'text-gray-500';

        return <span className={`text-2xl ${color}`}>●</span>;
    };

    const getPaidStatusIcon = (paidStatus: string | undefined) => {
        const status = paidStatus?.toLowerCase();
        return status === "paid"
            ? <span className="text-green-500 text-xl">●</span>  // Paid
            : <span className="text-red-500 text-xl">●</span>; // Unpaid
    };

    const toggleRowExpansion = (rowId: string) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(rowId)) {
                newSet.delete(rowId);
            } else {
                newSet.add(rowId);
            }
            return newSet;
        });
    };

    const handleEdit = (row: HubSpotDeal) => {
        setEditingId(row.id);
        setEditingData({
            date: row.date,
            description: row.description,
            amount: row.amount,
            reconciled: row.reconciled,
        });
    };

    const handleSave = async (id: string) => {
        try {
            const { error } = await supabase
                .from("csv_rows")
                .update(editingData)
                .eq("id", id);

            if (error) throw error;

            setRows(
                rows.map((row) => (row.id === id ? { ...row, ...editingData } : row))
            );
            setEditingId(null);
            showAlert("success", "Linha atualizada com sucesso");
        } catch (error: any) {
            showAlert("error", `Erro ao salvar: ${error.message}`);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja deletar esta linha?")) return;

        try {
            const { error } = await supabase.from("csv_rows").delete().eq("id", id);

            if (error) throw error;

            setRows(rows.filter((row) => row.id !== id));
            showAlert("success", "Linha deletada com sucesso");
        } catch (error: any) {
            showAlert("error", `Erro ao deletar: ${error.message}`);
        }
    };

    const toggleReconciled = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from("csv_rows")
                .update({ reconciled: !currentStatus })
                .eq("id", id);

            if (error) throw error;

            setRows(
                rows.map((row) =>
                    row.id === id ? { ...row, reconciled: !currentStatus } : row
                )
            );
            showAlert("success", "Status atualizado");
        } catch (error: any) {
            showAlert("error", `Erro ao atualizar: ${error.message}`);
        }
    };

    const exportToCSV = () => {
        const headers = ["Data", "Descrição", "Valor", "Conciliado", "Deal ID", "Stage", "Pipeline", "Owner", "Company"];
        const csvData = filteredRows.map((row) => [
            row.date,
            row.description,
            row.amount,
            row.reconciled ? "Sim" : "Não",
            row.custom_data?.deal_id || "",
            row.custom_data?.stage || "",
            row.custom_data?.pipeline || "",
            row.custom_data?.owner || "",
            row.custom_data?.company || "",
        ]);

        const csv = [headers, ...csvData].map((row) => row.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `hubspot-report-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
    };

    const showAlert = (type: "success" | "error", message: string) => {
        setAlert({ type, message });
        setTimeout(() => setAlert(null), 5000);
    };

    const stats = useMemo(() => {
        return {
            total: rows.length,
            reconciled: rows.filter((r) => r.reconciled).length,
            pending: rows.filter((r) => !r.reconciled).length,
            matched: rows.filter((r) => r.matched_with).length,
            unmatched: rows.filter((r) => !r.matched_with).length,
            totalAmount: rows.reduce((sum, r) => sum + r.amount, 0),
            reconciledAmount: rows
                .filter((r) => r.reconciled)
                .reduce((sum, r) => sum + r.amount, 0),
            avgConfidence: rows.filter(r => r.match_confidence).length > 0
                ? Math.round(
                    rows
                        .filter(r => r.match_confidence)
                        .reduce((sum, r) => sum + (r.match_confidence || 0), 0) /
                    rows.filter(r => r.match_confidence).length
                )
                : 0,
        };
    }, [rows]);

    // Calcular total de registros após filtros (para paginação correta)
    const totalFilteredCount = filteredRows.length;
    const totalPages = Math.ceil(totalFilteredCount / pageSize);

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
                        <h1 className="text-3xl font-bold">Web Orders</h1>
                        <p className="text-gray-500">
                            Pedidos do backend sincronizados via HubSpot SQL Server
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button
                        onClick={syncFromSQLServer}
                        disabled={syncing || cleaning}
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
                    <Button
                        onClick={cleanAndResync}
                        disabled={syncing || cleaning}
                        variant="outline"
                        className="gap-2 text-orange-600 hover:text-orange-700"
                    >
                        {cleaning ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Limpando...
                            </>
                        ) : (
                            <>
                                <Trash2 className="w-4 h-4" />
                                Limpar & Re-Sincronizar
                            </>
                        )}
                    </Button>
                    <Button
                        onClick={verifySchema}
                        disabled={verifyingSchema}
                        variant="outline"
                        className="gap-2 text-blue-600 hover:text-blue-700"
                    >
                        {verifyingSchema ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Verificando...
                            </>
                        ) : (
                            <>
                                <Database className="w-4 h-4" />
                                Verificar Schema
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
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Total Deals
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Conciliados
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {stats.reconciled}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Pendentes
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">
                            {stats.pending}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-purple-200 bg-purple-50">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-purple-700 flex items-center gap-1">
                            <LinkIcon className="w-4 h-4" />
                            Matched
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-600">
                            {stats.matched}
                        </div>
                        <p className="text-xs text-purple-600 mt-1">
                            {stats.avgConfidence}% confiança média
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Valor Total
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(stats.totalAmount)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Conciliado
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(stats.reconciledAmount)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Auto-Match Section - REMOVED: This is a view-only deals page for HubSpot orders */}

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle>Filtros</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-4">
                    <Input
                        placeholder="Buscar por descrição, deal ID, empresa..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-md"
                    />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="border rounded px-3 py-2"
                    >
                        <option value="all">Todos Status</option>
                        <option value="paid">Pagos</option>
                        <option value="unpaid">Não Pagos</option>
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
                                        Order ID
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Date Ordered
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Customer
                                    </th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                                        Paid Status
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Date Paid
                                    </th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                                        Total Paid
                                    </th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                                        Total
                                    </th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {paginatedRows.map((row) => {
                                    const isEditing = editingId === row.id;
                                    const isExpanded = expandedRows.has(row.id);

                                    // Extrair dados essenciais
                                    // Order ID: Reference (short number like "1d309d4")
                                    const orderReference = row.custom_data?.reference || row.custom_data?.Reference || '-';
                                    const orderNumber = row.custom_data?.Number || row.custom_data?.number || '-';

                                    // Status da order
                                    const orderStatus = row.custom_data?.Status || row.custom_data?.status || row.custom_data?.dealstage || 'Unknown';

                                    // Paid Status: pegar ÚLTIMO status se tiver histórico (Unpaid;Paid;Partial -> Partial)
                                    const paidStatusRaw = row.custom_data?.paid_status || row.custom_data?.Paid_Status || 'Unpaid';
                                    const paidStatus = getLastPaidStatus(paidStatusRaw);

                                    // Valores numéricos
                                    const totalPaid = row.custom_data?.total_paid || row.custom_data?.Total_Paid || 0;
                                    const totalAmount = row.amount || row.custom_data?.Total || 0;

                                    return (
                                        <>
                                            <tr key={row.id} className="hover:bg-gray-50">
                                                {/* 1. Order ID com ícone de olho */}
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-blue-600 font-semibold font-mono">
                                                            {orderReference}
                                                        </span>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setOrderDetailsDialog(row)}
                                                            className="h-6 w-6 p-0 hover:bg-blue-50"
                                                            title="Ver detalhes da order"
                                                        >
                                                            <Eye className="w-4 h-4 text-blue-600" />
                                                        </Button>
                                                    </div>
                                                </td>

                                                {/* 2. Status */}
                                                <td className="px-4 py-3">
                                                    <Badge
                                                        variant={orderStatus === 'Cancelled' ? 'destructive' : 'default'}
                                                        className="text-xs"
                                                    >
                                                        {orderStatus}
                                                    </Badge>
                                                </td>

                                                {/* 3. Date Ordered */}
                                                <td className="px-4 py-3 text-sm">
                                                    {row.date ? new Date(row.date).toLocaleString('en-US', {
                                                        month: 'numeric',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    }) : "-"}
                                                </td>

                                                {/* 4. Customer */}
                                                <td className="px-4 py-3">
                                                    <a
                                                        href={`mailto:${row.customer_email}`}
                                                        className="text-blue-600 hover:underline text-sm truncate block max-w-[200px]"
                                                        title={row.customer_email}
                                                    >
                                                        {row.customer_email || "-"}
                                                    </a>
                                                </td>

                                                {/* 5. Paid Status */}
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {getPaidStatusIcon(paidStatus)}
                                                        <span className="text-sm font-medium">
                                                            {paidStatus}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* 6. Date Paid */}
                                                <td className="px-4 py-3 text-sm">
                                                    {(() => {
                                                        const datePaid = row.custom_data?.date_paid || row.custom_data?.Date_Paid || row.custom_data?.hs_closed_won_date;
                                                        if (!datePaid) return "-";

                                                        try {
                                                            return new Date(datePaid).toLocaleString('en-US', {
                                                                month: 'numeric',
                                                                day: 'numeric',
                                                                year: 'numeric'
                                                            });
                                                        } catch (e) {
                                                            return formatDate(datePaid);
                                                        }
                                                    })()}
                                                </td>

                                                {/* 7. Total Paid */}
                                                <td className="px-4 py-3 text-right">
                                                    <span className="font-medium">{formatCurrency(totalPaid)}</span>
                                                </td>

                                                {/* 8. Total */}
                                                <td className="px-4 py-3 text-right">
                                                    <span className="font-medium">{formatCurrency(totalAmount)}</span>
                                                </td>

                                                {/* Actions */}
                                                <td className="px-4 py-3">
                                                    <div className="flex gap-1 justify-center">
                                                        {isEditing ? (
                                                            <>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => handleSave(row.id)}
                                                                >
                                                                    <Save className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => setEditingId(null)}
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => handleEdit(row)}
                                                                    title="Edit"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => handleDelete(row.id)}
                                                                    className="text-red-600"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Expanded Row - All Totals Details */}
                                            {isExpanded && (
                                                <tr key={`${row.id}-expanded`} className="bg-gray-50">
                                                    <td colSpan={11} className="px-4 py-4">
                                                        <div className="ml-8 p-4 bg-white rounded border border-gray-200">
                                                            <h4 className="font-semibold text-sm mb-3 text-gray-700">
                                                                Order Details
                                                            </h4>

                                                            {/* Totals Grid */}
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                                                                <div>
                                                                    <span className="text-gray-600">Qty:</span>
                                                                    <p className="font-medium">
                                                                        {row.custom_data?.product_quantity || row.custom_data?.quantity || 0}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-600">Items:</span>
                                                                    <p className="font-medium text-green-600">
                                                                        {formatCurrency(row.custom_data?.product_amount || row.custom_data?.items_total || row.amount)}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-600">Discounts:</span>
                                                                    <p className="font-medium text-red-600">
                                                                        -{formatCurrency(row.custom_data?.product_discount || row.custom_data?.discount_amount || 0)}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-600">Price:</span>
                                                                    <p className="font-medium text-blue-600">
                                                                        {formatCurrency(row.custom_data?.final_price || row.amount)}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Order Codes Section */}
                                                            <div className="border-t border-gray-200 pt-3 mb-3">
                                                                <h5 className="font-semibold text-xs text-gray-700 mb-2">Order Codes</h5>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-gray-600 min-w-[100px]">Order:</span>
                                                                        <code className="bg-blue-50 px-2 py-1 rounded font-mono text-blue-700">
                                                                            {extractOrderCode(row) || "-"}
                                                                        </code>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-gray-600 min-w-[100px]">Web Order ID:</span>
                                                                        <code className="bg-purple-50 px-2 py-1 rounded font-mono text-purple-700">
                                                                            {row.custom_data?.website_order_id || "-"}
                                                                        </code>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-gray-600 min-w-[100px]">HubSpot Deal ID:</span>
                                                                        <code className="bg-gray-50 px-2 py-1 rounded font-mono text-gray-700">
                                                                            {row.custom_data?.deal_id || "-"}
                                                                        </code>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-gray-600 min-w-[100px]">Invoice:</span>
                                                                        <code className="bg-green-50 px-2 py-1 rounded font-mono text-green-700">
                                                                            {getInvoiceNumber(row) || "-"}
                                                                        </code>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Braintree Link (preenchido automaticamente pela app) */}
                                                            {(row.custom_data?.braintree_transaction_id || (row.custom_data?.braintree_status_history || []).length > 0) && (
                                                                <div className="border-t border-gray-200 pt-3 mb-3">
                                                                    <h5 className="font-semibold text-xs text-gray-700 mb-2">Braintree Link</h5>
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-gray-600 min-w-[140px]">Transaction ID:</span>
                                                                            <code className="bg-blue-50 px-2 py-1 rounded font-mono text-blue-700 break-all">
                                                                                {row.custom_data?.braintree_transaction_id || "-"}
                                                                            </code>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-gray-600 min-w-[140px]">Conta destino:</span>
                                                                            <code className="bg-orange-50 px-2 py-1 rounded font-mono text-orange-700 break-all">
                                                                                {row.custom_data?.bank_destination_account || "-"}
                                                                            </code>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-gray-600 min-w-[140px]">Settlement Date:</span>
                                                                            <code className="bg-gray-50 px-2 py-1 rounded font-mono text-gray-700">
                                                                                {row.custom_data?.braintree_settlement_date || "-"}
                                                                            </code>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-gray-600 min-w-[140px]">Disbursement Date:</span>
                                                                            <code className="bg-gray-50 px-2 py-1 rounded font-mono text-gray-700">
                                                                                {row.custom_data?.braintree_disbursement_date || "-"}
                                                                            </code>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-gray-600 min-w-[140px]">Settlement Amount:</span>
                                                                            <code className="bg-emerald-50 px-2 py-1 rounded font-mono text-emerald-700">
                                                                                {row.custom_data?.braintree_settlement_amount != null
                                                                                    ? formatCurrency(row.custom_data.braintree_settlement_amount)
                                                                                    : "-"}
                                                                            </code>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-gray-600 min-w-[140px]">Moeda/FX:</span>
                                                                            <code className="bg-purple-50 px-2 py-1 rounded font-mono text-purple-700">
                                                                                {row.custom_data?.braintree_settlement_currency_iso_code || "-"}
                                                                                {row.custom_data?.braintree_settlement_currency_exchange_rate != null
                                                                                    ? ` @ ${row.custom_data.braintree_settlement_currency_exchange_rate}`
                                                                                    : ""}
                                                                            </code>
                                                                        </div>
                                                                    </div>

                                                                    {Array.isArray(row.custom_data?.braintree_status_history) && row.custom_data!.braintree_status_history!.length > 0 && (
                                                                        <div className="mt-3">
                                                                            <div className="text-[11px] text-gray-600 mb-1">Status history</div>
                                                                            <div className="max-h-[180px] overflow-y-auto border border-gray-200 rounded">
                                                                                <div className="divide-y">
                                                                                    {[...row.custom_data!.braintree_status_history!]
                                                                                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                                                                                        .slice(0, 20)
                                                                                        .map((h, idx) => (
                                                                                            <div key={idx} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                                                                                                <span className="font-mono">{h.status}</span>
                                                                                                <span className="text-gray-500 font-mono">{new Date(h.timestamp).toLocaleString("pt-BR")}</span>
                                                                                            </div>
                                                                                        ))}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Customer Info */}
                                                            {(row.customer_name || row.customer_email) && (
                                                                <div className="border-t border-gray-200 pt-3">
                                                                    <h5 className="font-semibold text-xs text-gray-700 mb-2">Customer</h5>
                                                                    {row.customer_name && <p className="font-medium">{row.customer_name}</p>}
                                                                    {row.customer_email && <p className="text-sm text-gray-500">{row.customer_email}</p>}
                                                                    {row.custom_data?.customer_phone && (
                                                                        <p className="text-sm text-gray-500">{row.custom_data.customer_phone}</p>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Product Info */}
                                                            {row.custom_data?.product_name && (
                                                                <div className="border-t border-gray-200 pt-3 mt-3">
                                                                    <h5 className="font-semibold text-xs text-gray-700 mb-2">Product Details</h5>
                                                                    <div className="space-y-2 text-sm">
                                                                        <div>
                                                                            <p className="font-medium">{row.custom_data.product_name}</p>
                                                                            {row.custom_data.product_name_raw && row.custom_data.product_name_raw !== row.custom_data.product_name && (
                                                                                <p className="text-xs text-gray-500">Original: {row.custom_data.product_name_raw}</p>
                                                                            )}
                                                                        </div>
                                                                        {(row.custom_data.product_quantity || row.custom_data.product_amount) && (
                                                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                                                {row.custom_data.product_quantity && (
                                                                                    <div>
                                                                                        <span className="text-gray-600">Quantity:</span>
                                                                                        <p className="font-medium">{row.custom_data.product_quantity}</p>
                                                                                    </div>
                                                                                )}
                                                                                {row.custom_data.product_amount && (
                                                                                    <div>
                                                                                        <span className="text-gray-600">Total:</span>
                                                                                        <p className="font-medium text-green-600">{formatCurrency(row.custom_data.product_amount)}</p>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Additional Info */}
                                                            {(row.custom_data?.company || row.custom_data?.coupon_code || row.custom_data?.website_source || row.custom_data?.date_paid || row.custom_data?.hs_closed_won_date) && (
                                                                <div className="border-t border-gray-200 pt-3 mt-3">
                                                                    <h5 className="font-semibold text-xs text-gray-700 mb-2">Additional Info</h5>
                                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                                        {row.custom_data?.company && (
                                                                            <div>
                                                                                <span className="text-gray-600">Company:</span>
                                                                                <p className="font-medium">{row.custom_data.company}</p>
                                                                            </div>
                                                                        )}
                                                                        {row.custom_data?.coupon_code && (
                                                                            <div>
                                                                                <span className="text-gray-600">Coupon:</span>
                                                                                <p className="font-medium">{row.custom_data.coupon_code}</p>
                                                                            </div>
                                                                        )}
                                                                        {row.custom_data?.website_source && (
                                                                            <div>
                                                                                <span className="text-gray-600">Origin:</span>
                                                                                <p className="font-medium">{row.custom_data.website_source}</p>
                                                                            </div>
                                                                        )}
                                                                        {(row.custom_data?.date_paid || row.custom_data?.hs_closed_won_date) && (
                                                                            <div>
                                                                                <span className="text-gray-600">Date Paid:</span>
                                                                                <p className="font-medium text-green-600">
                                                                                    {(() => {
                                                                                        const datePaid = row.custom_data.date_paid || row.custom_data.hs_closed_won_date;
                                                                                        if (!datePaid) return '-';
                                                                                        try {
                                                                                            return new Date(datePaid).toLocaleString('en-US', {
                                                                                                month: 'short',
                                                                                                day: 'numeric',
                                                                                                year: 'numeric',
                                                                                                hour: 'numeric',
                                                                                                minute: '2-digit',
                                                                                                hour12: true
                                                                                            });
                                                                                        } catch (e) {
                                                                                            return formatDate(datePaid);
                                                                                        }
                                                                                    })()}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                        {row.custom_data?.hs_lastmodifieddate && (
                                                                            <div>
                                                                                <span className="text-gray-600">Last Updated:</span>
                                                                                <p className="font-medium">{formatDate(row.custom_data.hs_lastmodifieddate)}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {filteredRows.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Nenhum deal encontrado</p>
                            <Button
                                onClick={syncFromSQLServer}
                                variant="outline"
                                className="mt-4"
                            >
                                Sincronizar Agora
                            </Button>
                        </div>
                    )}

                    {/* Paginação */}
                    {filteredRows.length > 0 && (
                        <div className="flex items-center justify-between p-4 bg-gray-50 border-t">
                            <div className="text-sm text-gray-600">
                                Mostrando {totalFilteredCount === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} a {Math.min(currentPage * pageSize, totalFilteredCount)} de {totalFilteredCount} registros
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    variant="outline"
                                    size="sm"
                                >
                                    Anterior
                                </Button>
                                <div className="flex items-center gap-2 px-3">
                                    <span className="text-sm font-medium">
                                        Página {currentPage} de {totalPages}
                                    </span>
                                </div>
                                <Button
                                    onClick={() => setCurrentPage(currentPage + 1)}
                                    disabled={currentPage >= totalPages}
                                    variant="outline"
                                    size="sm"
                                >
                                    Próxima
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Order Details Dialog */}
            <Dialog open={!!orderDetailsDialog} onOpenChange={(open) => !open && setOrderDetailsDialog(null)}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto !bg-white dark:!bg-slate-900">
                    <DialogHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 p-4 rounded-t-lg -mt-6 -mx-6 mb-4">
                        <DialogTitle className="text-xl font-bold text-blue-900 dark:text-blue-100">
                            Order Details
                        </DialogTitle>
                        <DialogDescription className="text-blue-700 dark:text-blue-300">
                            Reference: <span className="font-mono font-bold">{orderDetailsDialog?.custom_data?.reference || orderDetailsDialog?.custom_data?.Reference}</span>
                        </DialogDescription>
                    </DialogHeader>

                    {orderDetailsDialog && (
                        <div className="space-y-6 bg-white dark:bg-slate-900">
                            {/* Order IDs Section */}
                            <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
                                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                                    <Key className="w-4 h-4" />
                                    Order Identification
                                </h3>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400 block mb-1">Short Number (Reference):</span>
                                        <code className="bg-blue-100 dark:bg-blue-900 px-3 py-1 rounded font-mono text-blue-800 dark:text-blue-200 font-bold">
                                            {orderDetailsDialog.custom_data?.reference || orderDetailsDialog.custom_data?.Reference || '-'}
                                        </code>
                                    </div>
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400 block mb-1">Long Number:</span>
                                        <code className="bg-purple-100 dark:bg-purple-900 px-3 py-1 rounded font-mono text-purple-800 dark:text-purple-200 text-xs">
                                            {orderDetailsDialog.custom_data?.Number || orderDetailsDialog.custom_data?.number || '-'}
                                        </code>
                                    </div>
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400 block mb-1">HubSpot Deal ID:</span>
                                        <code className="bg-green-100 dark:bg-green-900 px-3 py-1 rounded font-mono text-green-800 dark:text-green-200">
                                            {orderDetailsDialog.custom_data?.ID || orderDetailsDialog.id || '-'}
                                        </code>
                                    </div>
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400 block mb-1">Order Site:</span>
                                        <span className="font-medium text-gray-900 dark:text-gray-100">
                                            {orderDetailsDialog.custom_data?.Order_Site || orderDetailsDialog.custom_data?.order_site || 'DSD (en-GB)'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Status & Dates Section */}
                            <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
                                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    Status & Timeline
                                </h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400 block mb-1">Order Status:</span>
                                        <Badge variant={orderDetailsDialog.custom_data?.Status === 'Cancelled' ? 'destructive' : 'default'}>
                                            {orderDetailsDialog.custom_data?.Status || orderDetailsDialog.custom_data?.status || 'Unknown'}
                                        </Badge>
                                    </div>
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400 block mb-1">Paid Status:</span>
                                        <div className="flex items-center gap-2">
                                            {getPaidStatusIcon(orderDetailsDialog.custom_data?.Paid_Status || orderDetailsDialog.custom_data?.paid_status || 'Unpaid')}
                                            <span className="font-medium text-gray-900 dark:text-gray-100">
                                                {orderDetailsDialog.custom_data?.Paid_Status || orderDetailsDialog.custom_data?.paid_status || 'Unpaid'}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400 block mb-1">Date Ordered:</span>
                                        <span className="font-medium text-gray-900 dark:text-gray-100">
                                            {orderDetailsDialog.custom_data?.Date_Ordered || orderDetailsDialog.date || '-'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400 block mb-1">Date Paid:</span>
                                        <span className="font-medium text-green-600 dark:text-green-400">
                                            {orderDetailsDialog.custom_data?.Date_Paid || orderDetailsDialog.custom_data?.date_paid || '-'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Customer Section */}
                            <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
                                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    Customer Information
                                </h3>
                                <div className="space-y-2 text-sm">
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400">Email:</span>
                                        <a href={`mailto:${orderDetailsDialog.customer_email}`} className="ml-2 text-blue-600 hover:underline font-medium">
                                            {orderDetailsDialog.customer_email || '-'}
                                        </a>
                                    </div>
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400">Billing Business Name:</span>
                                        <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                                            {orderDetailsDialog.custom_data?.Billing_Business_Name || orderDetailsDialog.custom_data?.billing_business_name || '-'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Financial Summary */}
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
                                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                                    <DollarSign className="w-4 h-4" />
                                    Financial Summary
                                </h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center">
                                        <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">Total Paid</span>
                                        <span className="text-xl font-bold text-green-600 dark:text-green-400">
                                            {formatCurrency(orderDetailsDialog.custom_data?.Total_Paid || orderDetailsDialog.custom_data?.total_paid || 0)}
                                        </span>
                                    </div>
                                    <div className="text-center">
                                        <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">Total Discount</span>
                                        <span className="text-xl font-bold text-red-600 dark:text-red-400">
                                            {formatCurrency(orderDetailsDialog.custom_data?.Total_Discount || orderDetailsDialog.custom_data?.total_discount || 0)}
                                        </span>
                                    </div>
                                    <div className="text-center">
                                        <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">Total Amount</span>
                                        <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                            {formatCurrency(orderDetailsDialog.amount || 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Products Section (if available) */}
                            {(orderDetailsDialog.custom_data?.product_name || orderDetailsDialog.description) && (
                                <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
                                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                                        <Package className="w-4 h-4" />
                                        Products
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="bg-white dark:bg-slate-700 p-3 rounded border border-gray-200 dark:border-slate-600">
                                            <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                                                {orderDetailsDialog.custom_data?.product_name || orderDetailsDialog.description || 'N/A'}
                                            </p>
                                            <div className="grid grid-cols-3 gap-3 text-sm mt-2">
                                                {orderDetailsDialog.custom_data?.product_quantity && (
                                                    <div>
                                                        <span className="text-gray-600 dark:text-gray-400 block">Quantity:</span>
                                                        <span className="font-bold text-gray-900 dark:text-gray-100">
                                                            {orderDetailsDialog.custom_data.product_quantity}
                                                        </span>
                                                    </div>
                                                )}
                                                {orderDetailsDialog.custom_data?.product_unit_price && (
                                                    <div>
                                                        <span className="text-gray-600 dark:text-gray-400 block">Unit Price:</span>
                                                        <span className="font-bold text-blue-600 dark:text-blue-400">
                                                            {formatCurrency(orderDetailsDialog.custom_data.product_unit_price)}
                                                        </span>
                                                    </div>
                                                )}
                                                {orderDetailsDialog.custom_data?.product_discount && (
                                                    <div>
                                                        <span className="text-gray-600 dark:text-gray-400 block">Discount:</span>
                                                        <span className="font-bold text-red-600 dark:text-red-400">
                                                            -{formatCurrency(orderDetailsDialog.custom_data.product_discount)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Coupon Code (if available) */}
                            {orderDetailsDialog.custom_data?.Coupon_Code && (
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-700">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Coupon Code:</span>
                                    <code className="ml-2 bg-yellow-100 dark:bg-yellow-800 px-2 py-1 rounded font-mono text-yellow-800 dark:text-yellow-200 font-bold">
                                        {orderDetailsDialog.custom_data.Coupon_Code}
                                    </code>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Helper: Extrair ícone de Paid Status
function getPaidStatusIcon(status: string) {
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus.includes('paid') && !normalizedStatus.includes('unpaid')) {
        return <CheckCircle className="w-4 h-4 text-green-600" />;
    }
    if (normalizedStatus.includes('unpaid')) {
        return <XCircle className="w-4 h-4 text-red-600" />;
    }
    if (normalizedStatus.includes('partial')) {
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    }
    return <XCircle className="w-4 h-4 text-gray-400" />;
}

// Helper: Pegar último status de histórico (ex: "Unpaid;Paid" -> "Paid")
function getLastPaidStatus(statusString: string): string {
    if (!statusString) return 'Unpaid';
    const statuses = statusString.split(';').map(s => s.trim()).filter(Boolean);
    return statuses[statuses.length - 1] || 'Unpaid';
}
