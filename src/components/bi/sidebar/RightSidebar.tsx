"use client";

import { useState, useEffect } from "react";
import {
    PanelRightClose, PanelRightOpen,
    Variable, Filter, Database, Sparkles,
    Search, Plus, ChevronRight, GripVertical,
    Loader2,
} from "lucide-react";
import { type RightSidebarTab, type UserMeasure, type MeasureDefinition } from "@/lib/bi-types";
import { MEASURE_CATALOG } from "@/lib/bi-measure-catalog";
import { useDraggable } from "@dnd-kit/core";
import { MeasureCreator } from "./MeasureCreator";
import { MeasureDetailDialog } from "./MeasureDetailDialog";

interface RightSidebarProps {
    open: boolean;
    onToggle: () => void;
    dashboardId: string;
}

const TABS: { id: RightSidebarTab; label: string; icon: React.ElementType }[] = [
    { id: "variables", label: "Variables", icon: Variable },
    { id: "filters", label: "Filters", icon: Filter },
    { id: "datasources", label: "Sources", icon: Database },
    { id: "ai", label: "AI", icon: Sparkles },
];

export function BuilderRightSidebar({ open, onToggle, dashboardId }: RightSidebarProps) {
    const [activeTab, setActiveTab] = useState<RightSidebarTab>("variables");

    if (!open) {
        return (
            <button
                onClick={onToggle}
                className="fixed right-0 top-1/2 -translate-y-1/2 z-30 p-2 bg-white dark:bg-[#111111] border border-gray-200 dark:border-gray-800 rounded-l-lg shadow-md hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
                <PanelRightOpen size={16} className="text-gray-500" />
            </button>
        );
    }

    return (
        <div className="w-[300px] min-w-[300px] bg-white dark:bg-[#111111] border-l border-gray-200 dark:border-gray-800 flex flex-col h-full">
            {/* Tab bar */}
            <div className="flex items-center border-b border-gray-200 dark:border-gray-800">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[9px] font-medium transition-colors border-b-2
                                ${activeTab === tab.id
                                    ? "border-[#FF7300] text-[#FF7300]"
                                    : "border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                }`}
                        >
                            <Icon size={14} />
                            {tab.label}
                        </button>
                    );
                })}
                <button
                    onClick={onToggle}
                    className="px-2 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    <PanelRightClose size={14} className="text-gray-500" />
                </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === "variables" && <VariablesTab dashboardId={dashboardId} />}
                {activeTab === "filters" && <FiltersTab />}
                {activeTab === "datasources" && <DataSourcesTab />}
                {activeTab === "ai" && <AITab dashboardId={dashboardId} />}
            </div>
        </div>
    );
}

