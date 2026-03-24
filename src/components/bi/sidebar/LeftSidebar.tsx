"use client";

import { useState, useEffect } from "react";
import {
    PanelLeftClose, PanelLeftOpen,
    Plus, Copy, Save, Globe, Lock, X, LogOut,
    Loader2, MessageSquare, Send, User,
    ChevronDown, ChevronRight, FileText,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface LeftSidebarProps {
    open: boolean;
    onToggle: () => void;
    dashboardId: string;
    onNew: () => void;
    onClone: (id: string) => void;
    onSavePrivate: () => void;
    onSavePublic: () => void;
    onClose: () => void;
    onCloseSaved: () => void;
    saving: boolean;
    userId?: string;
}

interface Comment {
    id: string;
    userId: string;
    userName: string;
    content: string;
    createdAt: string;
    replies?: Comment[];
}

export function BuilderLeftSidebar({
    open, onToggle, dashboardId,
    onNew, onClone, onSavePrivate, onSavePublic, onClose, onCloseSaved,
    saving, userId,
}: LeftSidebarProps) {
    const router = useRouter();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [loadingComments, setLoadingComments] = useState(false);
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const [myDashboards, setMyDashboards] = useState<{id: string; title: string; updatedAt: string}[]>([]);
    const [publicDashboards, setPublicDashboards] = useState<{id: string; title: string; authorName: string; updatedAt: string}[]>([]);
    const [loadingDashboards, setLoadingDashboards] = useState(false);
    const [myOpen, setMyOpen] = useState(true);
    const [publicOpen, setPublicOpen] = useState(false);

    useEffect(() => {
        if (dashboardId && open) {
            loadComments();
        }
    }, [dashboardId, open]);

    useEffect(() => { if (open) loadDashboards(); }, [open, userId]);

    async function loadComments() {
        if (!dashboardId) return;
        setLoadingComments(true);
        try {
            const res = await fetch(`/api/bi/dashboards/${encodeURIComponent(dashboardId)}/comments`);
            const data = await res.json();
            if (data.success) setComments(data.comments ?? []);
        } catch {
            // silently fail
        } finally {
            setLoadingComments(false);
        }
    }

    async function postComment() {
        if (!dashboardId || !newComment.trim()) return;
        try {
            const body: Record<string, string> = { content: newComment.trim() };
            if (replyTo) body.parentId = replyTo;
            await fetch(`/api/bi/dashboards/${encodeURIComponent(dashboardId)}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            setNewComment("");
            setReplyTo(null);
            loadComments();
        } catch {
            // silently fail
        }
    }

    async function loadDashboards() {
        setLoadingDashboards(true);
        try {
            const [mineRes, pubRes] = await Promise.all([
                userId ? fetch(`/api/bi/dashboards?filter=mine&userId=${encodeURIComponent(userId)}`) : Promise.resolve(null),
                fetch(`/api/bi/dashboards?filter=public`),
            ]);
            if (mineRes) {
                const d = await mineRes.json();
                if (d.success) setMyDashboards(d.dashboards ?? []);
            }
            const p = await pubRes.json();
            if (p.success) setPublicDashboards(p.dashboards ?? []);
        } catch { /* silently fail */ }
        finally { setLoadingDashboards(false); }
    }

    if (!open) {
        return (
            <button
                onClick={onToggle}
                className="fixed left-0 top-1/2 -translate-y-1/2 z-30 p-2 bg-white dark:bg-[#111111] border border-gray-200 dark:border-gray-800 rounded-r-lg shadow-md hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
                <PanelLeftOpen size={16} className="text-gray-500" />
            </button>
        );
    }

    return (
        <div className="w-[260px] min-w-[260px] bg-white dark:bg-[#111111] border-r border-gray-200 dark:border-gray-800 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <span className="text-xs font-bold text-gray-900 dark:text-white">Actions</span>
                <button onClick={onToggle} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <PanelLeftClose size={14} className="text-gray-500" />
                </button>
            </div>

            {/* Action Buttons */}
            <div className="p-3 space-y-1 border-b border-gray-200 dark:border-gray-800">
                <ActionButton icon={<Plus size={14} />} label="New Dashboard" onClick={onNew} />
                {dashboardId && (
                    <ActionButton icon={<Copy size={14} />} label="Clone Dashboard" onClick={() => onClone(dashboardId)} />
                )}
                <ActionButton
                    icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                    label="Save Private"
                    onClick={onSavePrivate}
                    disabled={saving}
                />
                <ActionButton
                    icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                    label="Save Public"
                    onClick={onSavePublic}
                    disabled={saving}
                />
                <div className="border-t border-gray-100 dark:border-gray-800 my-1.5" />
                <ActionButton icon={<X size={14} />} label="Close" onClick={onClose} variant="ghost" />
                <ActionButton
                    icon={<LogOut size={14} />}
                    label="Close & Save"
                    onClick={onCloseSaved}
                    variant="ghost"
                />
            </div>

            {/* Dashboard Lists */}
            <div className="border-b border-gray-200 dark:border-gray-800">
                <button onClick={() => setMyOpen(!myOpen)}
                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                        <Lock size={10} /> My Dashboards
                    </span>
                    {myOpen ? <ChevronDown size={10} className="text-gray-400" /> : <ChevronRight size={10} className="text-gray-400" />}
                </button>
                {myOpen && (
                    <div className="px-3 pb-2 space-y-0.5 max-h-[160px] overflow-y-auto">
                        {loadingDashboards ? (
                            <div className="flex justify-center py-2"><Loader2 size={12} className="animate-spin text-gray-400" /></div>
                        ) : myDashboards.length === 0 ? (
                            <p className="text-[9px] text-gray-400 text-center py-2">No private dashboards</p>
                        ) : myDashboards.map(d => (
                            <button key={d.id} onClick={() => router.push(`/bi/build/${d.id}`)}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors
                                    ${d.id === dashboardId ? "bg-[#FF7300]/10 text-[#FF7300]" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
                                <FileText size={10} className="shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-medium truncate">{d.title}</p>
                                    <p className="text-[8px] text-gray-400">{new Date(d.updatedAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                <button onClick={() => setPublicOpen(!publicOpen)}
                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                        <Globe size={10} /> Public Dashboards
                    </span>
                    {publicOpen ? <ChevronDown size={10} className="text-gray-400" /> : <ChevronRight size={10} className="text-gray-400" />}
                </button>
                {publicOpen && (
                    <div className="px-3 pb-2 space-y-0.5 max-h-[160px] overflow-y-auto">
                        {loadingDashboards ? (
                            <div className="flex justify-center py-2"><Loader2 size={12} className="animate-spin text-gray-400" /></div>
                        ) : publicDashboards.length === 0 ? (
                            <p className="text-[9px] text-gray-400 text-center py-2">No public dashboards</p>
                        ) : publicDashboards.map(d => (
                            <button key={d.id} onClick={() => router.push(`/bi/build/${d.id}`)}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors
                                    ${d.id === dashboardId ? "bg-[#FF7300]/10 text-[#FF7300]" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
                                <FileText size={10} className="shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-medium truncate">{d.title}</p>
                                    <p className="text-[8px] text-gray-400">{d.authorName} · {new Date(d.updatedAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Comments Section */}
            <div className="flex-1 overflow-y-auto flex flex-col">
                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                        <MessageSquare size={10} /> Comments
                    </span>
                </div>

                {!dashboardId ? (
                    <div className="flex-1 flex items-center justify-center px-4">
                        <p className="text-[10px] text-gray-400 text-center">Save the dashboard first to enable comments</p>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 overflow-y-auto p-3 space-y-3">
                            {loadingComments ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 size={14} className="animate-spin text-gray-400" />
                                </div>
                            ) : comments.length === 0 ? (
                                <p className="text-[10px] text-gray-400 text-center py-4">No comments yet</p>
                            ) : (
                                comments.map((c) => (
                                    <CommentItem key={c.id} comment={c} onReply={(id) => setReplyTo(id)} />
                                ))
                            )}
                        </div>

                        {/* Comment input */}
                        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
                            {replyTo && (
                                <div className="flex items-center justify-between mb-1.5 px-1">
                                    <span className="text-[9px] text-[#FF7300]">Replying...</span>
                                    <button onClick={() => setReplyTo(null)} className="text-[9px] text-gray-400 hover:text-gray-600">Cancel</button>
                                </div>
                            )}
                            <div className="flex gap-1.5">
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && postComment()}
                                    placeholder="Add comment..."
                                    className="flex-1 text-[10px] px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-[#FF7300] outline-none"
                                />
                                <button
                                    onClick={postComment}
                                    disabled={!newComment.trim()}
                                    className="p-1.5 rounded-lg bg-[#FF7300] text-white hover:bg-[#e66800] disabled:opacity-50 transition-colors"
                                >
                                    <Send size={10} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function ActionButton({ icon, label, onClick, disabled, variant }: {
    icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; variant?: "ghost";
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50
                ${variant === "ghost"
                    ? "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
        >
            {icon}
            {label}
        </button>
    );
}

function CommentItem({ comment, onReply }: { comment: Comment; onReply: (id: string) => void }) {
    const time = new Date(comment.createdAt).toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
    });

    return (
        <div className="space-y-2">
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                    <User size={9} className="text-gray-400" />
                    <span className="text-[9px] font-semibold text-gray-600 dark:text-gray-400">{comment.userName || "User"}</span>
                    <span className="text-[8px] text-gray-400">{time}</span>
                </div>
                <p className="text-[10px] text-gray-700 dark:text-gray-300 leading-relaxed">{comment.content}</p>
                <button
                    onClick={() => onReply(comment.id)}
                    className="text-[8px] text-[#FF7300] hover:underline mt-1 font-medium"
                >
                    Reply
                </button>
            </div>

            {/* Nested replies */}
            {comment.replies && comment.replies.length > 0 && (
                <div className="ml-4 space-y-2 border-l-2 border-[#FF7300]/20 pl-2">
                    {comment.replies.map((r) => (
                        <CommentItem key={r.id} comment={r} onReply={onReply} />
                    ))}
                </div>
            )}
        </div>
    );
}
