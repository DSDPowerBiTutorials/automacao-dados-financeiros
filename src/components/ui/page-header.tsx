"use client";

import { type ReactNode } from "react";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    /** Right-side content (badges, stats, buttons, etc.) */
    children?: ReactNode;
}

/**
 * Standardized page header component — modern, minimal design.
 * Consistent across all pages with a subtle left accent line.
 *
 * Usage:
 * ```tsx
 * <PageHeader title="Cashflow Summary" subtitle="196 transactions • Bankinter EUR, Sabadell EUR">
 *   <div className="text-right">...</div>
 * </PageHeader>
 * ```
 */
export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
    return (
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
            <div className="flex items-center gap-4 pl-0 pr-6 py-4">
                {/* Left accent bar */}
                <div className="w-1 self-stretch rounded-r-full bg-gradient-to-b from-blue-500 to-indigo-600 flex-shrink-0" />

                {/* Title area */}
                <div className="flex-1 min-w-0">
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight leading-tight">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                            {subtitle}
                        </p>
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
