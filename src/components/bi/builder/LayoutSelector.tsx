"use client";

import { X, Maximize2 } from "lucide-react";
import { type SlotLayoutType } from "@/lib/bi-types";

interface LayoutSelectorProps {
    canExpand: boolean;
    onSelect: (layout: SlotLayoutType) => void;
    onExpand: () => void;
    onClose: () => void;
}

const STANDARD_LAYOUTS: { type: SlotLayoutType; label: string; preview: string }[] = [
    { type: "5cards", label: "5 Cards", preview: "■ ■ ■ ■ ■" },
    { type: "4cards", label: "4 Cards", preview: "■ ■ ■ ■" },
    { type: "2cards-1chart", label: "2 Cards + 1 Chart", preview: "■ ■ 📊" },
    { type: "1card-1chart", label: "1 Card + 1 Chart", preview: "■ 📊" },
];

const EXPANDED_LAYOUTS: { type: SlotLayoutType; label: string; preview: string }[] = [
    { type: "5cards-1chart", label: "5 Cards + 1 Chart", preview: "■ ■ ■ ■ ■\n      📊" },
    { type: "5cards-2charts", label: "5 Cards + 2 Charts", preview: "■ ■ ■ ■ ■\n   📊 📊" },
    { type: "4cards-1chart", label: "4 Cards + 1 Chart", preview: "■ ■ ■ ■\n    📊" },
    { type: "3cards-1chart", label: "3 Cards + 1 Chart", preview: "■ ■ ■ 📊" },
    { type: "2cards-2charts", label: "2 Cards + 2 Charts", preview: "■ ■\n📊 📊" },
];

export function LayoutSelector({ canExpand, onSelect, onExpand, onClose }: LayoutSelectorProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-[600px] max-w-[90vw] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Choose Layout</h3>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Select how this section should be organized</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <X size={16} className="text-gray-500" />
                    </button>
                </div>

                {/* Standard Layouts */}
                <div className="p-5">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Standard Layouts</h4>
                    <div className="grid grid-cols-2 gap-3">
                        {STANDARD_LAYOUTS.map((layout) => (
                            <button
                                key={layout.type}
                                onClick={() => onSelect(layout.type)}
                                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-[#FF7300] hover:bg-[#FF7300]/5 transition-all group"
                            >
                                <span className="text-xl whitespace-pre-line">{layout.preview}</span>
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-[#FF7300]">{layout.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Expand Option */}
                {canExpand && (
                    <div className="px-5 pb-3">
                        <button
                            onClick={onExpand}
                            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-[#FF7300] hover:bg-[#FF7300]/5 transition-all group"
                        >
                            <Maximize2 size={16} className="text-gray-400 group-hover:text-[#FF7300]" />
                            <span className="text-xs font-medium text-gray-500 group-hover:text-[#FF7300]">
                                Expand to double size (merge with next slot)
                            </span>
                        </button>
                    </div>
                )}

                {/* Expanded Layouts (shown when slot is already expanded or after expand) */}
                <div className="px-5 pb-5">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Expanded Layouts (Double Height)</h4>
                    <div className="grid grid-cols-2 gap-3">
                        {EXPANDED_LAYOUTS.map((layout) => (
                            <button
                                key={layout.type}
                                onClick={() => onSelect(layout.type)}
                                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-[#FF7300] hover:bg-[#FF7300]/5 transition-all group"
                            >
                                <span className="text-lg whitespace-pre-line leading-relaxed">{layout.preview}</span>
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-[#FF7300]">{layout.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
