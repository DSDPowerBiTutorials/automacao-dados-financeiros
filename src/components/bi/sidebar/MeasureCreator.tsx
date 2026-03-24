"use client";

import { useState } from "react";
import { X, Check, Loader2, ChevronDown, Database, Plus, Trash2, AlertCircle } from "lucide-react";
import { type MeasureDefinition } from "@/lib/bi-types";
import { MEASURE_CATALOG } from "@/lib/bi-measure-catalog";
import { FIELD_CATALOG } from "@/lib/bi-field-catalog";
import { useAuth } from "@/contexts/auth-context";

interface MeasureCreatorProps {
    onClose: () => void;
    onCreated: () => void;
}

/* ── Resolve display label for a field key ── */
function resolveFieldLabel(key: string): string {
    for (const group of FIELD_CATALOG) {
        const field = group.fields.find((f) => f.key === key);
        if (field) {
            const prefix = group.parentLabel ? `${group.parentLabel} › ${group.label}` : group.label;
            return `${prefix} › ${field.label}`;
        }
    }
    return key;
}

/* ── Field Picker Dropdown (hierarchical: source → column) ── */
function FieldPickerDropdown({ value, onChange, exclude }: { value: string; onChange: (v: string) => void; exclude?: string[] }) {
    const [open, setOpen] = useState(false);
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

    const displayLabel = value ? resolveFieldLabel(value) : null;

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
                                        {group.fields.map((field) => {
                                            const isExcluded = exclude?.includes(field.key);
                                            return (
                                                <button
                                                    key={field.key}
                                                    type="button"
                                                    disabled={isExcluded}
                                                    onClick={() => {
                                                        onChange(field.key);
                                                        setOpen(false);
                                                    }}
                                                    className={`w-full text-left px-6 py-1.5 text-[11px] transition-colors ${
                                                        isExcluded
                                                            ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                                                            : value === field.key
                                                                ? "bg-[#FF7300]/10 text-[#FF7300] font-medium"
                                                                : "text-gray-700 dark:text-gray-300 hover:bg-[#FF7300]/10"
                                                    }`}
                                                >
                                                    {field.label}
                                                    <span className="ml-1.5 text-[9px] text-gray-400">{field.dataType}</span>
                                                </button>
                                            );
                                        })}
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

/* ── Multi-Field Picker (add/remove multiple fields, Power BI style) ── */
function MultiFieldPicker({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
    function addField() {
        onChange([...values, ""]);
    }
    function removeField(idx: number) {
        onChange(values.filter((_, i) => i !== idx));
    }
    function updateField(idx: number, val: string) {
        const next = [...values];
        next[idx] = val;
        onChange(next);
    }

    const selectedKeys = values.filter(Boolean);

    return (
        <div className="space-y-1.5">
            {values.map((v, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                    <div className="flex-1">
                        <FieldPickerDropdown
                            value={v}
                            onChange={(val) => updateField(idx, val)}
                            exclude={selectedKeys.filter((k) => k !== v)}
                        />
                    </div>
                    {values.length > 1 && (
                        <button
                            type="button"
                            onClick={() => removeField(idx)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                            <Trash2 size={12} />
                        </button>
                    )}
                </div>
            ))}
            <button
                type="button"
                onClick={addField}
                className="flex items-center gap-1.5 text-[10px] font-medium text-[#FF7300] hover:text-[#e66800] transition-colors mt-1"
            >
                <Plus size={10} />
                Add Field
            </button>
            {selectedKeys.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                    {selectedKeys.map((key) => (
                        <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FF7300]/10 text-[#FF7300] text-[9px] font-medium">
                            {resolveFieldLabel(key).split(" › ").pop()}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

export function MeasureCreator({ onClose, onCreated }: MeasureCreatorProps) {
    const { user, profile } = useAuth();
    const [step, setStep] = useState<"select" | "configure">("select");
    const [selected, setSelected] = useState<MeasureDefinition | null>(null);
    const [name, setName] = useState("");
    const [paramValues, setParamValues] = useState<Record<string, string>>({});
    const [multiFieldValues, setMultiFieldValues] = useState<Record<string, string[]>>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const categories = [...new Set(MEASURE_CATALOG.map((m) => m.category))];

    async function handleCreate() {
        if (!selected || !name.trim()) return;
        setError(null);
        setSaving(true);
        try {
            const config: Record<string, unknown> = { params: { ...paramValues } };
            for (const [key, vals] of Object.entries(multiFieldValues)) {
                const filtered = vals.filter(Boolean);
                if (filtered.length > 0) {
                    config.params = { ...(config.params as Record<string, string>), [key]: filtered };
                }
            }

            const res = await fetch("/api/bi/measures", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    measureType: selected.type,
                    config,
                    isPublic: false,
                    authorId: user?.id ?? "",
                    authorName: profile?.name ?? profile?.email ?? "",
                }),
            });
            const data = await res.json();
            if (data.success) {
                onCreated();
            } else {
                setError(data.error || "Failed to create measure");
            }
        } catch (err) {
            console.error("Create measure error:", err);
            setError("Network error — please try again");
        } finally {
            setSaving(false);
        }
    }

    function handleSelectMeasure(m: MeasureDefinition) {
        setSelected(m);
        setName(m.label);
        setError(null);
        const mfv: Record<string, string[]> = {};
        for (const p of m.params) {
            if (p.type === "fields") {
                mfv[p.name] = [""];
            }
        }
        setMultiFieldValues(mfv);
        setParamValues({});
        setStep("configure");
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
                                                onClick={() => handleSelectMeasure(m)}
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

                                {param.type === "fields" ? (
                                    <MultiFieldPicker
                                        values={multiFieldValues[param.name] ?? [""]}
                                        onChange={(vals) => setMultiFieldValues({ ...multiFieldValues, [param.name]: vals })}
                                    />
                                ) : param.type === "field" ? (
                                    <FieldPickerDropdown
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

                        {/* Error message */}
                        {error && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                                <AlertCircle size={12} className="text-red-500 shrink-0" />
                                <p className="text-[10px] text-red-600 dark:text-red-400">{error}</p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => { setStep("select"); setError(null); }}
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


