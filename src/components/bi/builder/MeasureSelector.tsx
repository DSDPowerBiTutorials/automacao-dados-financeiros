"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { MEASURE_CATALOG, MEASURE_CATEGORIES } from "@/lib/bi-measure-catalog";

interface MeasureSelectorProps {
    selectedId?: string | null;
    selectedIds?: string[];
    multiple?: boolean;
    onSelect?: (measureType: string, label: string) => void;
    onAdd?: (measureType: string) => void;
    onRemove?: (measureType: string) => void;
}

export function MeasureSelector({ selectedId, selectedIds, multiple, onSelect, onAdd, onRemove }: MeasureSelectorProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(["aggregation"]));

    const toggleCat = (cat: string) => {
        setExpandedCats(prev => {
            const next = new Set(prev);
            next.has(cat) ? next.delete(cat) : next.add(cat);
            return next;
        });
    };

    const filtered = search.trim()
        ? MEASURE_CATALOG.filter(m => m.label.toLowerCase().includes(search.toLowerCase()) || m.description.toLowerCase().includes(search.toLowerCase()))
        : MEASURE_CATALOG;

    const selectedLabel = selectedId ? MEASURE_CATALOG.find(m => m.type === selectedId)?.label ?? selectedId : null;

    return (
        <div className="space-y-1">
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Measure</p>

            {multiple && selectedIds && selectedIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                    {selectedIds.map(id => {
                        const m = MEASURE_CATALOG.find(c => c.type === id);
                        return (
                            <span key={id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FF7300]/10 text-[#FF7300] text-[8px] font-medium">
                                {m?.label ?? id}
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

                    {MEASURE_CATEGORIES.map(cat => {
                        const items = filtered.filter(m => m.category === cat.id);
                        if (items.length === 0) return null;
                        const isExpanded = expandedCats.has(cat.id);
                        return (
                            <div key={cat.id}>
                                <button
                                    onClick={() => toggleCat(cat.id)}
                                    className="w-full flex items-center gap-1.5 px-2 py-1 text-[8px] font-semibold uppercase tracking-wider text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                                >
                                    {isExpanded ? <ChevronDown size={8} /> : <ChevronRight size={8} />}
                                    {cat.label} ({items.length})
                                </button>
                                {isExpanded && items.map(m => {
                                    const isSelected = multiple ? selectedIds?.includes(m.type) : selectedId === m.type;
                                    return (
                                        <button
                                            key={m.type}
                                            onClick={() => {
                                                if (multiple) {
                                                    if (isSelected) onRemove?.(m.type);
                                                    else onAdd?.(m.type);
                                                } else {
                                                    onSelect?.(m.type, m.label);
                                                    setOpen(false);
                                                }
                                            }}
                                            className={`w-full flex items-center gap-2 px-3 py-1 text-[9px] transition-colors text-left
                                                ${isSelected ? "bg-[#FF7300]/10 text-[#FF7300]" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                                        >
                                            <span className="truncate">{m.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
