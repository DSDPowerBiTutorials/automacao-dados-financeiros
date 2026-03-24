"use client";

import { Plus, X } from "lucide-react";
import { type WidgetFilter, type FilterOperator, FILTER_OPERATORS } from "@/lib/bi-types";
import { FIELD_CATALOG, getFieldByKey } from "@/lib/bi-field-catalog";

interface FilterBuilderProps {
    filters: WidgetFilter[];
    onChange: (filters: WidgetFilter[]) => void;
}

const PRESETS = [
    { label: "Date Range", fieldKey: "ap.invoice_date" },
    { label: "Financial Account", fieldKey: "ap.financial_account_code" },
    { label: "Currency", fieldKey: "ap.currency" },
    { label: "Scope", fieldKey: "ap.scope" },
];

export function FilterBuilder({ filters, onChange }: FilterBuilderProps) {
    const addFilter = (fieldKey = "") => {
        onChange([...filters, { id: crypto.randomUUID(), fieldKey, operator: "=", value: "" }]);
    };

    const updateFilter = (id: string, updates: Partial<WidgetFilter>) => {
        onChange(filters.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const removeFilter = (id: string) => {
        onChange(filters.filter(f => f.id !== id));
    };

    return (
        <div className="space-y-1.5">
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Filters</p>

            <div className="flex flex-wrap gap-1">
                {PRESETS.map(p => (
                    <button
                        key={p.fieldKey}
                        onClick={() => addFilter(p.fieldKey)}
                        className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-[#FF7300]/10 hover:text-[#FF7300] transition-colors"
                    >
                        + {p.label}
                    </button>
                ))}
            </div>

            {filters.map(f => {
                const field = getFieldByKey(f.fieldKey);
                const allowedOps = FILTER_OPERATORS.filter(op => !field || op.types.includes(field.dataType));
                return (
                    <div key={f.id} className="flex items-center gap-1">
                        <select
                            value={f.fieldKey}
                            onChange={e => updateFilter(f.id, { fieldKey: e.target.value, operator: "=" })}
                            className="flex-1 text-[9px] px-1 py-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 min-w-0"
                        >
                            <option value="">Field...</option>
                            {FIELD_CATALOG.map(g => (
                                <optgroup key={g.id} label={g.parentLabel ? `${g.parentLabel} \u203a ${g.label}` : g.label}>
                                    {g.fields.map(fd => (
                                        <option key={fd.key} value={fd.key}>{fd.label}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                        <select
                            value={f.operator}
                            onChange={e => updateFilter(f.id, { operator: e.target.value as FilterOperator })}
                            className="text-[9px] px-1 py-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 w-[60px]"
                        >
                            {allowedOps.map(op => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                            ))}
                        </select>
                        <input
                            type={field?.dataType === "date" ? "date" : "text"}
                            value={f.value}
                            onChange={e => updateFilter(f.id, { value: e.target.value })}
                            placeholder="Value"
                            className="flex-1 text-[9px] px-1 py-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 min-w-0"
                        />
                        <button onClick={() => removeFilter(f.id)} className="p-0.5 text-gray-400 hover:text-red-500">
                            <X size={9} />
                        </button>
                    </div>
                );
            })}

            <button
                onClick={() => addFilter()}
                className="flex items-center gap-1 text-[9px] text-[#FF7300] hover:underline font-medium"
            >
                <Plus size={9} /> Add Filter
            </button>
        </div>
    );
}
