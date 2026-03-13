"use client";

import { type ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import { Info, Database, ArrowRight, BookOpen } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getDataSheetByRoute, type DataSheetEntry } from "@/lib/page-data-sheets";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    /** Right-side content (badges, stats, buttons, etc.) */
    children?: ReactNode;
    /** Override auto-detected data sheet (or pass false to hide) */
    dataSheet?: DataSheetEntry | false;
}

/**
 * Standardized page header component — modern, minimal design.
 * Consistent across all pages with a subtle left accent line.
 * Automatically shows "Ficha Técnica" popover based on current route.
 */
export function PageHeader({ title, subtitle, children, dataSheet }: PageHeaderProps) {
    const pathname = usePathname();
    const [lang, setLang] = useState<"en" | "es">("en");
    const t = (obj: { en: string; es: string }) => obj[lang];

    // Auto-detect data sheet from route, unless explicitly overridden
    const sheet = dataSheet === false ? undefined : (dataSheet || getDataSheetByRoute(pathname));

    return (
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
            <div className="flex items-center gap-4 pl-0 pr-6 py-4">
                {/* Left accent bar */}
                <div className="w-1 self-stretch rounded-r-full bg-gradient-to-b from-blue-500 to-indigo-600 flex-shrink-0" />

                {/* Title area */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight leading-tight">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                                {subtitle}
                            </p>
                        )}
                    </div>

                    {/* Ficha Técnica popover */}
                    {sheet && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <button
                                    className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    title={lang === "en" ? "Technical Data Sheet" : "Ficha Técnica"}
                                >
                                    <Info className="h-4 w-4" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                align="start"
                                className="w-[420px] p-0 bg-white dark:bg-black border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl"
                            >
                                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="h-4 w-4 text-blue-500" />
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                            {lang === "en" ? "Technical Data Sheet" : "Ficha Técnica"}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setLang("en")}
                                            className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${lang === "en" ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
                                        >EN</button>
                                        <button
                                            onClick={() => setLang("es")}
                                            className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${lang === "es" ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
                                        >ES</button>
                                    </div>
                                </div>
                                <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                                    {/* Data Sources */}
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <Database className="h-3.5 w-3.5 text-emerald-500" />
                                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                                {lang === "en" ? "Data Sources" : "Fuentes de Datos"}
                                            </span>
                                        </div>
                                        <div className="space-y-1.5">
                                            {sheet.dataSources.map((src, i) => (
                                                <div key={i} className="flex items-start gap-2 text-xs">
                                                    <code className="flex-shrink-0 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded font-mono text-[10px]">
                                                        {src.table}
                                                    </code>
                                                    <span className="text-gray-600 dark:text-gray-400">{t(src.description)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Feed Instructions */}
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <ArrowRight className="h-3.5 w-3.5 text-amber-500" />
                                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                                {lang === "en" ? "How to Feed" : "Cómo Alimentar"}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                            {t(sheet.feedInstructions)}
                                        </p>
                                    </div>

                                    {/* Enrichment Chain */}
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <span className="text-xs">🔗</span>
                                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                                {lang === "en" ? "Data Flow" : "Flujo de Datos"}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-mono bg-gray-50 dark:bg-gray-900 rounded-md px-3 py-2">
                                            {t(sheet.enrichmentChain)}
                                        </p>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                </div>

                {/* Right-side slot */}
                {children && (
                    <div className="flex-shrink-0">
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
}
