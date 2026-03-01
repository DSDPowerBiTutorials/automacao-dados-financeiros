"use client";

import { useState } from "react";
import {
    Upload,
    FileText,
    CheckCircle2,
    AlertCircle,
    Loader2,
    ArrowRight,
    RefreshCw,
    FileSearch,
    Link2,
    Mail,
    Calendar,
    Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";

interface UploadSummary {
    totalProcessed: number;
    totalValid: number;
    totalInserted: number;
    totalDuplicated: number;
    totalDeclined: number;
    totalSkippedNoAmount: number;
    totalSkippedNoDate: number;
    totalFees: number;
    byCurrency: Array<{ currency: string; count: number; total: number }>;
    withOrderId: number;
    withDisbursement: number;
    withoutOrderId: number;
    withoutDisbursement: number;
}

interface ReconciliationResult {
    totalBraintree: number;
    totalOrders: number;
    totalMatched: number;
    totalApplied: number;
    totalFailed: number;
    totalUnmatched: number;
    byStrategy: Record<string, number>;
    averageConfidence: number;
    matches: Array<{
        braintreeTransactionId: string;
        orderId: string;
        matchType: string;
        confidence: number;
        braintreeAmount: number;
        orderAmount: number;
        braintreeDate: string;
        orderDate: string;
        customerName: string | null;
        customerEmail: string | null;
    }>;
}

export default function BraintreeReconciliationPage() {
    // Upload state
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<{
        success: boolean;
        message: string;
        summary?: UploadSummary;
    } | null>(null);

    // Reconciliation state
    const [isReconciling, setIsReconciling] = useState(false);
    const [reconciliationStrategy, setReconciliationStrategy] = useState("all");
    const [reconciliationMode, setReconciliationMode] = useState<"dryRun" | "apply">("dryRun");
    const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null);

    // Step tracking
    const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

    // ============================================================
    // Upload Handler
    // ============================================================
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadResult(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/api/csv/braintree-csv", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                setUploadResult({
                    success: false,
                    message: result.error || "Erro ao processar ficheiro",
                });
                return;
            }

            setUploadResult({
                success: true,
                message: result.message,
                summary: result.data?.summary,
            });
            setCurrentStep(2);
        } catch (err) {
            setUploadResult({
                success: false,
                message: "Erro inesperado ao fazer upload. Verifique o formato do ficheiro.",
            });
        } finally {
            setIsUploading(false);
            event.target.value = "";
        }
    };

    // ============================================================
    // Reconciliation Handler
    // ============================================================
    const handleReconciliation = async () => {
        setIsReconciling(true);
        setReconciliationResult(null);

        try {
            const dryRun = reconciliationMode === "dryRun" ? "1" : "0";
            const response = await fetch(
                `/api/reconciliation/braintree-orders?strategy=${reconciliationStrategy}&dryRun=${dryRun}`,
                { method: "POST" }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                setReconciliationResult(null);
                alert(`Erro: ${result.error}`);
                return;
            }

            setReconciliationResult(result.data);
            if (reconciliationMode === "apply") {
                setCurrentStep(3);
            }
        } catch (err) {
            alert("Erro inesperado na reconciliação.");
        } finally {
            setIsReconciling(false);
        }
    };

    // ============================================================
    // Format helpers
    // ============================================================
    const formatCurrency = (amount: number, currency = "EUR") => {
        return new Intl.NumberFormat("pt-PT", {
            style: "currency",
            currency,
            minimumFractionDigits: 2,
        }).format(amount);
    };

    const confidenceBadge = (confidence: number) => {
        if (confidence >= 0.9) return <Badge className="bg-green-100 text-green-800">Alta ({(confidence * 100).toFixed(0)}%)</Badge>;
        if (confidence >= 0.7) return <Badge className="bg-yellow-100 text-yellow-800">Média ({(confidence * 100).toFixed(0)}%)</Badge>;
        return <Badge className="bg-red-100 text-red-800">Baixa ({(confidence * 100).toFixed(0)}%)</Badge>;
    };

    const strategyIcon = (type: string) => {
        switch (type) {
            case "order-id": return <Hash className="h-3 w-3" />;
            case "email": return <Mail className="h-3 w-3" />;
            case "amount-date": return <Calendar className="h-3 w-3" />;
            default: return <Link2 className="h-3 w-3" />;
        }
    };

    const strategyLabel = (type: string) => {
        switch (type) {
            case "order-id": return "Order ID";
            case "email": return "Email";
            case "amount-date": return "Valor + Data";
            default: return type;
        }
    };

    // ============================================================
    // Render
    // ============================================================
    return (
        <div className="flex-1 space-y-6 p-6">
            {/* Header */}
            <PageHeader title="Reconciliação Braintree ↔ Orders" subtitle="Upload de CSV Braintree e reconciliação automática com invoice-orders" />

            {/* Steps indicator */}
            <div className="flex items-center gap-2 text-sm">
                <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${currentStep >= 1 ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-500"}`}>
                    <Upload className="h-3.5 w-3.5" />
                    1. Upload CSV
                </div>
                <ArrowRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${currentStep >= 2 ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-500"}`}>
                    <FileSearch className="h-3.5 w-3.5" />
                    2. Reconciliar
                </div>
                <ArrowRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${currentStep >= 3 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    3. Resultado
                </div>
            </div>

            {/* Step 1: Upload */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5" />
                        Upload CSV Braintree
                    </CardTitle>
                    <CardDescription>
                        Exporte via Braintree → Transaction Search → Download CSV. Suporta multi-moeda (EUR/USD/GBP/AUD).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <label
                            htmlFor="braintree-csv-upload"
                            className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                        >
                            {isUploading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <FileText className="h-4 w-4 text-gray-500" />
                            )}
                            <span className="text-sm text-gray-700">
                                {isUploading ? "A processar..." : "Selecionar CSV Braintree"}
                            </span>
                        </label>
                        <input
                            type="file"
                            id="braintree-csv-upload"
                            accept=".csv,.txt"
                            onChange={handleFileUpload}
                            className="hidden"
                            disabled={isUploading}
                        />
                    </div>

                    {/* Upload Result */}
                    {uploadResult && (
                        <Alert variant={uploadResult.success ? "default" : "destructive"}>
                            {uploadResult.success ? (
                                <CheckCircle2 className="h-4 w-4" />
                            ) : (
                                <AlertCircle className="h-4 w-4" />
                            )}
                            <AlertTitle>
                                {uploadResult.success ? "Upload concluído" : "Erro no upload"}
                            </AlertTitle>
                            <AlertDescription>
                                {uploadResult.message}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Upload Summary */}
                    {uploadResult?.summary && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                            <div className="bg-blue-50 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-blue-700">
                                    {uploadResult.summary.totalInserted}
                                </div>
                                <div className="text-xs text-blue-600">Transações Importadas</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-gray-700">
                                    {uploadResult.summary.totalDuplicated}
                                </div>
                                <div className="text-xs text-gray-600">Duplicadas (ignoradas)</div>
                            </div>
                            <div className="bg-green-50 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-green-700">
                                    {uploadResult.summary.withOrderId}
                                </div>
                                <div className="text-xs text-green-600">Com Order ID</div>
                            </div>
                            <div className="bg-orange-50 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-orange-700">
                                    {uploadResult.summary.totalDeclined}
                                </div>
                                <div className="text-xs text-orange-600">Recusadas (ignoradas)</div>
                            </div>

                            {/* Per currency breakdown */}
                            {uploadResult.summary.byCurrency.map((cur) => (
                                <div key={cur.currency} className="bg-indigo-50 rounded-lg p-3 text-center col-span-1">
                                    <div className="text-lg font-bold text-indigo-700">
                                        {formatCurrency(cur.total, cur.currency)}
                                    </div>
                                    <div className="text-xs text-indigo-600">
                                        {cur.currency} ({cur.count} tx)
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Reconciliation readiness info */}
                    {uploadResult?.summary && (
                        <div className="text-xs text-gray-500 mt-2 space-y-1">
                            <p>
                                📋 <strong>{uploadResult.summary.withOrderId}</strong> transações com Order ID (match direto com invoices)
                            </p>
                            <p>
                                📅 <strong>{uploadResult.summary.withDisbursement}</strong> transações com Disbursement Date (match bancário)
                            </p>
                            {uploadResult.summary.withoutOrderId > 0 && (
                                <p>
                                    ⚠️ <strong>{uploadResult.summary.withoutOrderId}</strong> sem Order ID — serão reconciliadas por email ou valor+data
                                </p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Step 2: Reconciliation */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Link2 className="h-5 w-5" />
                        Reconciliação Orders ↔ Invoices
                    </CardTitle>
                    <CardDescription>
                        Cruza automaticamente transações Braintree com invoice-orders usando múltiplas estratégias de matching.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="space-y-1">
                            <label className="text-xs text-gray-500 font-medium">Estratégia</label>
                            <Select value={reconciliationStrategy} onValueChange={setReconciliationStrategy}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas (recomendado)</SelectItem>
                                    <SelectItem value="order-id">Apenas Order ID</SelectItem>
                                    <SelectItem value="email">Apenas Email</SelectItem>
                                    <SelectItem value="amount-date">Apenas Valor + Data</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-gray-500 font-medium">Modo</label>
                            <Select value={reconciliationMode} onValueChange={(v) => setReconciliationMode(v as "dryRun" | "apply")}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="dryRun">Dry Run (preview)</SelectItem>
                                    <SelectItem value="apply">Aplicar (gravar)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            onClick={handleReconciliation}
                            disabled={isReconciling}
                            variant={reconciliationMode === "apply" ? "default" : "outline"}
                        >
                            {isReconciling ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            {isReconciling
                                ? "A reconciliar..."
                                : reconciliationMode === "dryRun"
                                    ? "Preview Reconciliação"
                                    : "Executar Reconciliação"
                            }
                        </Button>
                    </div>

                    {/* Strategy explanation */}
                    <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
                        <p className="font-medium text-gray-700">Estratégias de matching:</p>
                        <p><Hash className="h-3 w-3 inline mr-1" /><strong>Order ID</strong> — Match direto entre Braintree order_id e Invoice order_id (confiança: 100%)</p>
                        <p><Mail className="h-3 w-3 inline mr-1" /><strong>Email</strong> — Mesmo email + valor semelhante (tolerância: 2% ou €1) (confiança: 80-95%)</p>
                        <p><Calendar className="h-3 w-3 inline mr-1" /><strong>Valor + Data</strong> — Mesmo valor + data ±3 dias (confiança: 50-75%)</p>
                    </div>

                    {/* Reconciliation Results */}
                    {reconciliationResult && (
                        <div className="space-y-4 mt-4">
                            {/* Summary cards */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <div className="bg-blue-50 rounded-lg p-3 text-center">
                                    <div className="text-xl font-bold text-blue-700">
                                        {reconciliationResult.totalBraintree}
                                    </div>
                                    <div className="text-xs text-blue-600">Braintree Pendentes</div>
                                </div>
                                <div className="bg-purple-50 rounded-lg p-3 text-center">
                                    <div className="text-xl font-bold text-purple-700">
                                        {reconciliationResult.totalOrders}
                                    </div>
                                    <div className="text-xs text-purple-600">Invoice-Orders</div>
                                </div>
                                <div className="bg-green-50 rounded-lg p-3 text-center">
                                    <div className="text-xl font-bold text-green-700">
                                        {reconciliationResult.totalMatched}
                                    </div>
                                    <div className="text-xs text-green-600">Matches Encontrados</div>
                                </div>
                                <div className="bg-orange-50 rounded-lg p-3 text-center">
                                    <div className="text-xl font-bold text-orange-700">
                                        {reconciliationResult.totalUnmatched}
                                    </div>
                                    <div className="text-xs text-orange-600">Sem Match</div>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3 text-center">
                                    <div className="text-xl font-bold text-gray-700">
                                        {(reconciliationResult.averageConfidence * 100).toFixed(0)}%
                                    </div>
                                    <div className="text-xs text-gray-600">Confiança Média</div>
                                </div>
                            </div>

                            {/* By strategy breakdown */}
                            {Object.keys(reconciliationResult.byStrategy).length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(reconciliationResult.byStrategy).map(([type, count]) => (
                                        <Badge key={type} variant="outline" className="flex items-center gap-1">
                                            {strategyIcon(type)}
                                            {strategyLabel(type)}: {count}
                                        </Badge>
                                    ))}
                                </div>
                            )}

                            {/* Applied status */}
                            {reconciliationMode === "apply" && reconciliationResult.totalApplied > 0 && (
                                <Alert>
                                    <CheckCircle2 className="h-4 w-4" />
                                    <AlertTitle>Reconciliação aplicada</AlertTitle>
                                    <AlertDescription>
                                        {reconciliationResult.totalApplied} matches gravados na base de dados.
                                        {reconciliationResult.totalFailed > 0 && ` ${reconciliationResult.totalFailed} falharam.`}
                                    </AlertDescription>
                                </Alert>
                            )}

                            {reconciliationMode === "dryRun" && reconciliationResult.totalMatched > 0 && (
                                <Alert>
                                    <FileSearch className="h-4 w-4" />
                                    <AlertTitle>Preview (Dry Run)</AlertTitle>
                                    <AlertDescription>
                                        {reconciliationResult.totalMatched} matches encontrados. Mude para &ldquo;Aplicar&rdquo; e execute novamente para gravar.
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Matches table */}
                            {reconciliationResult.matches.length > 0 && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50">
                                                <th className="text-left p-2 border-b">Tipo</th>
                                                <th className="text-left p-2 border-b">Transaction ID</th>
                                                <th className="text-left p-2 border-b">Order ID</th>
                                                <th className="text-left p-2 border-b">Cliente</th>
                                                <th className="text-right p-2 border-b">Valor BT</th>
                                                <th className="text-right p-2 border-b">Valor Order</th>
                                                <th className="text-left p-2 border-b">Data BT</th>
                                                <th className="text-left p-2 border-b">Data Order</th>
                                                <th className="text-center p-2 border-b">Confiança</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reconciliationResult.matches.map((match, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50 border-b border-gray-100">
                                                    <td className="p-2">
                                                        <Badge variant="outline" className="text-[10px] flex items-center gap-0.5 w-fit">
                                                            {strategyIcon(match.matchType)}
                                                            {strategyLabel(match.matchType)}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-2 font-mono">{match.braintreeTransactionId}</td>
                                                    <td className="p-2 font-mono">{match.orderId || "—"}</td>
                                                    <td className="p-2">
                                                        <div>{match.customerName || "—"}</div>
                                                        <div className="text-gray-500 dark:text-gray-400">{match.customerEmail || ""}</div>
                                                    </td>
                                                    <td className="p-2 text-right font-mono">
                                                        {formatCurrency(match.braintreeAmount)}
                                                    </td>
                                                    <td className="p-2 text-right font-mono">
                                                        {formatCurrency(match.orderAmount)}
                                                    </td>
                                                    <td className="p-2">{match.braintreeDate}</td>
                                                    <td className="p-2">{match.orderDate}</td>
                                                    <td className="p-2 text-center">
                                                        {confidenceBadge(match.confidence)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {reconciliationResult.totalMatched > reconciliationResult.matches.length && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                                            Mostrando {reconciliationResult.matches.length} de {reconciliationResult.totalMatched} matches
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Info box */}
            <Card className="bg-gray-50 border-dashed">
                <CardContent className="pt-4 text-xs text-gray-600 space-y-2">
                    <p className="font-medium text-gray-700">Fluxo completo de reconciliação:</p>
                    <ol className="list-decimal pl-4 space-y-1">
                        <li>
                            <strong>Upload CSV Braintree</strong> → Transações são importadas para <code>csv_rows</code> com source &ldquo;braintree-api-revenue&rdquo;
                        </li>
                        <li>
                            <strong>Reconciliação Orders</strong> → Cruza com invoice-orders por Order ID / Email / Valor+Data
                        </li>
                        <li>
                            <strong>Reconciliação Bancária</strong> → Disponível nas páginas individuais (EUR/USD/GBP/AUD) via settlement batch matching com Bankinter
                        </li>
                    </ol>
                    <p className="mt-2">
                        Relatórios detalhados: <a href="/reports/braintree-eur" className="text-blue-600 underline">EUR</a> | <a href="/reports/braintree-usd" className="text-blue-600 underline">USD</a> | <a href="/reports/braintree-gbp" className="text-blue-600 underline">GBP</a> | <a href="/reports/braintree-aud" className="text-blue-600 underline">AUD</a>
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
