"use client";

import { useState } from "react";
import { Plus, Maximize2 } from "lucide-react";
import { type SlotLayoutType } from "@/lib/bi-types";
import { LayoutSelector } from "./LayoutSelector";

interface SlotPlaceholderProps {
    slotIndex: number;
    canExpand: boolean;
    onSelectLayout: (layout: SlotLayoutType) => void;
    onExpand: () => void;
}

export function SlotPlaceholder({ slotIndex, canExpand, onSelectLayout, onExpand }: SlotPlaceholderProps) {
    const [showSelector, setShowSelector] = useState(false);

    return (
        <>
            <button
                onClick={() => setShowSelector(true)}
                className="w-full min-h-[180px] border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl bg-white/50 dark:bg-[#111111]/50 hover:border-[#FF7300] hover:bg-[#FF7300]/5 dark:hover:bg-[#FF7300]/5 transition-all flex flex-col items-center justify-center gap-2 group cursor-pointer"
            >
                <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-800 group-hover:bg-[#FF7300]/10 transition-colors">
                    <Plus size={24} className="text-gray-400 group-hover:text-[#FF7300] transition-colors" />
                </div>
                <span className="text-xs font-medium text-gray-400 group-hover:text-[#FF7300] transition-colors">
                    Click to add content — Slot {slotIndex + 1}
                </span>
            </button>

            {showSelector && (
                <LayoutSelector
                    canExpand={canExpand}
                    onSelect={(layout) => {
                        onSelectLayout(layout);
                        setShowSelector(false);
                    }}
                    onExpand={() => {
                        onExpand();
                        setShowSelector(false);
                    }}
                    onClose={() => setShowSelector(false)}
                />
            )}
        </>
    );
}
