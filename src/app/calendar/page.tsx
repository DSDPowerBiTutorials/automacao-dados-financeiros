"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
    Calendar as CalendarIcon,
    Building2,
    GraduationCap,
    Crown,
    Star,
    BookOpen,
    Filter,
    X,
    Plus,
    Trash2,
    Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────
type EventType =
    | "new-clinic"
    | "clinic-exit"
    | "pc-level-3"
    | "pc-level-2"
    | "pc-level-1"
    | "dsd-course"
    | "custom";

interface CalendarEvent {
    id: string;
    date: string; // ISO yyyy-mm-dd
    title: string;
    type: EventType;
    description?: string;
    isUserCreated?: boolean;
}

// ── Event type configuration ───────────────────────────────────────────────
const EVENT_CONFIG: Record<
    EventType,
    { label: string; emoji: string; color: string; dot: string; bg: string; icon: typeof CalendarIcon }
> = {
    "new-clinic": {
        label: "New Clinic Join",
        emoji: "🏥",
        color: "text-green-600 dark:text-green-400",
        dot: "bg-green-500",
        bg: "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800",
        icon: Building2,
    },
    "clinic-exit": {
        label: "Clinic Exit",
        emoji: "🏥",
        color: "text-red-600 dark:text-red-400",
        dot: "bg-red-500",
        bg: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800",
        icon: Building2,
    },
    "pc-level-3": {
        label: "PC Membership Level 3",
        emoji: "👑",
        color: "text-amber-600 dark:text-amber-400",
        dot: "bg-amber-500",
        bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
        icon: Crown,
    },
    "pc-level-2": {
        label: "PC Membership Level 2",
        emoji: "⭐",
        color: "text-purple-600 dark:text-purple-400",
        dot: "bg-purple-500",
        bg: "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800",
        icon: Star,
    },
    "pc-level-1": {
        label: "PC Membership Level 1",
        emoji: "🎓",
        color: "text-blue-600 dark:text-blue-400",
        dot: "bg-blue-500",
        bg: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800",
        icon: GraduationCap,
    },
    "dsd-course": {
        label: "DSD Course",
        emoji: "📚",
        color: "text-orange-600 dark:text-orange-400",
        dot: "bg-orange-500",
        bg: "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800",
        icon: BookOpen,
    },
    "custom": {
        label: "Custom Event",
        emoji: "📌",
        color: "text-gray-600 dark:text-gray-400",
        dot: "bg-gray-500",
        bg: "bg-gray-50 dark:bg-gray-950/40 border-gray-200 dark:border-gray-800",
        icon: CalendarIcon,
    },
};

