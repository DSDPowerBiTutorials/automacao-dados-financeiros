"use client";

import { useState } from "react";
import { TrendingUp, DollarSign, Hash, Percent, GripVertical, Settings } from "lucide-react";
import { type CardWidgetConfig } from "@/lib/bi-types";
import { useDroppable } from "@dnd-kit/core";
import { MeasureSelector } from "@/components/bi/builder/MeasureSelector";
import { FilterBuilder } from "@/components/bi/builder/FilterBuilder";

interface CardWidgetProps {
    config: CardWidgetConfig;
    onUpdate: (updates: Partial<CardWidgetConfig>) => void;
    dropId: string;
}

export function CardWidget({ config, onUpdate, dropId }: CardWidgetProps) {
    const [editing, setEditing] = useState(false);
    const { setNodeRef, isOver } = useDroppable({
        id: dropId,
        data: { type: "card", onDrop: (measureId: string, label: string) => onUpdate({ measureId, label }) },
    });

    const isEmpty = !config.measureId && !config.label;

    const formatIcon = () => {
        switch (config.format) {
            case "percent": return <Percent size={12} />;
            case "number": return <Hash size={12} />;
            default: return <DollarSign size={12} />;
        }
    };

    if (isEmpty) {
        return (
            <div ref={setNodeRef} className="relative">
                <div
                    className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 min-h-[80px] transition-all cursor-pointer
                        ${isOver ? "border-[#FF7300] bg-[#FF7300]/10" : "border-gray-300 dark:border-gray-700 hover:border-[#FF7300] bg-gray-50/50 dark:bg-gray-900/50"}`}
                    onClick={() => setEditing(true)}
                >
                    <TrendingUp size={16} className="text-gray-300 dark:text-gray-600" />
                    <span className="text-[9px] text-gray-400">Drop measure or click to configure</span>
                </div>
                {editing && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 space-y-2 max-h-[320px] overflow-y-auto">
                        <input
                            type="text"
                            value={config.label}
                            onChange={(e) => onUpdate({ label: e.target.value })}
                            placeholder="Card label"
                            className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-[#FF7300] outline-none"
                            autoFocus
                        />
                        <MeasureSelector
                            selectedId={config.measureId}
                            onSelect={(id, label) => onUpdate({ measureId: id, label })}
                        />
                        <select
                            value={config.format ?? "currency"}
                            onChange={(e) => onUpdate({ format: e.target.value as "currency" | "number" | "percent" })}
                            className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                            <option value="currency">Currency (€)</option>
                            <option value="number">Number</option>
                            <option value="percent">Percent (%)</option>
                        </select>
                        <FilterBuilder
                            filters={config.filters ?? []}
                            onChange={(filters) => onUpdate({ filters })}
                        />
                        <button onClick={() => setEditing(false)} className="w-full text-[10px] text-[#FF7300] hover:underline font-medium">
                            Done
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            className={`relative bg-white dark:bg-[#111111] border rounded-xl p-4 transition-all group
                ${isOver ? "border-[#FF7300] ring-1 ring-[#FF7300]" : "border-gray-200 dark:border-gray-800 hover:shadow-md"}`}
        >
            <button
                onClick={() => setEditing(!editing)}
                className="absolute top-1.5 right-1.5 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
                <Settings size={10} className="text-gray-400" />
            </button>

            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">
                    {config.label || "KPI"}
                </span>
                <div className={`p-1 rounded-lg ${config.color ? "" : "bg-blue-50 dark:bg-blue-500/10"}`}
                    style={config.color ? { backgroundColor: `${config.color}15` } : undefined}>
                    {formatIcon()}
                </div>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                —
            </p>

            {editing && (
                <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 space-y-2 max-h-[320px] overflow-y-auto">
                    <input
                        type="text"
                        value={config.label}
                        onChange={(e) => onUpdate({ label: e.target.value })}
                        placeholder="Card label"
                        className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-[#FF7300] outline-none"
                    />
                    <MeasureSelector
                        selectedId={config.measureId}
                        onSelect={(id, label) => onUpdate({ measureId: id, label })}
                    />
                    <select
                        value={config.format ?? "currency"}
                        onChange={(e) => onUpdate({ format: e.target.value as "currency" | "number" | "percent" })}
                        className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                        <option value="currency">Currency (€)</option>
                        <option value="number">Number</option>
                        <option value="percent">Percent (%)</option>
                    </select>
                    <FilterBuilder
                        filters={config.filters ?? []}
                        onChange={(filters) => onUpdate({ filters })}
                    />
                    <button onClick={() => setEditing(false)} className="w-full text-[10px] text-[#FF7300] hover:underline font-medium">
                        Done
                    </button>
                </div>
            )}
        </div>
    );
}
