"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, Search, X, Loader2 } from "lucide-react";
import { type UserMeasure } from "@/lib/bi-types";
import { MEASURE_CATALOG } from "@/lib/bi-measure-catalog";
import { useAuth } from "@/contexts/auth-context";

interface MeasureSelectorProps {
    selectedId?: string | null;
    selectedIds?: string[];
    multiple?: boolean;
    onSelect?: (measureId: string, label: string) => void;
    onAdd?: (measureId: string) => void;
    onRemove?: (measureId: string) => void;
}

export function MeasureSelector({ selectedId, selectedIds, multiple, onSelect, onAdd, onRemove }: MeasureSelectorProps) {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [measures, setMeasures] = useState<UserMeasure[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const loadMeasures = useCallback(async () => {
        if (loaded) return;
        setLoading(true);
        try {
            const res = await fetch("/api/bi/measures");
            const data = await res.json();
            if (data.success) setMeasures(data.measures ?? []);
        } catch { /* network error — silent */ }
        setLoading(false);
        setLoaded(true);
    }, [loaded]);

    // Load on mount to resolve selected labels, and also when dropdown opens
    useEffect(() => { loadMeasures(); }, [loadMeasures]);

    const filtered = search.trim()
        ? measures.filter(m =>
            m.name.toLowerCase().includes(search.toLowerCase()) ||
            m.measureType.toLowerCase().includes(search.toLowerCase()))
        : measures;

    const myMeasures = filtered.filter(m => m.authorId === user?.id);
    const publicMeasures = filtered.filter(m => m.authorId !== user?.id && m.isPublic);

    const selectedLabel = selectedId
        ? measures.find(m => m.id === selectedId)?.name ?? null
        : null;

    function renderSection(title: string, items: UserMeasure[]) {
        if (items.length === 0) return null;
        return (
            <div>
                <div className="px-2 py-1 text-[8px] font-semibold uppercase tracking-wider text-gray-500 bg-gray-50/50 dark:bg-gray-800/50">
                    {title} ({items.length})
                </div>
                {items.map(m => {
                    const isSelected = multiple ? selectedIds?.includes(m.id) : selectedId === m.id;
                    const catalogDef = MEASURE_CATALOG.find(c => c.type === m.measureType);
                    return (
                        <button
                            key={m.id}
                            onClick={() => {
                                if (multiple) {
                                    if (isSelected) onRemove?.(m.id);
                                    else onAdd?.(m.id);
                                } else {
                                    onSelect?.(m.id, m.name);
                                    setOpen(false);
                                }
                            }}
                            className={`w-full flex items-center justify-between px-3 py-1.5 text-[9px] transition-colors text-left
                                ${isSelected ? "bg-[#FF7300]/10 text-[#FF7300]" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                        >
                            <span className="truncate">{m.name}</span>
                            <span className="text-[7px] font-mono text-gray-400 ml-2 shrink-0">{catalogDef?.label ?? m.measureType}</span>
                        </button>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="space-y-1">
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Measure</p>

            {multiple && selectedIds && selectedIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                    {selectedIds.map(id => {
                        const m = measures.find(c => c.id === id);
                        return (
                            <span key={id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FF7300]/10 text-[#FF7300] text-[8px] font-medium">
                                {m?.name ?? id}
                                <button onClick={() => onRemove?.(id)} className="hover:text-red-500"><X size={8} /></button>
                            </span>
                        );
                    })}
                </div>
            )}

            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[10px] text-gray-700 dark:text-gray-300 hover:border-[#FF7300] transition-colors"
            >
                <span className="truncate">{selectedLabel ?? "Select measure..."}</span>
                <ChevronDown size={10} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1a1a1a] shadow-lg max-h-48 overflow-y-auto">
                    <div className="sticky top-0 bg-white dark:bg-[#1a1a1a] p-1.5 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-gray-50 dark:bg-gray-800">
                            <Search size={9} className="text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search measures..."
                                className="flex-1 text-[9px] bg-transparent outline-none text-gray-700 dark:text-gray-300"
                                autoFocus
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-4 flex items-center justify-center">
                            <Loader2 size={14} className="animate-spin text-gray-400" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-4 px-3 text-center">
                            <p className="text-[9px] text-gray-400">
                                {search ? "No measures found" : "No measures created yet"}
                            </p>
                            {!search && (
                                <p className="text-[8px] text-gray-400 mt-1">
                                    Create measures in the Variables tab →
                                </p>
                            )}
                        </div>
                    ) : (
                        <>
                            {renderSection("My Measures", myMeasures)}
                            {renderSection("Public Measures", publicMeasures)}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
