"use client";

import { useState } from "react";
import { X, Check, Loader2, ChevronDown, Database } from "lucide-react";
import { type MeasureDefinition } from "@/lib/bi-types";
import { MEASURE_CATALOG } from "@/lib/bi-measure-catalog";
import { FIELD_CATALOG } from "@/lib/bi-field-catalog";

interface MeasureCreatorProps {
    onClose: () => void;
    onCreated: () => void;
}

/* ── Field Picker (hierarchical: source → column) ── */
function FieldPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [open, setOpen] = useState(false);
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

    // Resolve display label for current value
    const displayLabel = (() => {
        if (!value) return null;
        for (const group of FIELD_CATALOG) {
            const field = group.fields.find((f) => f.key === value);
            if (field) {
                const prefix = group.parentLabel ? `${group.parentLabel} › ${group.label}` : group.label;
                return `${prefix} › ${field.label}`;
            }
        }
        return value;
    })();

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white hover:border-[#FF7300] transition-colors text-left"
            >
                {displayLabel ? (
                    <span className="truncate">{displayLabel}</span>
                ) : (
                    <span className="text-gray-400">Select a field…</span>
                )}
                <ChevronDown size={12} className={`text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] shadow-lg">
                    {FIELD_CATALOG.map((group) => {
                        const groupLabel = group.parentLabel ? `${group.parentLabel} › ${group.label}` : group.label;
                        const isExpanded = expandedGroup === group.id;
                        return (
                            <div key={group.id}>
                                <button
                                    type="button"
                                    onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <Database size={10} className="shrink-0" />
                                    <span className="truncate">{groupLabel}</span>
                                    <ChevronDown size={10} className={`ml-auto shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                </button>
                                {isExpanded && (
                                    <div className="pb-1">
                                        {group.fields.map((field) => (
                                            <button
                                                key={field.key}
                                                type="button"
                                                onClick={() => {
                                                    onChange(field.key);
                                                    setOpen(false);
                                                }}
                                                className={`w-full text-left px-6 py-1.5 text-[11px] hover:bg-[#FF7300]/10 transition-colors ${
                                                    value === field.key
                                                        ? "bg-[#FF7300]/10 text-[#FF7300] font-medium"
                                                        : "text-gray-700 dark:text-gray-300"
                                                }`}
                                            >
                                                {field.label}
                                                <span className="ml-1.5 text-[9px] text-gray-400">{field.dataType}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function MeasureCreator({ onClose, onCreated }: MeasureCreatorProps) {
    const [step, setStep] = useState<"select" | "configure">("select");
    const [selected, setSelected] = useState<MeasureDefinition | null>(null);
    const [name, setName] = useState("");
    const [paramValues, setParamValues] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");

    const categories = [...new Set(MEASURE_CATALOG.map((m) => m.category))];

    async function handleCreate() {
        if (!selected || !name.trim()) return;
        setSaving(true);
        try {
            const res = await fetch("/api/bi/measures", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    measureType: selected.type,
                    config: { params: paramValues },
                    isPublic: false,
                }),
            });
            const data = await res.json();
            if (data.success) {
                onCreated();
            }
        } catch (err) {
            console.error("Create measure error:", err);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-[500px] max-w-[90vw] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                            {step === "select" ? "Create Measure" : `Configure: ${selected?.label}`}
                        </h3>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                            {step === "select" ? "Select a measure type from the catalog" : "Set the parameters for this measure"}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <X size={16} className="text-gray-500" />
                    </button>
                </div>

                {step === "select" ? (
                    <div className="p-5 space-y-3">
                        {/* Search */}
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search measures..."
                            className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-[#FF7300] outline-none"
                        />

                        {categories.map((cat) => {
                            const items = MEASURE_CATALOG.filter(
                                (m) => m.category === cat && (m.label.toLowerCase().includes(search.toLowerCase()) || m.type.toLowerCase().includes(search.toLowerCase()))
                            );
                            if (items.length === 0) return null;
                            return (
                                <div key={cat}>
                                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 capitalize">{cat}</h4>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {items.map((m) => (
                                            <button
                                                key={m.type}
                                                onClick={() => {
                                                    setSelected(m);
                                                    setName(m.label);
                                                    setStep("configure");
                                                }}
                                                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-[#FF7300] hover:bg-[#FF7300]/5 transition-all text-left"
                                            >
                                                <span className="text-sm">{m.icon}</span>
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate">{m.label}</p>
                                                    <p className="text-[8px] text-gray-400 truncate">{m.description}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : selected ? (
                    <div className="p-5 space-y-4">
                        {/* Measure name */}
                        <div>
                            <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Measure Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="My custom measure"
                                className="w-full mt-1 text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-[#FF7300] outline-none"
                            />
                        </div>

                        {/* Parameters */}
                        {selected.params.map((param) => (
                            <div key={param.name}>
                                <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {param.label} {param.required && <span className="text-red-400">*</span>}
                                </label>
                                <p className="text-[8px] text-gray-400 mb-1">{param.description}</p>
                                {param.type === "field" ? (
                                    <FieldPicker
                                        value={paramValues[param.name] ?? ""}
                                        onChange={(v) => setParamValues({ ...paramValues, [param.name]: v })}
                                    />
                                ) : param.type === "select" && param.options ? (
                                    <select
                                        value={paramValues[param.name] ?? param.defaultValue ?? ""}
                                        onChange={(e) => setParamValues({ ...paramValues, [param.name]: e.target.value })}
                                        className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
                                    >
                                        <option value="">Select...</option>
                                        {param.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                ) : param.type === "number" ? (
                                    <input
                                        type="number"
                                        value={paramValues[param.name] ?? param.defaultValue ?? ""}
                                        onChange={(e) => setParamValues({ ...paramValues, [param.name]: e.target.value })}
                                        className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-[#FF7300] outline-none"
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        value={paramValues[param.name] ?? param.defaultValue ?? ""}
                                        onChange={(e) => setParamValues({ ...paramValues, [param.name]: e.target.value })}
                                        placeholder={param.label}
                                        className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-[#FF7300] outline-none"
                                    />
                                )}
                            </div>
                        ))}

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setStep("select")}
                                className="px-4 py-2 rounded-lg text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!name.trim() || saving}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#FF7300] text-white text-xs font-medium hover:bg-[#e66800] disabled:opacity-50 transition-colors"
                            >
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                Create Measure
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}


