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
} from 'lucide-react';
import type {
    WSTask,
    WSComment,
    WSActivityLog,
    WSCustomField,
    TaskStatus,
    TaskPriority,
} from '@/lib/workstream-types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/workstream-types';

interface TaskDetailPanelProps {
    task: WSTask | null;
    customFields: WSCustomField[];
    onClose: () => void;
    onUpdate: (taskId: number, field: string, value: unknown) => void;
    onDelete: (taskId: number) => void;
}

export function TaskDetailPanel({
    task,
    customFields,
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
    const commentInputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (task) {
            setTitleValue(task.title);
            setDescValue(task.description || '');
            fetchComments(task.id);
            fetchActivity(task.id);
        }
    }, [task?.id]);

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
            // Activity log would need its own API route - simplified for now
            setActivities([]);
        } catch (err) {
            console.error('Failed to fetch activity:', err);
        }
    }

    async function handleAddComment() {
        if (!newComment.trim() || !task) return;
        try {
            const res = await fetch(`/api/workstream/tasks/${task.id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newComment.trim(), user_id: 'system' }),
            });
            const json = await res.json();
            if (json.success) {
                setComments((prev) => [...prev, json.data]);
                setNewComment('');
            }
        } catch (err) {
            console.error('Failed to add comment:', err);
        }
    }

    if (!task) return null;

    const isDone = task.status === 'done';
    const statusCfg = STATUS_CONFIG[task.status];

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/30 z-[90]" onClick={onClose} />

            {/* Panel */}
            <div className="fixed right-0 top-[56px] h-[calc(100vh-56px)] w-[500px] bg-[#1e1f21] border-l border-gray-800 shadow-2xl z-[100] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                const newStatus: TaskStatus = isDone ? 'todo' : 'done';
                                onUpdate(task.id, 'status', newStatus);
                            }}
                        >
                            {isDone ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                                <Circle className="h-5 w-5 text-gray-500 hover:text-gray-300" />
                            )}
                        </button>
                        <span className={`text-xs px-2 py-0.5 rounded border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
                            {statusCfg.label}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => {
                                if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
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

                        {/* Tab navigation */}
                        <div className="flex gap-1 border-b border-gray-800">
                            {[
                                { key: 'details' as const, label: 'Detalhes', icon: Activity },
                                { key: 'comments' as const, label: 'Comentários', icon: MessageSquare, count: comments.length },
                                { key: 'activity' as const, label: 'Atividade', icon: Clock },
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

                        {/* Details tab */}
                        {activeTab === 'details' && (
                            <div className="space-y-4">
                                {/* Fields grid */}
                                <div className="bg-[#252627] rounded-lg p-4 space-y-3">
                                    {/* Status */}
                                    <div className="flex items-center gap-3">
                                        <label className="text-xs text-gray-500 w-24 flex-shrink-0">Status</label>
                                        <select
                                            value={task.status}
                                            onChange={(e) => onUpdate(task.id, 'status', e.target.value)}
                                            className="flex-1 bg-[#1e1f21] border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                                        >
                                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                                <option key={key} value={key}>{cfg.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Priority */}
                                    <div className="flex items-center gap-3">
                                        <label className="text-xs text-gray-500 w-24 flex-shrink-0">Prioridade</label>
                                        <select
                                            value={task.priority}
                                            onChange={(e) => onUpdate(task.id, 'priority', e.target.value)}
                                            className="flex-1 bg-[#1e1f21] border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                                        >
                                            {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                                                <option key={key} value={key}>{cfg.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Due Date */}
                                    <div className="flex items-center gap-3">
                                        <label className="text-xs text-gray-500 w-24 flex-shrink-0 flex items-center gap-1">
                                            <Calendar className="h-3 w-3" /> Entrega
                                        </label>
                                        <input
                                            type="date"
                                            value={task.due_date || ''}
                                            onChange={(e) => onUpdate(task.id, 'due_date', e.target.value || null)}
                                            className="flex-1 bg-[#1e1f21] border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                                        />
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
                                            Campos Customizados
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
                                    <label className="text-xs text-gray-500 block mb-1.5">Descrição</label>
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
                                                <span className="text-gray-600">Clique para adicionar descrição...</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Comments tab */}
                        {activeTab === 'comments' && (
                            <div className="space-y-3">
                                {comments.length === 0 ? (
                                    <div className="text-center py-8 text-gray-600 text-sm">
                                        Nenhum comentário ainda
                                    </div>
                                ) : (
                                    comments.map((comment) => (
                                        <div key={comment.id} className="bg-[#2a2b2d] rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                                                    <User className="h-3 w-3 text-white" />
                                                </div>
                                                <span className="text-xs text-gray-400">
                                                    {comment.user_email || 'Usuário'}
                                                </span>
                                                <span className="text-xs text-gray-600">
                                                    {new Date(comment.created_at).toLocaleDateString('pt-BR', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-300">{comment.content}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Activity tab */}
                        {activeTab === 'activity' && (
                            <div className="text-center py-8 text-gray-600 text-sm">
                                Histórico de atividades será implementado em breve
                            </div>
                        )}
                    </div>
                </div>

                {/* Comment input (always visible) */}
                <div className="flex-shrink-0 border-t border-gray-800 px-4 py-3">
                    <div className="flex gap-2">
                        <textarea
                            ref={commentInputRef}
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Adicionar comentário..."
                            rows={1}
                            className="flex-1 bg-[#2a2b2d] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleAddComment();
                                }
                            }}
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
