"use client";

import { Trash2 } from "lucide-react";
import { type DashboardSlot, type CardWidgetConfig, type ChartWidgetConfig } from "@/lib/bi-types";
import { CardWidget } from "./CardWidget";
import { ChartWidget } from "./ChartWidget";

interface SlotRendererProps {
    slot: DashboardSlot;
    onUpdateSlot: (updates: Partial<DashboardSlot>) => void;
    onClear: () => void;
}

export function SlotRenderer({ slot, onUpdateSlot, onClear }: SlotRendererProps) {
    const { config, layoutType, slotSize } = slot;
    const sid = slot.id; // stable prefix for drop IDs

    const updateCard = (cardIndex: number, updates: Partial<CardWidgetConfig>) => {
        const newCards = [...config.cards];
        newCards[cardIndex] = { ...newCards[cardIndex], ...updates };
        onUpdateSlot({ config: { ...config, cards: newCards } });
    };

    const updateChart = (chartIndex: number, updates: Partial<ChartWidgetConfig>) => {
        const newCharts = [...config.charts];
        newCharts[chartIndex] = { ...newCharts[chartIndex], ...updates };
        onUpdateSlot({ config: { ...config, charts: newCharts } });
    };

    const renderLayout = () => {
        switch (layoutType) {
            case "5cards":
                return (
                    <div className="grid grid-cols-5 gap-3">
                        {config.cards.map((card, i) => (
                            <CardWidget key={i} config={card} onUpdate={(u) => updateCard(i, u)} dropId={`${sid}-card-${i}`} />
                        ))}
                    </div>
                );

            case "4cards":
                return (
                    <div className="grid grid-cols-4 gap-3">
                        {config.cards.map((card, i) => (
                            <CardWidget key={i} config={card} onUpdate={(u) => updateCard(i, u)} dropId={`${sid}-card-${i}`} />
                        ))}
                    </div>
                );

            case "2cards-1chart":
                return (
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1 flex flex-col gap-3">
                            {config.cards.map((card, i) => (
                                <CardWidget key={i} config={card} onUpdate={(u) => updateCard(i, u)} dropId={`${sid}-card-${i}`} />
                            ))}
                        </div>
                        <div className="col-span-2">
                            {config.charts[0] && (
                                <ChartWidget config={config.charts[0]} onUpdate={(u) => updateChart(0, u)} height={slotSize === 2 ? 350 : 180} dropId={`${sid}-chart-0`} />
                            )}
                        </div>
                    </div>
                );

            case "1card-1chart":
                return (
                    <div className="grid grid-cols-2 gap-3">
                        <div>{config.cards[0] && <CardWidget config={config.cards[0]} onUpdate={(u) => updateCard(0, u)} dropId={`${sid}-card-0`} />}</div>
                        <div>{config.charts[0] && <ChartWidget config={config.charts[0]} onUpdate={(u) => updateChart(0, u)} height={slotSize === 2 ? 350 : 180} dropId={`${sid}-chart-0`} />}</div>
                    </div>
                );

            case "5cards-1chart":
                return (
                    <div className="space-y-3">
                        <div className="grid grid-cols-5 gap-3">
                            {config.cards.map((card, i) => (
                                <CardWidget key={i} config={card} onUpdate={(u) => updateCard(i, u)} dropId={`${sid}-card-${i}`} />
                            ))}
                        </div>
                        {config.charts[0] && (
                            <ChartWidget config={config.charts[0]} onUpdate={(u) => updateChart(0, u)} height={260} dropId={`${sid}-chart-0`} />
                        )}
                    </div>
                );

            case "5cards-2charts":
                return (
                    <div className="space-y-3">
                        <div className="grid grid-cols-5 gap-3">
                            {config.cards.map((card, i) => (
                                <CardWidget key={i} config={card} onUpdate={(u) => updateCard(i, u)} dropId={`${sid}-card-${i}`} />
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {config.charts.map((chart, i) => (
                                <ChartWidget key={i} config={chart} onUpdate={(u) => updateChart(i, u)} height={220} dropId={`${sid}-chart-${i}`} />
                            ))}
                        </div>
                    </div>
                );

            case "4cards-1chart":
                return (
                    <div className="space-y-3">
                        <div className="grid grid-cols-4 gap-3">
                            {config.cards.map((card, i) => (
                                <CardWidget key={i} config={card} onUpdate={(u) => updateCard(i, u)} dropId={`${sid}-card-${i}`} />
                            ))}
                        </div>
                        {config.charts[0] && (
                            <ChartWidget config={config.charts[0]} onUpdate={(u) => updateChart(0, u)} height={260} dropId={`${sid}-chart-0`} />
                        )}
                    </div>
                );

            case "3cards-1chart":
                return (
                    <div className="grid grid-cols-4 gap-3">
                        <div className="col-span-2 flex flex-col gap-3">
                            {config.cards.map((card, i) => (
                                <CardWidget key={i} config={card} onUpdate={(u) => updateCard(i, u)} dropId={`${sid}-card-${i}`} />
                            ))}
                        </div>
                        <div className="col-span-2">
                            {config.charts[0] && (
                                <ChartWidget config={config.charts[0]} onUpdate={(u) => updateChart(0, u)} height={slotSize === 2 ? 350 : 200} dropId={`${sid}-chart-0`} />
                            )}
                        </div>
                    </div>
                );

            case "2cards-2charts":
                return (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            {config.cards.map((card, i) => (
                                <CardWidget key={i} config={card} onUpdate={(u) => updateCard(i, u)} dropId={`${sid}-card-${i}`} />
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {config.charts.map((chart, i) => (
                                <ChartWidget key={i} config={chart} onUpdate={(u) => updateChart(i, u)} height={220} dropId={`${sid}-chart-${i}`} />
                            ))}
                        </div>
                    </div>
                );

            default:
                return <div className="text-center text-sm text-gray-400 py-8">Unknown layout: {layoutType}</div>;
        }
    };

    return (
        <div className="relative bg-white dark:bg-[#111111] border border-gray-200 dark:border-gray-800 rounded-xl p-4 group">
            {/* Clear button */}
            <button
                onClick={onClear}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 dark:hover:bg-red-900/20 z-10"
                title="Clear slot"
            >
                <Trash2 size={12} className="text-gray-400 hover:text-red-500" />
            </button>

            {/* Layout type badge */}
            <div className="absolute top-2 left-3 text-[9px] font-medium text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                {layoutType} {slotSize === 2 && "• 2x"}
            </div>

            <div className="pt-2">
                {renderLayout()}
            </div>
        </div>
    );
}
