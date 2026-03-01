"use client";

import { useState, useEffect, useMemo } from "react";
import {
    ArrowLeft,
    Loader2,
    TrendingUp,
    DollarSign,
    Target,
    Clock,
    Zap,
    CheckCircle2,
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
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatCurrency } from "@/lib/formatters";
import HubSpotSyncStatus from "@/components/hubspot/sync-status";
import { PageHeader } from "@/components/ui/page-header";

interface PipelineStage {
    stage: string;
    count: number;
    value: number;
    avgDealSize: number;
    winRate: number;
}

export default function HubSpotPipelinePage() {
    const [loading, setLoading] = useState(true);
    const [pipelineData, setPipelineData] = useState<PipelineStage[]>([]);

    useEffect(() => {
        fetchPipelineData();
    }, []);

    const fetchPipelineData = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("csv_rows")
                .select("*")
                .eq("source", "hubspot")
                .gte("date", "2024-01-01")
                .order("date", { ascending: false });

            if (error) throw error;

            // Group por stage
            const stageGroups: { [key: string]: any[] } = {};
            data?.forEach((row) => {
                const stage = row.custom_data?.stage || "Unknown";
                if (!stageGroups[stage]) {
                    stageGroups[stage] = [];
                }
                stageGroups[stage].push(row);
            });

            // Calcular métricas por stage
            const stages: PipelineStage[] = Object.entries(stageGroups).map(
                ([stage, deals]) => {
                    const totalValue = deals.reduce((sum, d) => sum + d.amount, 0);
                    const count = deals.length;
                    const avgDealSize = count > 0 ? totalValue / count : 0;
                    const closedWon = deals.filter(
                        (d) => d.custom_data?.stage === "closedwon"
                    ).length;
                    const winRate = count > 0 ? (closedWon / count) * 100 : 0;

                    return {
                        stage,
                        count,
                        value: totalValue,
                        avgDealSize,
                        winRate,
                    };
                }
            );

            setPipelineData(stages);
        } catch (error: any) {
            console.error("Erro ao carregar pipeline:", error);
            setPipelineData([]);
        } finally {
            setLoading(false);
        }
    };

    const stats = useMemo(() => {
        const total = pipelineData.reduce((sum, s) => sum + s.count, 0);
        const totalValue = pipelineData.reduce((sum, s) => sum + s.value, 0);
        const avgDealSize = total > 0 ? totalValue / total : 0;
        const closedWon = pipelineData.find((s) => s.stage === "closedwon");

        return {
            totalDeals: total,
            totalValue,
            avgDealSize,
            closedWonCount: closedWon?.count || 0,
            closedWonValue: closedWon?.value || 0,
        };
    }, [pipelineData]);

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
            <PageHeader title="Pipeline Analytics" subtitle="Sales funnel analysis and conversion metrics" />

            {/* Sync Status */}
            <HubSpotSyncStatus />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            Total Deals
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalDeals}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            Amount Total
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(stats.totalValue)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Average Deal
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(stats.avgDealSize)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Fechados
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {stats.closedWonCount}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                            <Zap className="w-4 h-4" />
                            Receita Fechada
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(stats.closedWonValue)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Pipeline Stages */}
            <Card>
                <CardHeader>
                    <CardTitle>Stages do Pipeline</CardTitle>
                    <CardDescription>
                        Deal distribution by sales funnel stage
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {pipelineData.map((stage, index) => {
                            const percentage =
                                stats.totalValue > 0
                                    ? (stage.value / stats.totalValue) * 100
                                    : 0;

                            return (
                                <div key={stage.stage} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                                                {index + 1}
                                            </Badge>
                                            <div>
                                                <div className="font-medium capitalize">
                                                    {stage.stage.replace(/_/g, " ")}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {stage.count} deals • Average:{" "}
                                                    {formatCurrency(stage.avgDealSize)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-lg">
                                                {formatCurrency(stage.value)}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {percentage.toFixed(1)}% do total
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all"
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Conversion Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Target className="w-5 h-5" />
                            Conversion Rate
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-blue-600">
                            {stats.totalDeals > 0
                                ? ((stats.closedWonCount / stats.totalDeals) * 100).toFixed(1)
                                : 0}
                            %
                        </div>
                        <p className="text-sm text-gray-500 mt-2">
                            Deals fechados vs total
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            Velocidade do Pipeline
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-green-600">
                            {pipelineData.length}
                        </div>
                        <p className="text-sm text-gray-500 mt-2">Stages ativos</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingUp className="w-5 h-5" />
                            Oportunidades Ativas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-yellow-600">
                            {stats.totalDeals - stats.closedWonCount}
                        </div>
                        <p className="text-sm text-gray-500 mt-2">Em progresso</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
