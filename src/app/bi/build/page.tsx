"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { type Dashboard, type DashboardSlot, type SlotLayoutType, type SlotSize } from "@/lib/bi-types";
import { DashboardCanvas } from "@/components/bi/builder/DashboardCanvas";
import { DashboardHeader } from "@/components/bi/builder/DashboardHeader";
import { BuilderLeftSidebar } from "@/components/bi/sidebar/LeftSidebar";
import { BuilderRightSidebar } from "@/components/bi/sidebar/RightSidebar";

function createEmptySlots(): DashboardSlot[] {
    return [0, 1, 2, 3].map((i) => ({
        id: `slot-${i}`,
        slotIndex: i,
        slotSize: 1 as SlotSize,
        layoutType: "empty" as SlotLayoutType,
        config: { cards: [], charts: [] },
    }));
}

export default function BuildDashboardPage() {
    const router = useRouter();
    const { user, profile } = useAuth();
    const [dashboard, setDashboard] = useState<Dashboard>({
        id: "",
        title: "Untitled Dashboard",
        authorId: user?.id ?? "",
        authorName: profile?.name ?? profile?.email ?? "",
        isPublic: false,
        scope: "GLOBAL",
        slots: createEmptySlots(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
    const [saving, setSaving] = useState(false);
    const [leftOpen, setLeftOpen] = useState(true);
    const [rightOpen, setRightOpen] = useState(true);

    // Sync authorId when user loads
    useEffect(() => {
        if (user?.id && !dashboard.id) {
            setDashboard((prev) => ({
                ...prev,
                authorId: user.id,
                authorName: profile?.name ?? profile?.email ?? "",
            }));
        }
    }, [user, profile, dashboard.id]);

    const updateSlot = useCallback((index: number, updates: Partial<DashboardSlot>) => {
        setDashboard((prev) => {
            const newSlots = [...prev.slots];
            newSlots[index] = { ...newSlots[index], ...updates };
            return { ...prev, slots: newSlots };
        });
    }, []);

    const expandSlot = useCallback((index: number) => {
        setDashboard((prev) => {
            const newSlots = prev.slots.filter((_, i) => i !== index + 1);
            const expanded = { ...newSlots[index], slotSize: 2 as SlotSize };
            newSlots[index] = expanded;
            return { ...prev, slots: newSlots };
        });
    }, []);

    const handleSave = useCallback(async (isPublic: boolean) => {
        if (!user?.id) return;
        setSaving(true);
        try {
            const payload = {
                title: dashboard.title,
                authorId: user.id,
                authorName: profile?.name ?? profile?.email ?? "",
                isPublic,
                scope: dashboard.scope,
                slots: dashboard.slots,
            };

            if (dashboard.id) {
                await fetch(`/api/bi/dashboards/${encodeURIComponent(dashboard.id)}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...payload, isPublic }),
                });
            } else {
                const res = await fetch("/api/bi/dashboards", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const data = await res.json();
                if (data.success && data.id) {
                    setDashboard((prev) => ({ ...prev, id: data.id, isPublic }));
                    router.replace(`/bi/build/${data.id}`);
                }
            }
        } catch (err) {
            console.error("Save error:", err);
        } finally {
            setSaving(false);
        }
    }, [dashboard, user, profile, router]);

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
        setDashboard({
            id: "",
            title: "Untitled Dashboard",
            authorId: user?.id ?? "",
            authorName: profile?.name ?? profile?.email ?? "",
            isPublic: false,
            scope: "GLOBAL",
            slots: createEmptySlots(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        router.replace("/bi/build");
    }, [user, profile, router]);

    const handleClose = useCallback(() => {
        router.push("/dashboard");
    }, [router]);

    return (
        <div className="flex h-[calc(100vh-120px)] bg-gray-50 dark:bg-[#0a0a0a] overflow-hidden">
            {/* Left Sidebar */}
            <BuilderLeftSidebar
                open={leftOpen}
                onToggle={() => setLeftOpen(!leftOpen)}
                dashboardId={dashboard.id}
                onNew={handleNew}
                onClone={handleClone}
                onSavePrivate={() => handleSave(false)}
                onSavePublic={() => handleSave(true)}
                onClose={handleClose}
                onCloseSaved={async () => { await handleSave(dashboard.isPublic); handleClose(); }}
                saving={saving}
                userId={user?.id}
            />

            {/* Main Canvas */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-[1400px] mx-auto p-4 md:p-6 space-y-4">
                    <DashboardHeader
                        title={dashboard.title}
                        authorName={dashboard.authorName}
                        createdAt={dashboard.createdAt}
                        updatedAt={dashboard.updatedAt}
                        onTitleChange={(title) => setDashboard((prev) => ({ ...prev, title }))}
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

            {/* Right Sidebar */}
            <BuilderRightSidebar
                open={rightOpen}
                onToggle={() => setRightOpen(!rightOpen)}
                dashboardId={dashboard.id}
            />
        </div>
    );
}
