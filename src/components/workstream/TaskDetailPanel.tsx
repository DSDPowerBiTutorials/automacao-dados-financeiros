'use client';

import { useState, useEffect, useRef } from 'react';
import {
    X,
    Calendar,
    User,
    Tag,
    MessageSquare,
    Clock,
    Activity,
    CheckCircle2,
    Circle,
    Send,
    Trash2,
    AlertCircle,
    Link2,
    UserPlus,
    ChevronDown,
} from 'lucide-react';
import type {
    WSTask,
    WSComment,
    WSActivityLog,
    WSCustomField,
    WSUser,
    TaskStatus,
    TaskPriority,
} from '@/lib/workstream-types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/workstream-types';

interface TaskDetailPanelProps {
    task: WSTask | null;
    customFields: WSCustomField[];
    projectId?: string;
    users?: WSUser[];
    onClose: () => void;
    onUpdate: (taskId: number, field: string, value: unknown) => void;
    onDelete: (taskId: number) => void;
}

export function TaskDetailPanel({
    task,
    customFields,
    projectId,
    users = [],
    onClose,
    onUpdate,
    onDelete,
}: TaskDetailPanelProps) {
    const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'activity'>('details');
    const [comments, setComments] = useState<WSComment[]>([]);
    const [activities, setActivities] = useState<WSActivityLog[]>([]);
    const [newComment, setNewComment] = useState('');
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleValue, setTitleValue] = useState('');
    const [editingDesc, setEditingDesc] = useState(false);
    const [descValue, setDescValue] = useState('');
    const [showAssigneePicker, setShowAssigneePicker] = useState(false);
    const [assigneeSearch, setAssigneeSearch] = useState('');
    const [showMentionList, setShowMentionList] = useState(false);
    const [mentionSearch, setMentionSearch] = useState('');
    const [mentionStartIndex, setMentionStartIndex] = useState(-1);
    const commentInputRef = useRef<HTMLTextAreaElement>(null);
    const mentionListRef = useRef<HTMLDivElement>(null);
    const assigneePickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (task) {
            setTitleValue(task.title);
            setDescValue(task.description || '');
            fetchComments(task.id);
            fetchActivity(task.id);
        }
    }, [task?.id]);

    // Close assignee picker on click outside
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (assigneePickerRef.current && !assigneePickerRef.current.contains(e.target as Node)) {
                setShowAssigneePicker(false);
            }
        }
        if (showAssigneePicker) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showAssigneePicker]);

    async function fetchComments(taskId: number) {
        try {
            const res = await fetch(`/api/workstream/tasks/${taskId}/comments`);
            const json = await res.json();
            if (json.success) setComments(json.data || []);
        } catch (err) {
            console.error('Failed to fetch comments:', err);
        }
    }

    async function fetchActivity(taskId: number) {
        try {
            setActivities([]);
        } catch (err) {
            console.error('Failed to fetch activity:', err);
        }
    }

    // Extract @mentions from comment text
    function extractMentions(text: string): string[] {
        const mentionRegex = /@(\w[\w\s]*?)(?=\s@|\s*$|[.,!?;])/g;
        const mentions: string[] = [];
        let match;
        while ((match = mentionRegex.exec(text)) !== null) {
            const name = match[1].trim();
            const user = users.find(u => u.name.toLowerCase() === name.toLowerCase());
            if (user) mentions.push(user.id);
        }
        return [...new Set(mentions)];
    }

    async function handleAddComment() {
        if (!newComment.trim() || !task) return;
        try {
            const res = await fetch(`/api/workstream/tasks/${task.id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newComment.trim(), user_id: null }),
            });
            const json = await res.json();
            if (json.success) {
                setComments((prev) => [...prev, json.data]);

                // Auto-add mentioned users as project members
                if (projectId) {
                    const mentionedIds = extractMentions(newComment);
                    for (const userId of mentionedIds) {
                        try {
                            await fetch(`/api/workstream/projects/${projectId}/members`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ user_id: userId, role: 'member' }),
                            });
                        } catch { /* ignore duplicate */ }
                    }
                }

                setNewComment('');
            }
        } catch (err) {
            console.error('Failed to add comment:', err);
        }
    }

    // Handle @mention in comment input
    function handleCommentKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (showMentionList) {
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowMentionList(false);
                return;
            }
        }
        if (e.key === 'Enter' && !e.shiftKey && !showMentionList) {
            e.preventDefault();
            handleAddComment();
        }
    }

    function handleCommentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        const value = e.target.value;
        const cursorPos = e.target.selectionStart;
        setNewComment(value);

        // Check for @mention trigger
        const textBeforeCursor = value.slice(0, cursorPos);
        const atIndex = textBeforeCursor.lastIndexOf('@');

        if (atIndex !== -1) {
            const textAfterAt = textBeforeCursor.slice(atIndex + 1);
            // Only trigger if there's no space before the text after @, or it's just typed
            if (!textAfterAt.includes('\n') && textAfterAt.length < 30) {
                setShowMentionList(true);
                setMentionSearch(textAfterAt.toLowerCase());
                setMentionStartIndex(atIndex);
                return;
            }
        }
        setShowMentionList(false);
    }

    function selectMention(user: WSUser) {
        const before = newComment.slice(0, mentionStartIndex);
        const after = newComment.slice(commentInputRef.current?.selectionStart || mentionStartIndex);
        const newText = `${before}@${user.name} ${after}`;
        setNewComment(newText);
        setShowMentionList(false);
        commentInputRef.current?.focus();
    }

    const filteredMentionUsers = users.filter(u =>
        u.name.toLowerCase().includes(mentionSearch) ||
        u.email.toLowerCase().includes(mentionSearch)
    );

    // Get assignee display info
    const assignee = users.find(u => u.id === task?.assignee_id);
    const filteredAssigneeUsers = users.filter(u =>
        u.name.toLowerCase().includes(assigneeSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(assigneeSearch.toLowerCase())
    );

    if (!task) return null;

    const isDone = task.status === 'done';
    const statusCfg = STATUS_CONFIG[task.status];
    const isOverdue = task.due_date && !task.completed_at && new Date(task.due_date) < new Date();

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/30 z-[90]" onClick={onClose} />

            {/* Panel */}
            <div className="fixed right-0 top-[56px] h-[calc(100vh-56px)] w-[520px] bg-[#1e1f21] border-l border-gray-800 shadow-2xl z-[100] flex flex-col overflow-hidden">
                {/* Top bar — close + delete */}
                <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-800 flex-shrink-0">
                    <button
                        onClick={() => {
                            const newStatus: TaskStatus = isDone ? 'todo' : 'done';
                            onUpdate(task.id, 'status', newStatus);
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isDone
                            ? 'bg-green-900/30 text-green-400 border border-green-700 hover:bg-green-900/40'
                            : 'bg-[#2a2b2d] text-gray-400 border border-gray-700 hover:text-white hover:border-gray-500'
                            }`}
                    >
                        {isDone ? (
                            <CheckCircle2 className="h-4 w-4" />
                        ) : (
                            <Circle className="h-4 w-4" />
                        )}
                        {isDone ? 'Completed' : 'Mark complete'}
                    </button>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => {
                                if (confirm('Are you sure you want to delete this task?')) {
                                    onDelete(task.id);
                                    onClose();
                                }
                            }}
                            className="p-1.5 rounded hover:bg-red-900/20 text-gray-500 hover:text-red-400 transition-colors"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="px-5 py-4 space-y-5">
                        {/* Title */}
                        {editingTitle ? (
                            <input
                                value={titleValue}
                                onChange={(e) => setTitleValue(e.target.value)}
                                onBlur={() => {
                                    if (titleValue.trim() && titleValue !== task.title) {
                                        onUpdate(task.id, 'title', titleValue.trim());
                                    }
                                    setEditingTitle(false);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        if (titleValue.trim() && titleValue !== task.title) {
                                            onUpdate(task.id, 'title', titleValue.trim());
                                        }
                                        setEditingTitle(false);
                                    }
                                    if (e.key === 'Escape') {
                                        setTitleValue(task.title);
                                        setEditingTitle(false);
                                    }
                                }}
                                className="w-full bg-transparent border-none text-xl font-bold text-white focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
                                autoFocus
                            />
                        ) : (
                            <h2
                                className={`text-xl font-bold cursor-pointer hover:text-blue-400 transition-colors ${isDone ? 'text-gray-500 line-through' : 'text-white'
                                    }`}
                                onClick={() => {
                                    setTitleValue(task.title);
                                    setEditingTitle(true);
                                }}
                            >
                                {task.title}
                            </h2>
                        )}

                        {/* =============== ASANA-STYLE HEADER FIELDS =============== */}
                        <div className="bg-[#252627] rounded-lg p-4 space-y-3">
                            {/* Assignee — prominent like Asana */}
                            <div className="flex items-center gap-3">
                                <label className="text-xs text-gray-500 w-24 flex-shrink-0 flex items-center gap-1">
                                    <User className="h-3 w-3" /> Assignee
                                </label>
                                <div className="relative flex-1" ref={assigneePickerRef}>
                                    <button
                                        onClick={() => setShowAssigneePicker(!showAssigneePicker)}
                                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-[#1e1f21] border border-transparent hover:border-gray-600 transition-colors"
                                    >
                                        {assignee ? (
                                            <>
                                                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium">
                                                    {assignee.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-sm text-white">{assignee.name}</span>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
                                                    <UserPlus className="h-3 w-3 text-gray-500" />
                                                </div>
                                                <span className="text-sm text-gray-500">Unassigned</span>
                                            </>
                                        )}
                                        <ChevronDown className="h-3 w-3 text-gray-500 ml-auto" />
                                    </button>
                                    {showAssigneePicker && (
                                        <div className="absolute left-0 top-full mt-1 z-30 bg-[#2a2b2d] border border-gray-700 rounded-lg shadow-xl w-64 max-h-60 overflow-hidden">
                                            <div className="p-2 border-b border-gray-700">
                                                <input
                                                    value={assigneeSearch}
                                                    onChange={(e) => setAssigneeSearch(e.target.value)}
                                                    placeholder="Search people..."
                                                    className="w-full bg-[#1e1f21] border border-gray-600 rounded px-2 py-1 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="overflow-y-auto max-h-44">
                                                {/* Unassign option */}
                                                <button
                                                    onClick={() => {
                                                        onUpdate(task.id, 'assignee_id', null);
                                                        setShowAssigneePicker(false);
                                                        setAssigneeSearch('');
                                                    }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 text-left"
                                                >
                                                    <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
                                                        <X className="h-3 w-3 text-gray-500" />
                                                    </div>
                                                    <span className="text-sm text-gray-400">Unassigned</span>
                                                </button>
                                                {filteredAssigneeUsers.map((u) => (
                                                    <button
                                                        key={u.id}
                                                        onClick={() => {
                                                            onUpdate(task.id, 'assignee_id', u.id);
                                                            setShowAssigneePicker(false);
                                                            setAssigneeSearch('');
                                                        }}
                                                        className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 text-left ${task.assignee_id === u.id ? 'bg-blue-900/20' : ''
                                                            }`}
                                                    >
                                                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium">
                                                            {u.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm text-white truncate">{u.name}</p>
                                                            <p className="text-[10px] text-gray-500 truncate">{u.email}</p>
                                                        </div>
                                                        {task.assignee_id === u.id && (
                                                            <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                                                        )}
                                                    </button>
                                                ))}
                                                {filteredAssigneeUsers.length === 0 && (
                                                    <p className="px-3 py-2 text-xs text-gray-500">No users found</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Due Date — styled like Asana */}
                            <div className="flex items-center gap-3">
                                <label className="text-xs text-gray-500 w-24 flex-shrink-0 flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> Due Date
                                </label>
                                <div className="flex-1 flex items-center gap-2">
                                    <input
                                        type="date"
                                        value={task.due_date || ''}
                                        onChange={(e) => onUpdate(task.id, 'due_date', e.target.value || null)}
                                        className={`flex-1 bg-[#1e1f21] border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500 ${isOverdue
                                            ? 'text-red-400 border-red-700'
                                            : 'text-white border-gray-600'
                                            }`}
                                    />
                                    {isOverdue && (
                                        <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                                            <AlertCircle className="h-3 w-3" /> Overdue
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Status */}
                            <div className="flex items-center gap-3">
                                <label className="text-xs text-gray-500 w-24 flex-shrink-0">Status</label>
                                <select
                                    value={task.status}
                                    onChange={(e) => onUpdate(task.id, 'status', e.target.value)}
                                    className="flex-1 bg-[#1e1f21] border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                                >
                                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                        <option key={key} value={key}>{cfg.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Priority */}
                            <div className="flex items-center gap-3">
                                <label className="text-xs text-gray-500 w-24 flex-shrink-0">Priority</label>
                                <select
                                    value={task.priority}
                                    onChange={(e) => onUpdate(task.id, 'priority', e.target.value)}
                                    className="flex-1 bg-[#1e1f21] border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                                >
                                    {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                                        <option key={key} value={key}>{cfg.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Tags */}
                            <div className="flex items-start gap-3">
                                <label className="text-xs text-gray-500 w-24 flex-shrink-0 mt-1 flex items-center gap-1">
                                    <Tag className="h-3 w-3" /> Tags
                                </label>
                                <div className="flex-1 flex flex-wrap gap-1">
                                    {task.tags?.map((tag) => (
                                        <span
                                            key={tag}
                                            className="px-2 py-0.5 text-xs rounded bg-purple-900/30 text-purple-400 border border-purple-700 flex items-center gap-1"
                                        >
                                            {tag}
                                            <button
                                                onClick={() => {
                                                    const newTags = task.tags.filter((t) => t !== tag);
                                                    onUpdate(task.id, 'tags', newTags);
                                                }}
                                                className="hover:text-white"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                    <input
                                        placeholder="+ tag"
                                        className="bg-transparent text-xs text-gray-400 focus:outline-none w-16"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                                                const newTag = (e.target as HTMLInputElement).value.trim();
                                                const newTags = [...(task.tags || []), newTag];
                                                onUpdate(task.id, 'tags', newTags);
                                                (e.target as HTMLInputElement).value = '';
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Custom Fields */}
                        {customFields.length > 0 && (
                            <div className="bg-[#252627] rounded-lg p-4 space-y-3">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                    Custom Fields
                                </h4>
                                {customFields.map((cf) => {
                                    const value = (task.custom_data as Record<string, unknown>)?.[cf.field_key] ?? '';
                                    return (
                                        <div key={cf.id} className="flex items-center gap-3">
                                            <label className="text-xs text-gray-500 w-24 flex-shrink-0 truncate">
                                                {cf.field_name}
                                            </label>
                                            {cf.field_type === 'select' ? (
                                                <select
                                                    value={String(value)}
                                                    onChange={(e) => {
                                                        const newData = { ...(task.custom_data || {}), [cf.field_key]: e.target.value };
                                                        onUpdate(task.id, 'custom_data', newData);
                                                    }}
                                                    className="flex-1 bg-[#1e1f21] border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                                                >
                                                    <option value="">—</option>
                                                    {(cf.field_options as string[])?.map((opt) => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            ) : cf.field_type === 'checkbox' ? (
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(value)}
                                                    onChange={(e) => {
                                                        const newData = { ...(task.custom_data || {}), [cf.field_key]: e.target.checked };
                                                        onUpdate(task.id, 'custom_data', newData);
                                                    }}
                                                    className="h-4 w-4"
                                                />
                                            ) : cf.field_type === 'date' ? (
                                                <input
                                                    type="date"
                                                    value={String(value || '')}
                                                    onChange={(e) => {
                                                        const newData = { ...(task.custom_data || {}), [cf.field_key]: e.target.value };
                                                        onUpdate(task.id, 'custom_data', newData);
                                                    }}
                                                    className="flex-1 bg-[#1e1f21] border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                                                />
                                            ) : (
                                                <input
                                                    type={cf.field_type === 'number' || cf.field_type === 'currency' ? 'number' : cf.field_type === 'url' ? 'url' : 'text'}
                                                    value={String(value || '')}
                                                    onChange={(e) => {
                                                        const val = cf.field_type === 'number' || cf.field_type === 'currency' ? parseFloat(e.target.value) || '' : e.target.value;
                                                        const newData = { ...(task.custom_data || {}), [cf.field_key]: val };
                                                        onUpdate(task.id, 'custom_data', newData);
                                                    }}
                                                    placeholder={cf.field_name}
                                                    className="flex-1 bg-[#1e1f21] border border-gray-600 rounded px-2 py-1 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                                    step={cf.field_type === 'currency' ? '0.01' : undefined}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Description */}
                        <div>
                            <label className="text-xs text-gray-500 block mb-1.5">Description</label>
                            {editingDesc ? (
                                <textarea
                                    value={descValue}
                                    onChange={(e) => setDescValue(e.target.value)}
                                    onBlur={() => {
                                        if (descValue !== task.description) {
                                            onUpdate(task.id, 'description', descValue);
                                        }
                                        setEditingDesc(false);
                                    }}
                                    className="w-full bg-[#2a2b2d] border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none min-h-[100px]"
                                    autoFocus
                                />
                            ) : (
                                <div
                                    onClick={() => {
                                        setDescValue(task.description || '');
                                        setEditingDesc(true);
                                    }}
                                    className="bg-[#2a2b2d] rounded-lg p-3 text-sm text-gray-300 min-h-[60px] cursor-pointer hover:border-gray-600 border border-transparent transition-colors"
                                >
                                    {task.description || (
                                        <span className="text-gray-600">Click to add a description...</span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Tab navigation */}
                        <div className="flex gap-1 border-b border-gray-800">
                            {[
                                { key: 'comments' as const, label: 'Comments', icon: MessageSquare, count: comments.length },
                                { key: 'activity' as const, label: 'Activity', icon: Clock },
                            ].map(({ key, label, icon: Icon, count }) => (
                                <button
                                    key={key}
                                    onClick={() => setActiveTab(key)}
                                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === key
                                        ? 'border-blue-500 text-blue-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {label}
                                    {count !== undefined && count > 0 && (
                                        <span className="bg-gray-700 text-gray-300 text-[10px] px-1.5 rounded-full">{count}</span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Comments tab */}
                        {activeTab === 'comments' && (
                            <div className="space-y-3">
                                {comments.length === 0 ? (
                                    <div className="text-center py-8 text-gray-600 text-sm">
                                        No comments yet
                                    </div>
                                ) : (
                                    comments.map((comment) => {
                                        const commentUser = users.find(u => u.id === comment.user_id);
                                        return (
                                            <div key={comment.id} className="bg-[#2a2b2d] rounded-lg p-3">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                                                        {commentUser ? (
                                                            <span className="text-[10px] text-white font-medium">
                                                                {commentUser.name.charAt(0).toUpperCase()}
                                                            </span>
                                                        ) : (
                                                            <User className="h-3 w-3 text-white" />
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-gray-400">
                                                        {commentUser?.name || comment.user_email || 'User'}
                                                    </span>
                                                    <span className="text-xs text-gray-600">
                                                        {new Date(comment.created_at).toLocaleDateString('en-US', {
                                                            day: '2-digit',
                                                            month: 'short',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-300 whitespace-pre-wrap">
                                                    {comment.content.split(/(@\w[\w\s]*?)(?=\s@|\s*$|[.,!?;])/).map((part, i) => {
                                                        if (part.startsWith('@')) {
                                                            return (
                                                                <span key={i} className="text-blue-400 font-medium">
                                                                    {part}
                                                                </span>
                                                            );
                                                        }
                                                        return part;
                                                    })}
                                                </p>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* Activity tab */}
                        {activeTab === 'activity' && (
                            <div className="text-center py-8 text-gray-600 text-sm">
                                Activity history coming soon
                            </div>
                        )}
                    </div>
                </div>

                {/* Comment input (always visible) with @mention */}
                <div className="flex-shrink-0 border-t border-gray-800 px-4 py-3 relative">
                    {/* @Mention autocomplete dropdown */}
                    {showMentionList && filteredMentionUsers.length > 0 && (
                        <div
                            ref={mentionListRef}
                            className="absolute bottom-full left-4 right-4 mb-1 bg-[#2a2b2d] border border-gray-700 rounded-lg shadow-xl max-h-44 overflow-y-auto z-50"
                        >
                            {filteredMentionUsers.map((u) => (
                                <button
                                    key={u.id}
                                    onClick={() => selectMention(u)}
                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 text-left"
                                >
                                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium">
                                        {u.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-white truncate">{u.name}</p>
                                        <p className="text-[10px] text-gray-500 truncate">{u.email}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <textarea
                            ref={commentInputRef}
                            value={newComment}
                            onChange={handleCommentChange}
                            onKeyDown={handleCommentKeyDown}
                            placeholder="Add a comment... (use @ to mention)"
                            rows={1}
                            className="flex-1 bg-[#2a2b2d] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                        />
                        <button
                            onClick={handleAddComment}
                            disabled={!newComment.trim()}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 transition-colors"
                        >
                            <Send className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
