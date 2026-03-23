"use client";

import { type DashboardSlot } from "@/lib/bi-types";
import { SlotPlaceholder } from "./SlotPlaceholder";
import { SlotRenderer } from "./SlotRenderer";

interface DashboardCanvasProps {
    slots: DashboardSlot[];
    onUpdateSlot: (index: number, updates: Partial<DashboardSlot>) => void;
    onExpandSlot: (index: number) => void;
}

export function DashboardCanvas({ slots, onUpdateSlot, onExpandSlot }: DashboardCanvasProps) {
    return (
        <div className="space-y-4">
            {slots.map((slot, index) => (
                <div
                    key={slot.id}
                    className={`transition-all ${slot.slotSize === 2 ? "min-h-[400px]" : "min-h-[200px]"}`}
                >
                    {slot.layoutType === "empty" ? (
                        <SlotPlaceholder
                            slotIndex={index}
                            canExpand={index < slots.length - 1 && slots[index + 1]?.layoutType === "empty"}
                            onSelectLayout={(layoutType) => onUpdateSlot(index, { layoutType, config: getDefaultConfig(layoutType) })}
                            onExpand={() => onExpandSlot(index)}
                        />
                    ) : (
                        <SlotRenderer
                            slot={slot}
                            onUpdateSlot={(updates) => onUpdateSlot(index, updates)}
                            onClear={() => onUpdateSlot(index, { layoutType: "empty", config: { cards: [], charts: [] } })}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}

function getDefaultConfig(layoutType: string) {
    const emptyCard = () => ({ measureId: null, label: "", icon: undefined, color: undefined, format: "currency" as const });
    const emptyChart = () => ({ chartType: "bar" as const, measureIds: [], title: "", showLegend: true, showGrid: true });

    switch (layoutType) {
        case "5cards":
            return { cards: Array.from({ length: 5 }, emptyCard), charts: [] };
        case "4cards":
            return { cards: Array.from({ length: 4 }, emptyCard), charts: [] };
        case "2cards-1chart":
            return { cards: Array.from({ length: 2 }, emptyCard), charts: [emptyChart()] };
        case "1card-1chart":
            return { cards: [emptyCard()], charts: [emptyChart()] };
        case "5cards-1chart":
            return { cards: Array.from({ length: 5 }, emptyCard), charts: [emptyChart()] };
        case "5cards-2charts":
            return { cards: Array.from({ length: 5 }, emptyCard), charts: [emptyChart(), emptyChart()] };
        case "4cards-1chart":
            return { cards: Array.from({ length: 4 }, emptyCard), charts: [emptyChart()] };
        case "3cards-1chart":
            return { cards: Array.from({ length: 3 }, emptyCard), charts: [emptyChart()] };
        case "2cards-2charts":
            return { cards: Array.from({ length: 2 }, emptyCard), charts: [emptyChart(), emptyChart()] };
        default:
            return { cards: [], charts: [] };
    }
}
