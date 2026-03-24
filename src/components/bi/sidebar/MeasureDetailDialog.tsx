"use client";

import { X, Database, Calculator, Clock, ArrowLeftRight, BarChart3, GitBranch } from "lucide-react";
import { type MeasureDefinition, type UserMeasure } from "@/lib/bi-types";
import { MEASURE_CATALOG } from "@/lib/bi-measure-catalog";
import { FIELD_CATALOG, getFieldByKey } from "@/lib/bi-field-catalog";

interface MeasureDetailDialogProps {
    /** For catalog measures — pass the definition directly */
    catalogMeasure?: MeasureDefinition;
    /** For user-created measures — pass the persisted record */
    userMeasure?: UserMeasure;
    onClose: () => void;
}

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    aggregation: { label: "Aggregation", icon: Calculator, color: "#FF7300" },
    math: { label: "Mathematical", icon: Calculator, color: "#8b5cf6" },
    "time-intelligence": { label: "Time Intelligence", icon: Clock, color: "#3b82f6" },
    comparison: { label: "Comparisons", icon: ArrowLeftRight, color: "#10b981" },
    statistical: { label: "Statistical", icon: BarChart3, color: "#ef4444" },
    logical: { label: "Logical", icon: GitBranch, color: "#f59e0b" },
};

/** Resolve a field key like "ap.invoice_amount" into { table, group, field } */
function resolveField(key: string) {
    for (const group of FIELD_CATALOG) {
        const field = group.fields.find((f) => f.key === key);
        if (field) {
            const tableName = group.parentLabel ? `${group.parentLabel} › ${group.label}` : group.label;
            return { table: tableName, groupId: group.id, field };
        }
    }
    return null;
}

/** Build a formula string like SUM(ap.invoice_amount + ario.amount) */
function buildFormula(def: MeasureDefinition, config?: Record<string, unknown>): string {
    const params = config?.params as Record<string, unknown> | undefined;
    if (!params) {
        const placeholders = def.params.map((p) => `<${p.label}>`).join(", ");
        return `${def.type}(${placeholders})`;
    }

    const parts: string[] = [];
    for (const p of def.params) {
        const val = params[p.name];
        if (Array.isArray(val)) {
            parts.push(val.join(" + "));
        } else if (typeof val === "string" && val) {
            parts.push(val);
        } else {
            parts.push(`<${p.label}>`);
        }
    }
    return `${def.type}(${parts.join(", ")})`;
}

export function MeasureDetailDialog({ catalogMeasure, userMeasure, onClose }: MeasureDetailDialogProps) {
    // Resolve definition
    const definition = catalogMeasure ?? MEASURE_CATALOG.find((m) => m.type === userMeasure?.measureType);
    if (!definition) return null;

    const catMeta = CATEGORY_META[definition.category] ?? CATEGORY_META.aggregation;
    const CatIcon = catMeta.icon;

    // Extract fields used (from user measure config)
    const usedFields: { key: string; table: string; label: string; dataType: string }[] = [];
    if (userMeasure?.config) {
        const params = (userMeasure.config as Record<string, unknown>).params as Record<string, unknown> | undefined;
        if (params) {
            for (const val of Object.values(params)) {
                const keys = Array.isArray(val) ? val : typeof val === "string" ? [val] : [];
                for (const k of keys) {
                    const resolved = resolveField(k as string);
                    if (resolved) {
                        usedFields.push({
                            key: k as string,
                            table: resolved.table,
                            label: resolved.field.label,
                            dataType: resolved.field.dataType,
                        });
                    }
                }
            }
        }
    }

    const formula = buildFormula(definition, userMeasure?.config as Record<string, unknown> | undefined);

    // Group used fields by table for display
    const fieldsByTable: Record<string, typeof usedFields> = {};
    for (const f of usedFields) {
        if (!fieldsByTable[f.table]) fieldsByTable[f.table] = [];
        fieldsByTable[f.table].push(f);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-[460px] max-w-[90vw] max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl" style={{ backgroundColor: `${catMeta.color}15` }}>
                            <CatIcon size={16} style={{ color: catMeta.color }} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                {userMeasure?.name ?? definition.label}
                            </h3>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">{catMeta.label} • {definition.type}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <X size={16} className="text-gray-500" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Description */}
                    <div>
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Description</h4>
                        <p className="text-xs text-gray-700 dark:text-gray-300">{definition.description}</p>
                    </div>

                    {/* Formula */}
                    <div>
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Formula</h4>
                        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3">
                            <code className="text-xs font-mono text-[#FF7300] break-all">{formula}</code>
                        </div>
                    </div>

                    {/* Parameters */}
                    <div>
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Parameters</h4>
                        <div className="space-y-2">
                            {definition.params.map((p) => (
                                <div key={p.name} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{p.type}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{p.label}</p>
                                        {p.description && <p className="text-[9px] text-gray-400 truncate">{p.description}</p>}
                                    </div>
                                    {p.required && <span className="text-[8px] text-red-400 font-bold uppercase">Required</span>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Fields & Tables Used (only for user measures with config) */}
                    {usedFields.length > 0 && (
                        <div>
                            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Fields & Tables Used</h4>
                            <div className="space-y-3">
                                {Object.entries(fieldsByTable).map(([table, fields]) => (
                                    <div key={table} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                            <Database size={10} className="text-[#FF7300]" />
                                            <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">{table}</span>
                                        </div>
                                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {fields.map((f) => (
                                                <div key={f.key} className="flex items-center justify-between px-4 py-1.5">
                                                    <span className="text-[11px] text-gray-700 dark:text-gray-300">{f.label}</span>
                                                    <span className="text-[9px] font-mono text-gray-400">{f.dataType}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* For catalog (no config): show available data sources */}
                    {!userMeasure && (
                        <div>
                            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Available Data Sources</h4>
                            <div className="flex flex-wrap gap-1.5">
                                {FIELD_CATALOG.map((g) => (
                                    <span key={g.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-[9px] text-gray-600 dark:text-gray-400">
                                        <Database size={8} className="text-[#FF7300]" />
                                        {g.parentLabel ? `${g.parentLabel} › ${g.label}` : g.label}
                                        <span className="text-gray-300 dark:text-gray-600">({g.fields.length})</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Author info for user measures */}
                    {userMeasure && (
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span className="text-[9px] text-gray-400">Created by {userMeasure.authorName || "Unknown"}</span>
                            <span className="text-[9px] text-gray-400">{new Date(userMeasure.createdAt).toLocaleDateString()}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
