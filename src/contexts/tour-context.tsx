"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { TOURS, type TourDefinition, type TourLang } from "@/lib/tour-definitions";
import { X, Compass } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STORAGE_KEY_COMPLETED = "dsd-tours-completed";
const STORAGE_KEY_DISMISSED = "dsd-tour-banner-dismissed";
const STORAGE_KEY_LANG = "dsd-tour-lang";

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

interface TourContextType {
    /** Start a tour by its ID */
    startTour: (tourId: string) => void;
    /** Tours available on the current page */
    availableTours: TourDefinition[];
    /** Set of completed tour IDs */
    completedTours: Set<string>;
    /** Tour language */
    tourLang: TourLang;
    setTourLang: (lang: TourLang) => void;
    /** Whether a tour is currently running */
    isRunning: boolean;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function useTour() {
    const ctx = useContext(TourContext);
    if (!ctx) throw new Error("useTour must be used within TourProvider");
    return ctx;
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function TourProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname() || "/";
    const [completedTours, setCompletedTours] = useState<Set<string>>(new Set());
    const [tourLang, setTourLangState] = useState<TourLang>("en");
    const [isRunning, setIsRunning] = useState(false);
    const [bannerDismissed, setBannerDismissed] = useState(true); // default true so no flash
    const [mounted, setMounted] = useState(false);

    // Load persisted state
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_COMPLETED);
            if (raw) setCompletedTours(new Set(JSON.parse(raw)));

            const lang = localStorage.getItem(STORAGE_KEY_LANG);
            if (lang === "en" || lang === "es") setTourLangState(lang);

            const dismissed = localStorage.getItem(STORAGE_KEY_DISMISSED);
            setBannerDismissed(dismissed === "true");
        } catch { /* ignore */ }
        setMounted(true);
    }, []);

    const setTourLang = useCallback((lang: TourLang) => {
        setTourLangState(lang);
        try { localStorage.setItem(STORAGE_KEY_LANG, lang); } catch { /* ignore */ }
    }, []);

    const markCompleted = useCallback((tourId: string) => {
        setCompletedTours((prev) => {
            const next = new Set(prev);
            next.add(tourId);
            try { localStorage.setItem(STORAGE_KEY_COMPLETED, JSON.stringify([...next])); } catch { /* ignore */ }
            return next;
        });
    }, []);

    const dismissBanner = useCallback(() => {
        setBannerDismissed(true);
        try { localStorage.setItem(STORAGE_KEY_DISMISSED, "true"); } catch { /* ignore */ }
    }, []);

    // Tours available on current page
    const availableTours = TOURS.filter(
        (tour) => !tour.pagePath || pathname.startsWith(tour.pagePath)
    );

    const startTour = useCallback(async (tourId: string) => {
        const tour = TOURS.find((t) => t.id === tourId);
        if (!tour) return;

        // Dynamic import driver.js (only loaded when needed)
        const { driver } = await import("driver.js");
        await import("driver.js/dist/driver.css");

        const lang = tourLang;

        const driverObj = driver({
            showProgress: true,
            animate: true,
            allowClose: true,
            overlayColor: "rgba(0, 0, 0, 0.6)",
            popoverClass: "dsd-tour-popover",
            nextBtnText: lang === "en" ? "Next →" : "Siguiente →",
            prevBtnText: lang === "en" ? "← Back" : "← Atrás",
            doneBtnText: lang === "en" ? "Done ✓" : "Listo ✓",
            progressText: lang === "en" ? "{{current}} of {{total}}" : "{{current}} de {{total}}",
            steps: tour.steps
                .filter((step) => document.querySelector(step.element))
                .map((step) => ({
                    element: step.element,
                    popover: {
                        title: lang === "en" ? step.titleEN : step.titleES,
                        description: lang === "en" ? step.descriptionEN : step.descriptionES,
                        side: step.side || "bottom",
                    },
                })),
            onDestroyed: () => {
                markCompleted(tourId);
                setIsRunning(false);
                dismissBanner();
            },
        });

        if (driverObj) {
            setIsRunning(true);
            driverObj.drive();
        }
    }, [tourLang, markCompleted, dismissBanner]);

    return (
        <TourContext.Provider value={{ startTour, availableTours, completedTours, tourLang, setTourLang, isRunning }}>
            {children}
            {/* First-visit banner */}
            {mounted && !bannerDismissed && !isRunning && (
                <TourBanner
                    lang={tourLang}
                    onStart={() => { dismissBanner(); startTour("welcome"); }}
                    onDismiss={dismissBanner}
                    onLangChange={setTourLang}
                />
            )}
        </TourContext.Provider>
    );
}

/* ------------------------------------------------------------------ */
/*  First-visit Banner                                                 */
/* ------------------------------------------------------------------ */

function TourBanner({
    lang,
    onStart,
    onDismiss,
    onLangChange,
}: {
    lang: TourLang;
    onStart: () => void;
    onDismiss: () => void;
    onLangChange: (lang: TourLang) => void;
}) {
    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[95%] max-w-lg animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-gray-900 border border-orange-200 dark:border-orange-800 rounded-xl shadow-2xl p-4">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                        <Compass size={22} className="text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">
                            {lang === "en" ? "Welcome to DSD Finance Hub! 👋" : "¡Bienvenido a DSD Finance Hub! 👋"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {lang === "en"
                                ? "Take a quick tour to learn the interface, or explore on your own."
                                : "Haz un tour rápido para conocer la interfaz, o explora por tu cuenta."
                            }
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                            <button
                                onClick={onStart}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                            >
                                {lang === "en" ? "Start Tour" : "Iniciar Tour"}
                            </button>
                            <button
                                onClick={onDismiss}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                                {lang === "en" ? "Maybe later" : "Quizás después"}
                            </button>
                            <div className="ml-auto flex items-center rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <button
                                    onClick={() => onLangChange("en")}
                                    className={`px-2 py-1 text-[10px] font-medium transition-colors ${lang === "en" ? "bg-orange-500 text-white" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                                >
                                    EN
                                </button>
                                <button
                                    onClick={() => onLangChange("es")}
                                    className={`px-2 py-1 text-[10px] font-medium transition-colors ${lang === "es" ? "bg-orange-500 text-white" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                                >
                                    ES
                                </button>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onDismiss}
                        className="flex-shrink-0 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        aria-label="Dismiss"
                    >
                        <X size={16} className="text-gray-400" />
                    </button>
                </div>
            </div>
        </div>
    );
}
