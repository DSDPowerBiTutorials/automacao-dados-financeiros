"use client";

import { Activity, Globe } from "lucide-react";

interface DashboardHeaderProps {
    userName: string;
    scope: string;
}

export function DashboardHeader({ userName, scope }: DashboardHeaderProps) {
    const now = new Date();
    const hour = now.getHours();
    let greeting = "Bom dia";
    if (hour >= 12 && hour < 18) greeting = "Boa tarde";
    else if (hour >= 18) greeting = "Boa noite";

    const dateStr = now.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    const scopeLabel =
        scope === "GLOBAL" ? "Global" : scope === "ES" ? "Espanha" : "EUA";

    return (
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold dashboard-text-primary tracking-tight">
                    {greeting}, {userName}
                </h1>
                <p className="text-sm dashboard-text-muted mt-0.5 capitalize">
                    {dateStr}
                </p>
            </div>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 dashboard-card px-3 py-2">
                    <Globe className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold dashboard-text-secondary">
                        {scopeLabel}
                    </span>
                </div>
                <div className="flex items-center gap-2 dashboard-card px-3 py-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400">Online</span>
                </div>
            </div>
        </div>
    );
}
