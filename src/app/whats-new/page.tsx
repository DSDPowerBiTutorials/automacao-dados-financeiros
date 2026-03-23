"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lightbulb, Sparkles, Wrench, Bug, ArrowLeft, Calendar } from "lucide-react";
import { WHATS_NEW_ITEMS, markLatestAsRead, type WhatsNewItem } from "@/lib/whats-new-data";

const TAG_STYLES: Record<WhatsNewItem["tag"], { bg: string; text: string; label: string; icon: React.ReactNode }> = {
    feature: {
        bg: "bg-emerald-100 dark:bg-emerald-900/30",
        text: "text-emerald-700 dark:text-emerald-400",
        label: "New Feature",
        icon: <Sparkles size={12} />,
    },
    improvement: {
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-blue-700 dark:text-blue-400",
        label: "Improvement",
        icon: <Wrench size={12} />,
    },
    fix: {
        bg: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-700 dark:text-red-400",
        label: "Bug Fix",
        icon: <Bug size={12} />,
    },
};

function formatDate(iso: string): string {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatShortDate(iso: string): string {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function WhatsNewPage() {
    const [selectedId, setSelectedId] = useState<number>(
        WHATS_NEW_ITEMS.length > 0 ? WHATS_NEW_ITEMS[0].id : 0,
    );

    useEffect(() => {
        markLatestAsRead();
    }, []);

    const selectedItem = WHATS_NEW_ITEMS.find((i) => i.id === selectedId) || WHATS_NEW_ITEMS[0];

    if (!selectedItem) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center">
                <div className="text-center text-gray-400">
                    <Lightbulb size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="text-lg">No updates yet</p>
                    <p className="text-sm">Check back soon for new features and improvements.</p>
                </div>
            </div>
        );
    }

    const tagStyle = TAG_STYLES[selectedItem.tag];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <Link
                        href="/dashboard"
                        className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                            <Lightbulb size={24} className="text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                What&apos;s New
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Latest updates and improvements to DSD Finance Hub
                            </p>
                        </div>
                    </div>
                </div>

                {/* Layout: Sidebar + Content */}
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Side Menu — desktop */}
                    <aside className="w-72 shrink-0 hidden md:block">
                        <div className="sticky top-24">
                            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3 px-3">
                                All Releases
                            </h3>
                            <nav className="space-y-1">
                                {WHATS_NEW_ITEMS.map((item) => {
                                    const isActive = item.id === selectedId;
                                    const itemTag = TAG_STYLES[item.tag];
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => setSelectedId(item.id)}
                                            className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${isActive
                                                    ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                                                    : "hover:bg-gray-100 dark:hover:bg-gray-800/50 border border-transparent"
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${itemTag.bg} ${itemTag.text}`}>
                                                    {itemTag.icon}
                                                    {itemTag.label}
                                                </span>
                                                <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto">
                                                    {formatShortDate(item.date)}
                                                </span>
                                            </div>
                                            <p className={`text-sm leading-snug truncate ${isActive
                                                    ? "text-amber-700 dark:text-amber-300 font-semibold"
                                                    : "text-gray-700 dark:text-gray-300"
                                                }`}>
                                                {item.title}
                                            </p>
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>
                    </aside>

                    {/* Mobile Selector */}
                    <div className="w-full md:hidden">
                        <select
                            value={selectedId}
                            onChange={(e) => setSelectedId(Number(e.target.value))}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111111] text-sm text-gray-700 dark:text-gray-300 px-3 py-2"
                        >
                            {WHATS_NEW_ITEMS.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {formatShortDate(item.date)} — {item.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Main Content */}
                    <main className="flex-1 min-w-0">
                        <article className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-gray-800 rounded-xl p-8 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                    <Calendar size={13} />
                                    {formatDate(selectedItem.date)}
                                </span>
                                <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${tagStyle.bg} ${tagStyle.text}`}
                                >
                                    {tagStyle.icon}
                                    {tagStyle.label}
                                </span>
                            </div>

                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                                {selectedItem.title}
                            </h2>

                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                                {selectedItem.description}
                            </p>

                            {selectedItem.features.length > 0 && (
                                <>
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                                        What&apos;s included
                                    </h3>
                                    <ul className="space-y-2">
                                        {selectedItem.features.map((f, idx) => (
                                            <li
                                                key={idx}
                                                className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300"
                                            >
                                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                                                {f}
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </article>
                    </main>
                </div>
            </div>
        </div>
    );
}
