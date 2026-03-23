"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { BarChart4, Plus, Users, User, ChevronRight, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { type DashboardListItem } from "@/lib/bi-types";

export function BIHeaderMenu() {
    const [open, setOpen] = useState(false);
    const [publicDashboards, setPublicDashboards] = useState<DashboardListItem[]>([]);
    const [myDashboards, setMyDashboards] = useState<DashboardListItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    const fetchDashboards = useCallback(async () => {
        setLoading(true);
        try {
            const [pubRes, myRes] = await Promise.all([
                fetch("/api/bi/dashboards?filter=public"),
                fetch("/api/bi/dashboards?filter=mine"),
            ]);
            const pubData = await pubRes.json();
            const myData = await myRes.json();
            if (pubData.success) setPublicDashboards(pubData.dashboards ?? []);
            if (myData.success) setMyDashboards(myData.dashboards ?? []);
        } catch (err) {
            console.error("Error fetching dashboards:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (open) fetchDashboards();
    }, [open, fetchDashboards]);

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        if (open) document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    const filterList = (list: DashboardListItem[]) => {
        if (!search.trim()) return list;
        const q = search.toLowerCase();
        return list.filter(d => d.title.toLowerCase().includes(q) || d.authorName.toLowerCase().includes(q));
    };

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
                title="DSD B-i"
                data-tour="dsd-bi"
            >
                <BarChart4 size={20} className="text-[#FF7300]" />
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-[9999] overflow-hidden">
                    {/* Build Dashboard */}
                    <Link
                        href="/bi/build"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800"
                    >
                        <div className="p-1.5 rounded-lg bg-[#FF7300]/10">
                            <Plus size={16} className="text-[#FF7300]" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">Build Dashboard</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">Create a new dashboard</p>
                        </div>
                        <ChevronRight size={14} className="ml-auto text-gray-400" />
                    </Link>

                    {/* Search */}
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search dashboards..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF7300] text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 size={16} className="animate-spin text-[#FF7300]" />
                        </div>
                    ) : (
                        <div className="max-h-80 overflow-y-auto">
                            {/* Ours Dashboards */}
                            <div className="px-3 pt-3 pb-1">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <Users size={12} className="text-gray-400" />
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                        Ours Dashboards
                                    </span>
                                    <span className="text-[9px] text-gray-400 ml-auto">{filterList(publicDashboards).length}</span>
                                </div>
                                {filterList(publicDashboards).length === 0 ? (
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 px-1 pb-2">No shared dashboards yet</p>
                                ) : (
                                    filterList(publicDashboards).map((d) => (
                                        <DashboardLink key={d.id} dashboard={d} onClose={() => setOpen(false)} />
                                    ))
                                )}
                            </div>

                            {/* My Dashboards */}
                            <div className="px-3 pt-2 pb-3 border-t border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-1.5 mb-2 mt-1">
                                    <User size={12} className="text-gray-400" />
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                        My Dashboards
                                    </span>
                                    <span className="text-[9px] text-gray-400 ml-auto">{filterList(myDashboards).length}</span>
                                </div>
                                {filterList(myDashboards).length === 0 ? (
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 px-1 pb-1">No private dashboards yet</p>
                                ) : (
                                    filterList(myDashboards).map((d) => (
                                        <DashboardLink key={d.id} dashboard={d} onClose={() => setOpen(false)} />
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function DashboardLink({ dashboard, onClose }: { dashboard: DashboardListItem; onClose: () => void }) {
    const date = new Date(dashboard.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    return (
        <Link
            href={`/bi/build/${dashboard.id}`}
            onClick={onClose}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors mb-0.5"
        >
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF7300] flex-shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{dashboard.title}</p>
                <p className="text-[9px] text-gray-400">{dashboard.authorName} · {date}</p>
            </div>
        </Link>
    );
}
