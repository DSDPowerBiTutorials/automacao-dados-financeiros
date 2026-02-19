"use client";

import { useState, useEffect, useCallback } from "react";
import {
    GraduationCap,
    Plus,
    Pencil,
    Trash2,
    Loader2,
    MapPin,
    CalendarDays,
    Users,
    DollarSign,
    Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────
type CourseType = "course" | "residency" | "masterclass" | "workshop" | "annual-meeting";

interface DSDCourse {
    id: string;
    name: string;
    start_date: string;
    end_date: string | null;
    location: string | null;
    description: string | null;
    course_type: CourseType;
    price_eur: number | null;
    capacity: number | null;
    is_active: boolean;
    created_at: string;
}

const COURSE_TYPE_CONFIG: Record<CourseType, { label: string; emoji: string; color: string; badge: string }> = {
    course: { label: "Course", emoji: "📚", color: "text-blue-600 dark:text-blue-400", badge: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" },
    residency: { label: "Residency", emoji: "🏠", color: "text-green-600 dark:text-green-400", badge: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" },
    masterclass: { label: "Masterclass", emoji: "🎯", color: "text-purple-600 dark:text-purple-400", badge: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400" },
    workshop: { label: "Workshop", emoji: "🔧", color: "text-orange-600 dark:text-orange-400", badge: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400" },
    "annual-meeting": { label: "Annual Meeting", emoji: "🌍", color: "text-amber-600 dark:text-amber-400", badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" },
};

const EMPTY_FORM = {
    name: "",
    start_date: "",
    end_date: "",
    location: "",
    description: "",
    course_type: "course" as CourseType,
    price_eur: "",
    capacity: "",
};

export default function DSDCoursesPage() {
    const [courses, setCourses] = useState<DSDCourse[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [search, setSearch] = useState("");
    const [yearFilter, setYearFilter] = useState<string>("all");
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const loadCourses = useCallback(async () => {
        setLoading(true);
        try {
            const url = yearFilter === "all" ? "/api/dsd-courses" : `/api/dsd-courses?year=${yearFilter}`;
            const res = await fetch(url);
            const json = await res.json();
            if (json.success) setCourses(json.data || []);
        } catch (err) {
            console.error("Failed to load courses:", err);
        } finally {
            setLoading(false);
        }
    }, [yearFilter]);

    useEffect(() => {
        loadCourses();
    }, [loadCourses]);

    const filtered = courses.filter((c) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            c.name.toLowerCase().includes(q) ||
            (c.location?.toLowerCase().includes(q)) ||
            (c.description?.toLowerCase().includes(q))
        );
    });

    const openAdd = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setDialogOpen(true);
    };

    const openEdit = (c: DSDCourse) => {
        setEditingId(c.id);
        setForm({
            name: c.name,
            start_date: c.start_date,
            end_date: c.end_date || "",
            location: c.location || "",
            description: c.description || "",
            course_type: c.course_type,
            price_eur: c.price_eur != null ? String(c.price_eur) : "",
            capacity: c.capacity != null ? String(c.capacity) : "",
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.name || !form.start_date) return;
        setSaving(true);
        try {
            const payload = {
                name: form.name,
                start_date: form.start_date,
                end_date: form.end_date || null,
                location: form.location || null,
                description: form.description || null,
                course_type: form.course_type,
                price_eur: form.price_eur ? parseFloat(form.price_eur) : null,
                capacity: form.capacity ? parseInt(form.capacity) : null,
            };

            if (editingId) {
                const res = await fetch("/api/dsd-courses", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: editingId, ...payload }),
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                toast({ title: "Course updated" });
            } else {
                const res = await fetch("/api/dsd-courses", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                toast({ title: "Course created — also added to DSD Calendar" });
            }
            setDialogOpen(false);
            loadCourses();
        } catch (err) {
            toast({ title: "Error saving course", description: String(err), variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/dsd-courses?id=${id}`, { method: "DELETE" });
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            toast({ title: "Course deleted" });
            setDeleteConfirm(null);
            loadCourses();
        } catch (err) {
            toast({ title: "Error deleting course", description: String(err), variant: "destructive" });
        }
    };

    // KPIs
    const totalCourses = courses.length;
    const totalCapacity = courses.reduce((s, c) => s + (c.capacity || 0), 0);
    const totalRevenue = courses.reduce((s, c) => s + (c.price_eur || 0), 0);
    const typeCounts = Object.fromEntries(
        (Object.keys(COURSE_TYPE_CONFIG) as CourseType[]).map((t) => [t, courses.filter((c) => c.course_type === t).length])
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black p-4 md:p-6 lg:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <GraduationCap className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        DSD Courses
                    </h1>
                    <Badge variant="outline" className="text-xs dark:border-gray-600">
                        {totalCourses} courses
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={openAdd}
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        New Course
                    </Button>
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <KPICard label="Total" value={totalCourses} icon={<GraduationCap className="h-5 w-5 text-blue-500" />} />
                <KPICard label="Capacity" value={totalCapacity} icon={<Users className="h-5 w-5 text-green-500" />} />
                <KPICard label="Revenue (€)" value={`€${totalRevenue.toLocaleString()}`} icon={<DollarSign className="h-5 w-5 text-amber-500" />} />
                {(Object.keys(COURSE_TYPE_CONFIG) as CourseType[]).map((t) => {
                    const cfg = COURSE_TYPE_CONFIG[t];
                    return (
                        <KPICard
                            key={t}
                            label={cfg.label}
                            value={typeCounts[t] || 0}
                            icon={<span className="text-lg">{cfg.emoji}</span>}
                        />
                    );
                })}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search courses..."
                        className="pl-9 bg-transparent border-gray-300 dark:border-gray-600"
                    />
                </div>
                <div className="flex items-center gap-1">
                    {["all", "2025", "2026", "2027"].map((y) => (
                        <Button
                            key={y}
                            variant={yearFilter === y ? "default" : "outline"}
                            size="sm"
                            onClick={() => setYearFilter(y)}
                            className={yearFilter === y ? "bg-blue-600 text-white" : "dark:border-gray-600 dark:text-gray-400"}
                        >
                            {y === "all" ? "All" : y}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Courses table */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
            ) : filtered.length === 0 ? (
                <Card className="dark:bg-[#0a0a0a] dark:border-gray-700">
                    <CardContent className="py-16 text-center text-gray-500 dark:text-gray-400">
                        <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-medium mb-1">No courses found</p>
                        <p className="text-sm">Create a new course to get started</p>
                    </CardContent>
                </Card>
            ) : (
                <Card className="dark:bg-[#0a0a0a] dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#111111]">
                                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Course</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Type</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Dates</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Location</th>
                                    <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Price (€)</th>
                                    <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Capacity</th>
                                    <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((c) => {
                                    const cfg = COURSE_TYPE_CONFIG[c.course_type] || COURSE_TYPE_CONFIG.course;
                                    return (
                                        <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#111111]">
                                            <td className="py-3 px-4">
                                                <div className="font-medium text-gray-900 dark:text-white">{c.name}</div>
                                                {c.description && (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">{c.description}</div>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                                                    {cfg.emoji} {cfg.label}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                <div className="flex items-center gap-1">
                                                    <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                                                    {c.start_date}
                                                    {c.end_date && ` → ${c.end_date}`}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                                                {c.location ? (
                                                    <span className="flex items-center gap-1">
                                                        <MapPin className="h-3.5 w-3.5 text-gray-400" />
                                                        {c.location}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono text-gray-700 dark:text-gray-300">
                                                {c.price_eur != null ? `€${c.price_eur.toLocaleString()}` : "—"}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono text-gray-700 dark:text-gray-300">
                                                {c.capacity != null ? c.capacity : "—"}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)} className="h-7 w-7 p-0">
                                                        <Pencil className="h-3.5 w-3.5 text-gray-500" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setDeleteConfirm(c.id)}
                                                        className="h-7 w-7 p-0 hover:text-red-600"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 text-gray-500" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <GraduationCap className="h-5 w-5 text-blue-500" />
                            {editingId ? "Edit Course" : "New DSD Course"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label className="text-xs text-gray-500">Course Name *</Label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                placeholder="e.g. DSD Residency Milan"
                                className="bg-transparent border-gray-300 dark:border-gray-600"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs text-gray-500">Start Date *</Label>
                                <Input
                                    type="date"
                                    value={form.start_date}
                                    onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                                    className="bg-transparent border-gray-300 dark:border-gray-600"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-gray-500">End Date</Label>
                                <Input
                                    type="date"
                                    value={form.end_date}
                                    onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                                    className="bg-transparent border-gray-300 dark:border-gray-600"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs text-gray-500">Type</Label>
                                <select
                                    value={form.course_type}
                                    onChange={(e) => setForm((p) => ({ ...p, course_type: e.target.value as CourseType }))}
                                    className="w-full h-9 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-transparent text-sm"
                                >
                                    {(Object.keys(COURSE_TYPE_CONFIG) as CourseType[]).map((t) => (
                                        <option key={t} value={t}>
                                            {COURSE_TYPE_CONFIG[t].emoji} {COURSE_TYPE_CONFIG[t].label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label className="text-xs text-gray-500">Location</Label>
                                <Input
                                    value={form.location}
                                    onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                                    placeholder="e.g. Milan, Italy"
                                    className="bg-transparent border-gray-300 dark:border-gray-600"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs text-gray-500">Price (€)</Label>
                                <Input
                                    type="number"
                                    value={form.price_eur}
                                    onChange={(e) => setForm((p) => ({ ...p, price_eur: e.target.value }))}
                                    placeholder="e.g. 3500"
                                    className="bg-transparent border-gray-300 dark:border-gray-600"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-gray-500">Capacity</Label>
                                <Input
                                    type="number"
                                    value={form.capacity}
                                    onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
                                    placeholder="e.g. 25"
                                    className="bg-transparent border-gray-300 dark:border-gray-600"
                                />
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs text-gray-500">Description</Label>
                            <Input
                                value={form.description}
                                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                                placeholder="Brief description"
                                className="bg-transparent border-gray-300 dark:border-gray-600"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={handleSave}
                            disabled={!form.name || !form.start_date || saving}
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                            {editingId ? "Save Changes" : "Create Course"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirm Dialog */}
            <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <DialogContent className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Delete Course</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        This will permanently delete the course and its calendar event. Continue?
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ── KPI Card ───────────────────────────────────────────────────────────────
function KPICard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
    return (
        <Card className="dark:bg-[#0a0a0a] dark:border-gray-700">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
                {icon}
                <span className="text-xl font-bold text-gray-900 dark:text-white">{value}</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">{label}</span>
            </CardContent>
        </Card>
    );
}