// ── Mock data 2026 ─────────────────────────────────────────────────────────
const MOCK_EVENTS: CalendarEvent[] = [
    // Janeiro
    { id: "e01", date: "2026-01-12", title: "DSD Residency Milan", type: "dsd-course", description: "5-day immersive residency program in Milan" },
    { id: "e02", date: "2026-01-12", title: "Clinica São Paulo — Join", type: "new-clinic", description: "New clinic onboarded from São Paulo, Brazil" },
    { id: "e03", date: "2026-01-20", title: "SmileLab Berlin — Join", type: "new-clinic", description: "New clinic onboarded from Berlin, Germany" },
    // Fevereiro
    { id: "e04", date: "2026-02-03", title: "DSD Planning Masterclass", type: "dsd-course", description: "Online masterclass for DSD planning fundamentals" },
    { id: "e05", date: "2026-02-10", title: "Dental Arts NYC — Exit", type: "clinic-exit", description: "Clinic contract ended" },
    { id: "e06", date: "2026-02-17", title: "Dr. Müller Clinic — PC Lvl 3", type: "pc-level-3", description: "Premium membership subscription activated" },
    { id: "e07", date: "2026-02-24", title: "Bright Smile Rotterdam — Join", type: "new-clinic", description: "New clinic from Rotterdam, Netherlands" },
    // Março
    { id: "e08", date: "2026-03-05", title: "DSD Basic Concept Course", type: "dsd-course", description: "3-day introductory course on DSD concepts" },
    { id: "e09", date: "2026-03-09", title: "Clinica Bela Vista — Join", type: "new-clinic", description: "New clinic from Lisbon, Portugal" },
    { id: "e10", date: "2026-03-15", title: "Odontolife B. Aires — Join", type: "new-clinic", description: "New clinic from Buenos Aires, Argentina" },
    { id: "e11", date: "2026-03-22", title: "Denta Plus Warsaw — Join", type: "new-clinic", description: "New clinic from Warsaw, Poland" },
    // Abril
    { id: "e12", date: "2026-04-07", title: "DSD Residency Lisbon", type: "dsd-course", description: "5-day immersive residency program in Lisbon" },
    { id: "e13", date: "2026-04-07", title: "Smile Care Tokyo — PC Lvl 2", type: "pc-level-2", description: "Mid-tier membership subscription activated" },
    { id: "e14", date: "2026-04-18", title: "Dental Excellence Dubai — Join", type: "new-clinic", description: "New clinic from Dubai, UAE" },
    // Maio
    { id: "e15", date: "2026-05-04", title: "Digital Smile Design Workshop", type: "dsd-course", description: "Hands-on workshop covering digital smile design workflow" },
    { id: "e16", date: "2026-05-11", title: "Sorriso Perfeito Rio — Join", type: "new-clinic", description: "New clinic from Rio de Janeiro, Brazil" },
    { id: "e17", date: "2026-05-18", title: "Nordic Dental Oslo — Join", type: "new-clinic", description: "New clinic from Oslo, Norway" },
    { id: "e18", date: "2026-05-25", title: "AestheticDent Vienna — PC Lvl 1", type: "pc-level-1", description: "Base membership subscription activated" },
    // Junho
    { id: "e19", date: "2026-06-08", title: "DSD Residency Miami", type: "dsd-course", description: "5-day immersive residency program in Miami" },
    { id: "e20", date: "2026-06-15", title: "Dental Harmony Sydney — Exit", type: "clinic-exit", description: "Clinic partnership concluded" },
    { id: "e21", date: "2026-06-22", title: "Premium Dental Madrid — Join", type: "new-clinic", description: "New clinic from Madrid, Spain" },
    // Julho
    { id: "e22", date: "2026-07-06", title: "DSD Advanced Planning", type: "dsd-course", description: "Advanced course on complex DSD case planning" },
    { id: "e23", date: "2026-07-13", title: "Clinica Dentale Roma — PC Lvl 2", type: "pc-level-2", description: "Mid-tier membership subscription activated" },
    { id: "e24", date: "2026-07-20", title: "Zahnarzt München — PC Lvl 2", type: "pc-level-2", description: "Mid-tier membership subscription activated" },
    { id: "e25", date: "2026-07-28", title: "Smile Design Lab Seoul — Join", type: "new-clinic", description: "New clinic from Seoul, South Korea" },
    // Agosto
    { id: "e26", date: "2026-08-10", title: "Cape Dental Clinic — Join", type: "new-clinic", description: "New clinic from Cape Town, South Africa" },
    { id: "e27", date: "2026-08-24", title: "Dr. Tanaka Osaka — PC Lvl 1", type: "pc-level-1", description: "Base membership subscription activated" },
    // Setembro
    { id: "e28", date: "2026-09-01", title: "DSD Residency London", type: "dsd-course", description: "5-day immersive residency program in London" },
    { id: "e29", date: "2026-09-07", title: "SmileWorks Manchester — Join", type: "new-clinic", description: "New clinic from Manchester, UK" },
    { id: "e30", date: "2026-09-14", title: "DentCare Bangkok — Join", type: "new-clinic", description: "New clinic from Bangkok, Thailand" },
    { id: "e31", date: "2026-09-14", title: "Dr. Kim Dental Seoul — PC Lvl 3", type: "pc-level-3", description: "Premium membership subscription activated" },
    { id: "e32", date: "2026-09-21", title: "Clinica Moderna Bogotá — Join", type: "new-clinic", description: "New clinic from Bogotá, Colombia" },
    // Outubro
    { id: "e33", date: "2026-10-05", title: "DSD Annual Meeting", type: "dsd-course", description: "Annual gathering of DSD community and partners" },
    { id: "e34", date: "2026-10-05", title: "Dental Future Zurich — PC Lvl 1", type: "pc-level-1", description: "Base membership subscription activated" },
    { id: "e35", date: "2026-10-12", title: "Smile Experts Toronto — PC Lvl 1", type: "pc-level-1", description: "Base membership subscription activated" },
    { id: "e36", date: "2026-10-19", title: "OrthoSmile Athens — Exit", type: "clinic-exit", description: "Clinic contract ended" },
    { id: "e37", date: "2026-10-26", title: "Prime Dental Nairobi — Join", type: "new-clinic", description: "New clinic from Nairobi, Kenya" },
    // Novembro
    { id: "e38", date: "2026-11-02", title: "DSD Residency Dubai", type: "dsd-course", description: "5-day immersive residency program in Dubai" },
    { id: "e39", date: "2026-11-09", title: "Clinica Sonrisa CDMX — Join", type: "new-clinic", description: "New clinic from Mexico City, Mexico" },
    { id: "e40", date: "2026-11-16", title: "Estética Dental Santiago — Join", type: "new-clinic", description: "New clinic from Santiago, Chile" },
    { id: "e41", date: "2026-11-23", title: "Hollywood Smile LA — PC Lvl 2", type: "pc-level-2", description: "Mid-tier membership subscription activated" },
    // Dezembro
    { id: "e42", date: "2026-12-07", title: "DSD Holiday Masterclass", type: "dsd-course", description: "End-of-year special masterclass event" },
    { id: "e43", date: "2026-12-14", title: "Lächeln Klinik Hamburg — PC Lvl 3", type: "pc-level-3", description: "Premium membership subscription activated" },
    { id: "e44", date: "2026-12-21", title: "SmileBright Vancouver — Join", type: "new-clinic", description: "New clinic from Vancouver, Canada" },
];

