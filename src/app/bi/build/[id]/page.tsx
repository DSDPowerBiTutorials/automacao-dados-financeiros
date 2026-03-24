"use client";

import { useState, useCallback, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { type Dashboard, type DashboardSlot } from "@/lib/bi-types";
import { DashboardCanvas } from "@/components/bi/builder/DashboardCanvas";
import { DashboardHeader } from "@/components/bi/builder/DashboardHeader";
import { BuilderLeftSidebar } from "@/components/bi/sidebar/LeftSidebar";
import { BuilderRightSidebar } from "@/components/bi/sidebar/RightSidebar";
import { DndContext, type DragEndEvent, type DragStartEvent, DragOverlay, PointerSensor, useSensor, useSensors, rectIntersection } from "@dnd-kit/core";

export default function EditDashboardPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { user, profile } = useAuth();
    const [dashboard, setDashboard] = useState<Dashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [leftOpen, setLeftOpen] = useState(true);
    const [rightOpen, setRightOpen] = useState(true);
    const [activeDrag, setActiveDrag] = useState<{ id: string; label: string; icon?: string } | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    );

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const data = event.active.data.current as { type: string; measureId: string; label: string } | undefined;
        if (data?.type === "measure") {
            setActiveDrag({ id: data.measureId, label: data.label });
        }
    }, []);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        setActiveDrag(null);
        const { active, over } = event;
        if (!over) return;
        const dragData = active.data.current as { type: string; measureId: string; label: string } | undefined;
        const dropData = over.data.current as { type: string; onDrop: (...args: string[]) => void } | undefined;
        if (!dragData || !dropData || dragData.type !== "measure") return;

        if (dropData.type === "card" && typeof dropData.onDrop === "function") {
            dropData.onDrop(dragData.measureId, dragData.label);
        } else if (dropData.type === "chart" && typeof dropData.onDrop === "function") {
            dropData.onDrop(dragData.measureId);
        }
    }, []);

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/bi/dashboards/${encodeURIComponent(id)}`);
                const data = await res.json();
                if (data.success && data.dashboard) {
                    setDashboard(data.dashboard);
                }
            } catch (err) {
                console.error("Load dashboard error:", err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id]);

    const updateSlot = useCallback((index: number, updates: Partial<DashboardSlot>) => {
        setDashboard((prev) => {
            if (!prev) return prev;
            const newSlots = [...prev.slots];
            newSlots[index] = { ...newSlots[index], ...updates };
            return { ...prev, slots: newSlots };
        });
    }, []);

    const expandSlot = useCallback((index: number) => {
        setDashboard((prev) => {
            if (!prev) return prev;
            const newSlots = prev.slots.filter((_, i) => i !== index + 1);
            const expanded = { ...newSlots[index], slotSize: 2 as const };
            newSlots[index] = expanded;
            return { ...prev, slots: newSlots };
        });
    }, []);

    const handleSave = useCallback(async (isPublic?: boolean) => {
        if (!dashboard || !user?.id) return;
        setSaving(true);
        try {
            await fetch(`/api/bi/dashboards/${encodeURIComponent(dashboard.id)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: dashboard.title,
                    isPublic: isPublic ?? dashboard.isPublic,
                    scope: dashboard.scope,
                    slots: dashboard.slots,
                }),
            });
            if (isPublic !== undefined) {
                setDashboard((prev) => prev ? { ...prev, isPublic } : prev);
            }
        } catch (err) {
            console.error("Save error:", err);
        } finally {
            setSaving(false);
        }
    }, [dashboard, user]);

    const handleClone = useCallback(async (sourceId: string) => {
        if (!user?.id) return;
        try {
            const res = await fetch(`/api/bi/dashboards/${encodeURIComponent(sourceId)}/clone`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ authorId: user.id, authorName: profile?.name ?? profile?.email ?? "" }),
            });
            const data = await res.json();
            if (data.success && data.id) {
                router.push(`/bi/build/${data.id}`);
            }
        } catch (err) {
            console.error("Clone error:", err);
        }
    }, [user, profile, router]);

    const handleNew = useCallback(() => {
        router.push("/bi/build");
    }, [router]);

    const handleClose = useCallback(() => {
        router.push("/dashboard");
    }, [router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-120px)] bg-gray-50 dark:bg-[#0a0a0a]">
                <Loader2 size={24} className="animate-spin text-[#FF7300]" />
            </div>
        );
    }

    if (!dashboard) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-120px)] bg-gray-50 dark:bg-[#0a0a0a]">
                <p className="text-sm text-gray-500">Dashboard not found</p>
            </div>
        );
    }

    return (
        <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex h-[calc(100vh-120px)] bg-gray-50 dark:bg-[#0a0a0a] overflow-hidden">
                <BuilderLeftSidebar
                    open={leftOpen}
                    onToggle={() => setLeftOpen(!leftOpen)}
                    dashboardId={dashboard.id}
                    onNew={handleNew}
                    onClone={handleClone}
                    onSavePrivate={() => handleSave(false)}
                    onSavePublic={() => handleSave(true)}
                    onClose={handleClose}
                    onCloseSaved={async () => { await handleSave(); handleClose(); }}
                    saving={saving}
                />

                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-[1400px] mx-auto p-4 md:p-6 space-y-4">
                        <DashboardHeader
                            title={dashboard.title}
                            authorName={dashboard.authorName}
                            createdAt={dashboard.createdAt}
                            updatedAt={dashboard.updatedAt}
                            onTitleChange={(title) => setDashboard((prev) => prev ? { ...prev, title } : prev)}
                        />

                        {saving && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Loader2 size={14} className="animate-spin" />
                                Saving...
                            </div>
                        )}

                        <DashboardCanvas
                            slots={dashboard.slots}
                            onUpdateSlot={updateSlot}
                            onExpandSlot={expandSlot}
                        />
                    </div>
                </div>

                <BuilderRightSidebar
                    open={rightOpen}
                    onToggle={() => setRightOpen(!rightOpen)}
                    dashboardId={dashboard.id}
                />
            </div>
            <DragOverlay dropAnimation={null}>
                {activeDrag ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 shadow-xl border border-[#FF7300] text-[11px] font-medium text-gray-700 dark:text-gray-200 pointer-events-none">
                        <span className="text-[#FF7300]">⬡</span>
                        {activeDrag.label}
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
