"use client";

import { useState, useRef, useEffect } from "react";
import { Compass, CheckCircle2, ChevronRight } from "lucide-react";
import { useTour } from "@/contexts/tour-context";

export function TourMenu() {
    const { availableTours, completedTours, startTour, tourLang, setTourLang } = useTour();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const t = (en: string, es: string) => tourLang === "en" ? en : es;

    return (
        <div ref={ref} className="position-relative" data-tour="tour-menu">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
                title={t("Guided Tours", "Tours Guiados")}
                aria-label={t("Guided Tours", "Tours Guiados")}
            >
                <Compass size={20} className="text-gray-700 dark:text-gray-300" />
            </button>

            {open && (
                <div className="position-absolute end-0 mt-1" style={{ zIndex: 9999, width: "280px" }}>
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
                        {/* Header */}
                        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t("Guided Tours", "Tours Guiados")}
                            </span>
                            <div className="flex items-center rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <button
                                    onClick={() => setTourLang("en")}
                                    className={`px-1.5 py-0.5 text-[10px] font-medium transition-colors ${tourLang === "en" ? "bg-orange-500 text-white" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                                >
                                    EN
                                </button>
                                <button
                                    onClick={() => setTourLang("es")}
                                    className={`px-1.5 py-0.5 text-[10px] font-medium transition-colors ${tourLang === "es" ? "bg-orange-500 text-white" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                                >
                                    ES
                                </button>
                            </div>
                        </div>

                        {/* Tour list */}
                        <div className="py-1">
                            {availableTours.map((tour) => {
                                const done = completedTours.has(tour.id);
                                return (
                                    <button
                                        key={tour.id}
                                        type="button"
                                        onClick={() => { setOpen(false); startTour(tour.id); }}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
                                    >
                                        {done ? (
                                            <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                                        ) : (
                                            <ChevronRight size={14} className="text-orange-500 flex-shrink-0" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                {tourLang === "en" ? tour.titleEN : tour.titleES}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                {tourLang === "en" ? tour.descriptionEN : tour.descriptionES}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Footer hint */}
                        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800">
                            <p className="text-[10px] text-gray-400 dark:text-gray-500">
                                {t(
                                    "More tours available on specific pages",
                                    "Más tours disponibles en páginas específicas"
                                )}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