// ── Helpers ────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

/** Monday=0 … Sunday=6 */
function getStartDayOfWeek(year: number, month: number) {
    const d = new Date(year, month, 1).getDay();
    return d === 0 ? 6 : d - 1;
}

function dateKey(y: number, m: number, d: number) {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function isToday(y: number, m: number, d: number) {
    const n = new Date();
    return n.getFullYear() === y && n.getMonth() === m && n.getDate() === d;
}

function getComputedDotColor(type: EventType): string {
    const map: Record<EventType, string> = {
        "new-clinic": "#22c55e",
        "clinic-exit": "#ef4444",
        "pc-level-3": "#f59e0b",
        "pc-level-2": "#a855f7",
        "pc-level-1": "#3b82f6",
        "dsd-course": "#f97316",
        "custom": "#6b7280",
    };
    return map[type];
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function DSDCalendarPage() {
    const YEAR = 2026;
    const [activeFilters, setActiveFilters] = useState<Set<EventType>>(
        new Set(Object.keys(EVENT_CONFIG) as EventType[])
    );
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [userEvents, setUserEvents] = useState<CalendarEvent[]>([]);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // New event form
    const [newEvent, setNewEvent] = useState({
        date: "",
        title: "",
        type: "custom" as EventType,
        description: "",
    });

    // Load user events from API
    const loadUserEvents = useCallback(async () => {
        try {
            const res = await fetch("/api/calendar-events");
            const json = await res.json();
            if (json.success && json.data) {
                setUserEvents(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    json.data.map((ev: any) => ({
                        ...ev,
                        isUserCreated: true,
                    }))
                );
            }
        } catch {
            // Silently fail — mock data still works
        }
    }, []);

    useEffect(() => {
        loadUserEvents();
    }, [loadUserEvents]);

    // All events = mock + user
    const allEvents = useMemo(
        () => [...MOCK_EVENTS, ...userEvents],
        [userEvents]
    );

    // Build a map date→events
    const eventsByDate = useMemo(() => {
        const map: Record<string, CalendarEvent[]> = {};
        for (const ev of allEvents) {
            if (!activeFilters.has(ev.type)) continue;
            if (!map[ev.date]) map[ev.date] = [];
            map[ev.date].push(ev);
        }
        return map;
    }, [allEvents, activeFilters]);

    // Summary KPIs
    const stats = useMemo(
        () => ({
            courses: allEvents.filter((e) => e.type === "dsd-course").length,
            newClinics: allEvents.filter((e) => e.type === "new-clinic").length,
            clinicExits: allEvents.filter((e) => e.type === "clinic-exit").length,
            pcLvl3: allEvents.filter((e) => e.type === "pc-level-3").length,
            pcLvl2: allEvents.filter((e) => e.type === "pc-level-2").length,
            pcLvl1: allEvents.filter((e) => e.type === "pc-level-1").length,
            custom: allEvents.filter((e) => e.type === "custom").length,
        }),
        [allEvents]
    );

    function toggleFilter(type: EventType) {
        setActiveFilters((prev) => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            return next;
        });
    }

    // Add event
    const handleAddEvent = async () => {
        if (!newEvent.date || !newEvent.title) return;
        setSaving(true);
        try {
            const res = await fetch("/api/calendar-events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newEvent),
            });
            const json = await res.json();
            if (json.success) {
                toast({ title: "Event added to calendar" });
                setAddDialogOpen(false);
                setNewEvent({ date: "", title: "", type: "custom", description: "" });
                loadUserEvents();
            } else {
                setUserEvents((prev) => [
                    ...prev,
                    { id: `local-${Date.now()}`, ...newEvent, isUserCreated: true },
                ]);
                setAddDialogOpen(false);
                setNewEvent({ date: "", title: "", type: "custom", description: "" });
            }
        } catch {
            setUserEvents((prev) => [
                ...prev,
                { id: `local-${Date.now()}`, ...newEvent, isUserCreated: true },
            ]);
            setAddDialogOpen(false);
            setNewEvent({ date: "", title: "", type: "custom", description: "" });
        } finally {
            setSaving(false);
        }
    };

    // Delete user event
    const handleDeleteEvent = async (id: string) => {
        try {
            await fetch(`/api/calendar-events?id=${id}`, { method: "DELETE" });
        } catch {
            // ignore
        }
        setUserEvents((prev) => prev.filter((e) => e.id !== id));
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black p-4 md:p-6 lg:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <CalendarIcon className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        DSD Calendar 2026
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => setAddDialogOpen(true)}
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Event
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFilterMenu(!showFilterMenu)}
                        className="dark:border-gray-700 dark:text-gray-300 dark:hover:bg-[#111111]"
                    >
                        <Filter className="h-4 w-4 mr-2" />
                        Filters
                    </Button>
                </div>
            </div>

            {/* Filter toggles */}
            {showFilterMenu && (
                <Card className="dark:bg-[#0a0a0a] dark:border-gray-700">
                    <CardContent className="pt-4 flex flex-wrap gap-2">
                        {(Object.keys(EVENT_CONFIG) as EventType[]).map((type) => {
                            const cfg = EVENT_CONFIG[type];
                            const active = activeFilters.has(type);
                            return (
                                <Button
                                    key={type}
                                    variant={active ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => toggleFilter(type)}
                                    className={
                                        active
                                            ? "text-white border-transparent"
                                            : "dark:border-gray-700 dark:text-gray-400 dark:hover:bg-[#111111]"
                                    }
                                    style={
                                        active
                                            ? { backgroundColor: getComputedDotColor(type) }
                                            : undefined
                                    }
                                >
                                    {cfg.emoji} {cfg.label}
                                    {!active && <X className="h-3 w-3 ml-1 opacity-50" />}
                                </Button>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {/* KPI Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <KPICard label="Courses" value={stats.courses} emoji="📚" color="text-orange-600 dark:text-orange-400" />
                <KPICard label="New Clinics" value={stats.newClinics} emoji="🏥" color="text-green-600 dark:text-green-400" />
                <KPICard label="Clinic Exits" value={stats.clinicExits} emoji="🏥" color="text-red-600 dark:text-red-400" />
                <KPICard label="PC Level 3" value={stats.pcLvl3} emoji="👑" color="text-amber-600 dark:text-amber-400" />
                <KPICard label="PC Level 2" value={stats.pcLvl2} emoji="⭐" color="text-purple-600 dark:text-purple-400" />
                <KPICard label="PC Level 1" value={stats.pcLvl1} emoji="🎓" color="text-blue-600 dark:text-blue-400" />
                <KPICard label="Custom" value={stats.custom} emoji="📌" color="text-gray-600 dark:text-gray-400" />
            </div>

            {/* Legend */}
            <Card className="dark:bg-[#0a0a0a] dark:border-gray-700">
                <CardContent className="py-3 flex flex-wrap items-center gap-4 text-sm">
                    {(Object.keys(EVENT_CONFIG) as EventType[]).map((type) => {
                        const cfg = EVENT_CONFIG[type];
                        return (
                            <span
                                key={type}
                                className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300"
                            >
                                <span className={`inline-block h-3 w-3 rounded-full ${cfg.dot}`} />
                                {cfg.emoji} {cfg.label}
                            </span>
                        );
                    })}
                </CardContent>
            </Card>

            {/* 12-month calendar grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {Array.from({ length: 12 }, (_, i) => (
                    <MonthGrid key={i} year={YEAR} month={i} eventsByDate={eventsByDate} onDeleteEvent={handleDeleteEvent} />
                ))}
            </div>

            {/* Add Event Dialog */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5 text-blue-500" />
                            Add Calendar Event
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label className="text-xs text-gray-500">Date *</Label>
                            <Input
                                type="date"
                                value={newEvent.date}
                                onChange={(e) => setNewEvent((p) => ({ ...p, date: e.target.value }))}
                                className="bg-transparent border-gray-300 dark:border-gray-600"
                            />
                        </div>
                        <div>
                            <Label className="text-xs text-gray-500">Title *</Label>
                            <Input
                                value={newEvent.title}
                                onChange={(e) => setNewEvent((p) => ({ ...p, title: e.target.value }))}
                                placeholder="Event name"
                                className="bg-transparent border-gray-300 dark:border-gray-600"
                            />
                        </div>
                        <div>
                            <Label className="text-xs text-gray-500">Type</Label>
                            <select
                                value={newEvent.type}
                                onChange={(e) => setNewEvent((p) => ({ ...p, type: e.target.value as EventType }))}
                                className="w-full h-9 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-transparent text-sm"
                            >
                                {(Object.keys(EVENT_CONFIG) as EventType[]).map((type) => (
                                    <option key={type} value={type}>
                                        {EVENT_CONFIG[type].emoji} {EVENT_CONFIG[type].label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label className="text-xs text-gray-500">Description</Label>
                            <Input
                                value={newEvent.description}
                                onChange={(e) => setNewEvent((p) => ({ ...p, description: e.target.value }))}
                                placeholder="Optional description"
                                className="bg-transparent border-gray-300 dark:border-gray-600"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={handleAddEvent}
                            disabled={!newEvent.date || !newEvent.title || saving}
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                            Add Event
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ── Month grid ─────────────────────────────────────────────────────────────
function MonthGrid({
    year,
    month,
    eventsByDate,
    onDeleteEvent,
}: {
    year: number;
    month: number;
    eventsByDate: Record<string, CalendarEvent[]>;
    onDeleteEvent: (id: string) => void;
}) {
    const daysInMonth = getDaysInMonth(year, month);
    const startDay = getStartDayOfWeek(year, month);

    const cells: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    return (
        <Card className="dark:bg-[#0a0a0a] dark:border-gray-700 overflow-hidden">
            <CardHeader className="py-3 px-4 bg-gray-100 dark:bg-[#111111]">
                <CardTitle className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {MONTH_NAMES[month]}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
                {/* Day of week headers */}
                <div className="grid grid-cols-7 mb-1">
                    {DAY_HEADERS.map((d) => (
                        <div
                            key={d}
                            className="text-center text-[10px] font-medium text-gray-500 dark:text-gray-500 py-1"
                        >
                            {d}
                        </div>
                    ))}
                </div>
                {/* Day cells */}
                <div className="grid grid-cols-7">
                    {cells.map((day, idx) => {
                        if (day === null)
                            return <div key={`empty-${idx}`} className="h-10" />;

                        const key = dateKey(year, month, day);
                        const events = eventsByDate[key] || [];
                        const today = isToday(year, month, day);

                        const dayEl = (
                            <div
                                className={`
                  relative h-10 flex flex-col items-center justify-start pt-1 rounded-md text-xs
                  transition-colors
                  ${today ? "bg-blue-100 dark:bg-blue-900/30 font-bold text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}
                  ${events.length > 0 ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-[#111111]" : ""}
                `}
                            >
                                <span>{day}</span>
                                {events.length > 0 && (
                                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center max-w-full">
                                        {events.slice(0, 4).map((ev, i) => (
                                            <span
                                                key={i}
                                                className={`h-1.5 w-1.5 rounded-full ${EVENT_CONFIG[ev.type]?.dot || "bg-gray-400"}`}
                                            />
                                        ))}
                                        {events.length > 4 && (
                                            <span className="text-[8px] text-gray-400">
                                                +{events.length - 4}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );

                        if (events.length === 0) return <div key={key}>{dayEl}</div>;

                        return (
                            <Popover key={key}>
                                <PopoverTrigger asChild>{dayEl}</PopoverTrigger>
                                <PopoverContent
                                    className="w-72 p-3 dark:bg-[#0a0a0a] dark:border-gray-700"
                                    side="right"
                                    align="start"
                                >
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                                        {day} {MONTH_NAMES[month]} {year}
                                    </p>
                                    <div className="space-y-2">
                                        {events.map((ev) => {
                                            const cfg = EVENT_CONFIG[ev.type] || EVENT_CONFIG["custom"];
                                            return (
                                                <div
                                                    key={ev.id}
                                                    className={`rounded-md border p-2 ${cfg.bg}`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                                                            <span className={`text-xs font-semibold ${cfg.color}`}>
                                                                {cfg.emoji} {ev.title}
                                                            </span>
                                                        </div>
                                                        {ev.isUserCreated && (
                                                            <button
                                                                onClick={() => onDeleteEvent(ev.id)}
                                                                className="text-red-400 hover:text-red-600 p-0.5"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    {ev.description && (
                                                        <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1 ml-3.5">
                                                            {ev.description}
                                                        </p>
                                                    )}
                                                    <Badge
                                                        variant="outline"
                                                        className={`mt-1 ml-3.5 text-[10px] ${cfg.color} border-current`}
                                                    >
                                                        {cfg.label}
                                                    </Badge>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

// ── KPI card ───────────────────────────────────────────────────────────────
function KPICard({
    label,
    value,
    emoji,
    color,
}: {
    label: string;
    value: number;
    emoji: string;
    color: string;
}) {
    return (
        <Card className="dark:bg-[#0a0a0a] dark:border-gray-700">
            <CardContent className="p-4 flex flex-col items-center text-center gap-1">
                <span className="text-xl">{emoji}</span>
                <span className={`text-2xl font-bold ${color}`}>{value}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
            </CardContent>
        </Card>
    );
}