/* ──────────────────── Variables & Measures Tab ──────────────────── */
function VariablesTab({ dashboardId }: { dashboardId: string }) {
    const [search, setSearch] = useState("");
    const [measures, setMeasures] = useState<UserMeasure[]>([]);
    const [showCreator, setShowCreator] = useState(false);
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [inspectCatalog, setInspectCatalog] = useState<MeasureDefinition | null>(null);
    const [inspectUser, setInspectUser] = useState<UserMeasure | null>(null);

    useEffect(() => {
        loadMeasures();
    }, []);

    async function loadMeasures() {
        try {
            const res = await fetch("/api/bi/measures");
            const data = await res.json();
            if (data.success) setMeasures(data.measures ?? []);
        } catch { }
    }

    const catalogFiltered = MEASURE_CATALOG.filter((m) =>
        m.label.toLowerCase().includes(search.toLowerCase()) || m.type.toLowerCase().includes(search.toLowerCase())
    );

    const categories = [...new Set(catalogFiltered.map((m) => m.category))];

    return (
        <div className="flex flex-col h-full">
            {/* Search */}
            <div className="p-3">
                <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search measures..."
                        className="w-full text-[10px] pl-7 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-[#FF7300] outline-none"
                    />
                </div>
            </div>

            {/* New Measure */}
            <div className="px-3 pb-2">
                <button
                    onClick={() => setShowCreator(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FF7300] text-white text-xs font-medium hover:bg-[#e66800] transition-colors"
                >
                    <Plus size={12} /> New Measure
                </button>
            </div>

            {/* User measures */}
            {measures.length > 0 && (
                <div className="px-3 pb-2">
                    <h4 className="text-[9px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 px-1">My Measures</h4>
                    <div className="space-y-0.5">
                        {measures.map((m) => (
                            <DraggableMeasureItem key={m.id} id={m.id} label={m.name} icon="📐" onClick={() => setInspectUser(m)} />
                        ))}
                    </div>
                </div>
            )}

            {/* Catalog */}
            <div className="flex-1 overflow-y-auto px-3 pb-3">
                <h4 className="text-[9px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 px-1">Catalog</h4>
                {categories.map((cat) => {
                    const items = catalogFiltered.filter((m) => m.category === cat);
                    const isExpanded = expandedCategory === cat || !!search;
                    return (
                        <div key={cat} className="mb-1">
                            <button
                                onClick={() => setExpandedCategory(isExpanded && !search ? null : cat)}
                                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                                <span className="text-[10px] font-semibold capitalize text-gray-700 dark:text-gray-300">{cat}</span>
                                <ChevronRight size={10} className={`text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                            </button>
                            {isExpanded && (
                                <div className="mt-0.5 space-y-0.5 ml-2">
                                    {items.map((m) => (
                                        <DraggableMeasureItem key={m.type} id={m.type} label={m.label} icon={m.icon} onClick={() => setInspectCatalog(m)} />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {showCreator && (
                <MeasureCreator
                    onClose={() => setShowCreator(false)}
                    onCreated={() => { setShowCreator(false); loadMeasures(); }}
                />
            )}

            {inspectCatalog && (
                <MeasureDetailDialog catalogMeasure={inspectCatalog} onClose={() => setInspectCatalog(null)} />
            )}
            {inspectUser && (
                <MeasureDetailDialog userMeasure={inspectUser} onClose={() => setInspectUser(null)} />
            )}
        </div>
    );
}

function DraggableMeasureItem({ id, label, icon, onClick }: { id: string; label: string; icon: string; onClick?: () => void }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `measure-${id}`,
        data: { type: "measure", measureId: id, label },
    });

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            onClick={() => onClick?.()}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] cursor-grab touch-none transition-all
                ${isDragging ? "opacity-50 bg-[#FF7300]/10 shadow-lg" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
        >
            <GripVertical size={8} className="text-gray-300 shrink-0" />
            <span>{icon}</span>
            <span className="text-gray-700 dark:text-gray-300 truncate">{label}</span>
        </div>
    );
}

/* ──────────────────── Filters Tab ──────────────────── */
function FiltersTab() {
    return (
        <div className="p-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Active Filters</p>
            <p className="text-[10px] text-gray-400 text-center py-6">No filters applied. Drop a measure here to create a filter.</p>

            <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Quick Filters</p>
                {["Date Range", "Currency", "Scope (ES/US/Global)", "Source"].map((f) => (
                    <button
                        key={f}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <Filter size={10} className="text-gray-400" /> {f}
                    </button>
                ))}
            </div>
        </div>
    );
}

/* ──────────────────── Data Sources Tab ──────────────────── */
function DataSourcesTab() {
    const sources = [
        { name: "csv_rows (Bankinter EUR)", table: "csv_rows", filter: "source=bankinter-eur" },
        { name: "csv_rows (Bankinter USD)", table: "csv_rows", filter: "source=bankinter-usd" },
        { name: "csv_rows (Sabadell)", table: "csv_rows", filter: "source=sabadell" },
        { name: "csv_rows (Braintree EUR)", table: "csv_rows", filter: "source=braintree-eur" },
        { name: "csv_rows (Braintree USD)", table: "csv_rows", filter: "source=braintree-usd" },
        { name: "csv_rows (Stripe)", table: "csv_rows", filter: "source=stripe" },
        { name: "csv_rows (GoCardless)", table: "csv_rows", filter: "source=gocardless" },
        { name: "HubSpot Deals", table: "hubspot_deals", filter: "" },
        { name: "Revenue Entries", table: "revenue_entries", filter: "" },
    ];

    return (
        <div className="p-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Available Sources</p>
            <div className="space-y-1">
                {sources.map((s) => (
                    <div
                        key={s.name}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
                    >
                        <Database size={10} className="text-[#FF7300] shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate">{s.name}</p>
                            <p className="text-[8px] text-gray-400 font-mono">{s.table}{s.filter ? ` → ${s.filter}` : ""}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ──────────────────── AI Tab ──────────────────── */
function AITab({ dashboardId }: { dashboardId: string }) {
    const [prompt, setPrompt] = useState("");
    const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
    const [loading, setLoading] = useState(false);

    async function sendMessage() {
        if (!prompt.trim()) return;
        const userMsg = prompt.trim();
        setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
        setPrompt("");
        setLoading(true);

        try {
            const res = await fetch("/api/bi/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: userMsg, dashboardId }),
            });
            const data = await res.json();
            setMessages((prev) => [...prev, { role: "assistant", content: data.response ?? "Sorry, I couldn't process that." }]);
        } catch {
            setMessages((prev) => [...prev, { role: "assistant", content: "Error connecting to AI service." }]);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex flex-col h-full">
            <div className="p-3 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-[#FF7300]" />
                    <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white">DSD Intelligence</p>
                        <p className="text-[9px] text-gray-400">Ask about your data, get chart suggestions</p>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 && (
                    <div className="text-center py-8 space-y-2">
                        <Sparkles size={24} className="text-[#FF7300] mx-auto opacity-40" />
                        <p className="text-[10px] text-gray-400">Ask me to analyze data, suggest charts, or create measures</p>
                        <div className="space-y-1">
                            {["What's our revenue trend?", "Suggest a dashboard layout", "Create a YoY comparison measure"].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => { setPrompt(s); }}
                                    className="block mx-auto text-[9px] text-[#FF7300] hover:underline"
                                >
                                    "{s}"
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[10px] leading-relaxed
                            ${msg.role === "user"
                                ? "bg-[#FF7300] text-white"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                            }`}
                        >
                            {msg.content}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2">
                            <Loader2 size={12} className="animate-spin text-[#FF7300]" />
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-200 dark:border-gray-800">
                <div className="flex gap-1.5">
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        placeholder="Ask DSD Intelligence..."
                        className="flex-1 text-[10px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-[#FF7300] outline-none"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!prompt.trim() || loading}
                        className="p-1.5 rounded-lg bg-[#FF7300] text-white hover:bg-[#e66800] disabled:opacity-50 transition-colors"
                    >
                        <Sparkles size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
}
