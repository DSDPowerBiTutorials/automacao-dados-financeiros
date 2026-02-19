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
    Paperclip,
    FileText,
    Image as ImageIcon,
    Download,
    Users,
    Plus,
    MoreHorizontal,
    Pencil,
    GitBranch,
    ArrowRight,
    Palette,
} from 'lucide-react';
import type {
    WSTask,
    WSComment,
    WSActivityLog,
    WSCustomField,
    WSUser,
    WSTaskCollaborator,
    WSAttachment,
    WSTaskDependency,
    WSLabel,
    TaskStatus,
    TaskPriority,
} from '@/lib/workstream-types';
import { STATUS_CONFIG, PRIORITY_CONFIG, LABEL_COLORS } from '@/lib/workstream-types';
import { useAuth } from '@/contexts/auth-context';

interface TaskDetailPanelProps {
    task: WSTask | null;
    customFields: WSCustomField[];
    projectId?: string;
    users?: WSUser[];
    allTasks?: WSTask[];
    onClose: () => void;
    onUpdate: (taskId: number, field: string, value: unknown) => void;
    onDelete: (taskId: number) => void;
}

export function TaskDetailPanel({
    task: externalTask,
    customFields,
    projectId,
    users = [],
    allTasks = [],
    onClose,
    onUpdate,
    onDelete,
}: TaskDetailPanelProps) {
    const { profile } = useAuth();
    // Navigation stack: allows drilling into subtasks and back
    const [taskStack, setTaskStack] = useState<WSTask[]>([]);
    // The currently displayed task — either the external task or a subtask the user navigated into
    const task = taskStack.length > 0 ? taskStack[taskStack.length - 1] : externalTask;
    const isSubtaskView = task !== null && task.parent_task_id !== null && task.parent_task_id !== undefined;

    // Reset stack when external task changes
    useEffect(() => {
        setTaskStack([]);
    }, [externalTask?.id]);

    // Navigate into a subtask
    function openSubtask(subtask: WSTask) {
        setTaskStack(prev => [...prev, subtask]);
    }

    // Navigate back to parent
    function goBackToParent() {
        setTaskStack(prev => prev.slice(0, -1));
    }

    const [activeTab, setActiveTab] = useState<'comments' | 'attachments' | 'activity'>('comments');
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
    const [collaborators, setCollaborators] = useState<WSTaskCollaborator[]>([]);
    const [showCollabPicker, setShowCollabPicker] = useState(false);
    const [collabSearch, setCollabSearch] = useState('');
    const [taskAttachments, setTaskAttachments] = useState<WSAttachment[]>([]);
    const [uploading, setUploading] = useState(false);
    const [commentFile, setCommentFile] = useState<File | null>(null);
    // Phase 2 state
    const [subtasks, setSubtasks] = useState<WSTask[]>([]);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [showSubtaskInput, setShowSubtaskInput] = useState(false);
    const [dependencies, setDependencies] = useState<{ blockedBy: WSTaskDependency[]; blocking: WSTaskDependency[] }>({ blockedBy: [], blocking: [] });
    const [showDepPicker, setShowDepPicker] = useState(false);
    const [depSearch, setDepSearch] = useState('');
    const [taskLabels, setTaskLabels] = useState<WSLabel[]>([]);
    const [projectLabels, setProjectLabels] = useState<WSLabel[]>([]);
    const [showLabelPicker, setShowLabelPicker] = useState(false);
    const [newLabelName, setNewLabelName] = useState('');
    const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[6]);
    const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
    const [editCommentValue, setEditCommentValue] = useState('');
    const commentInputRef = useRef<HTMLTextAreaElement>(null);
    const commentFileRef = useRef<HTMLInputElement>(null);
    const mentionListRef = useRef<HTMLDivElement>(null);
    const assigneePickerRef = useRef<HTMLDivElement>(null);
    const collabPickerRef = useRef<HTMLDivElement>(null);
    const taskFileRef = useRef<HTMLInputElement>(null);
    const depPickerRef = useRef<HTMLDivElement>(null);
    const labelPickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (task) {
            setTitleValue(task.title);
            setDescValue(task.description || '');
            fetchComments(task.id);
            fetchActivity(task.id);
            fetchCollaborators(task.id);
            fetchAttachments(task.id);
            fetchSubtasks(task.id);
            fetchDependencies(task.id);
            fetchTaskLabels(task.id);
            if (projectId) fetchProjectLabels(projectId);
        }
    }, [task?.id]);

    // Close pickers on click outside
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (assigneePickerRef.current && !assigneePickerRef.current.contains(e.target as Node)) {
                setShowAssigneePicker(false);
            }
            if (collabPickerRef.current && !collabPickerRef.current.contains(e.target as Node)) {
                setShowCollabPicker(false);
            }
            if (depPickerRef.current && !depPickerRef.current.contains(e.target as Node)) {
                setShowDepPicker(false);
            }
            if (labelPickerRef.current && !labelPickerRef.current.contains(e.target as Node)) {
                setShowLabelPicker(false);
            }
        }
        if (showAssigneePicker || showCollabPicker || showDepPicker || showLabelPicker) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showAssigneePicker, showCollabPicker, showDepPicker, showLabelPicker]);

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
            const res = await fetch(`/api/workstream/tasks/${taskId}/activity`);
            const json = await res.json();
            if (json.success) setActivities(json.data || []);
        } catch (err) {
            console.error('Failed to fetch activity:', err);
        }
    }

    async function fetchSubtasks(taskId: number) {
        try {
            const res = await fetch(`/api/workstream/tasks/${taskId}/subtasks`);
            const json = await res.json();
            if (json.success) setSubtasks(json.data || []);
        } catch (err) {
            console.error('Failed to fetch subtasks:', err);
        }
    }

    async function fetchDependencies(taskId: number) {
        try {
            const res = await fetch(`/api/workstream/tasks/${taskId}/dependencies`);
            const json = await res.json();
            if (json.success) setDependencies(json.data || { blockedBy: [], blocking: [] });
        } catch (err) {
            console.error('Failed to fetch dependencies:', err);
        }
    }

    async function fetchTaskLabels(taskId: number) {
        try {
            const res = await fetch(`/api/workstream/tasks/${taskId}/labels`);
            const json = await res.json();
            if (json.success) {
                const labels = (json.data || []).map((tl: Record<string, unknown>) => {
                    const wsLabel = tl.ws_labels as Record<string, unknown> | undefined;
                    return wsLabel ? { id: wsLabel.id, name: wsLabel.name, color: wsLabel.color, project_id: '', created_at: '' } : null;
                }).filter(Boolean) as WSLabel[];
                setTaskLabels(labels);
            }
        } catch (err) {
            console.error('Failed to fetch task labels:', err);
        }
    }

    async function fetchProjectLabels(projId: string) {
        try {
            const res = await fetch(`/api/workstream/labels?project_id=${projId}`);
            const json = await res.json();
            if (json.success) setProjectLabels(json.data || []);
        } catch (err) {
            console.error('Failed to fetch project labels:', err);
        }
    }

    async function handleCreateSubtask() {
        if (!task || !newSubtaskTitle.trim()) return;
        try {
            const res = await fetch(`/api/workstream/tasks/${task.id}/subtasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: newSubtaskTitle.trim(),
                    section_id: task.section_id,
                    project_id: task.project_id,
                    position: subtasks.length,
                }),
            });
            const json = await res.json();
            if (json.success && json.data) {
                setSubtasks(prev => [...prev, json.data]);
                setNewSubtaskTitle('');
                setShowSubtaskInput(false);
            } else {
                console.error('Subtask creation failed:', json.error);
            }
        } catch (err) {
            console.error('Failed to create subtask:', err);
        }
    }

    async function handleToggleSubtask(subtask: WSTask) {
        const newStatus: TaskStatus = subtask.status === 'done' ? 'todo' : 'done';
        try {
            await fetch(`/api/workstream/tasks/${subtask.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null }),
            });
            setSubtasks(prev => prev.map(s => s.id === subtask.id ? { ...s, status: newStatus } : s));
        } catch (err) {
            console.error('Failed to toggle subtask:', err);
        }
    }

    async function handleAddDependency(blockingTaskId: number) {
        if (!task) return;
        try {
            await fetch(`/api/workstream/tasks/${task.id}/dependencies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blocking_task_id: blockingTaskId }),
            });
            await fetchDependencies(task.id);
            setShowDepPicker(false);
            setDepSearch('');
        } catch (err) {
            console.error('Failed to add dependency:', err);
        }
    }

    async function handleRemoveDependency(depId: number) {
        if (!task) return;
        try {
            await fetch(`/api/workstream/tasks/${task.id}/dependencies?dependency_id=${depId}`, { method: 'DELETE' });
            await fetchDependencies(task.id);
        } catch (err) {
            console.error('Failed to remove dependency:', err);
        }
    }

    async function handleAddLabel(labelId: number) {
        if (!task) return;
        try {
            await fetch(`/api/workstream/tasks/${task.id}/labels`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label_id: labelId }),
            });
            await fetchTaskLabels(task.id);
        } catch (err) {
            console.error('Failed to add label:', err);
        }
    }

    async function handleRemoveLabel(labelId: number) {
        if (!task) return;
        try {
            await fetch(`/api/workstream/tasks/${task.id}/labels?label_id=${labelId}`, { method: 'DELETE' });
            setTaskLabels(prev => prev.filter(l => l.id !== labelId));
        } catch (err) {
            console.error('Failed to remove label:', err);
        }
    }

    async function handleCreateLabel() {
        if (!projectId || !newLabelName.trim()) return;
        try {
            const res = await fetch('/api/workstream/labels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_id: projectId, name: newLabelName.trim(), color: newLabelColor }),
            });
            const json = await res.json();
            if (json.success) {
                setProjectLabels(prev => [...prev, json.data]);
                setNewLabelName('');
            }
        } catch (err) {
            console.error('Failed to create label:', err);
        }
    }

    async function handleEditComment(commentId: number) {
        if (!editCommentValue.trim()) return;
        try {
            const res = await fetch(`/api/workstream/tasks/${task?.id}/comments`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment_id: commentId, content: editCommentValue.trim() }),
            });
            const json = await res.json();
            if (json.success) {
                setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: editCommentValue.trim(), edited_at: new Date().toISOString() } : c));
                setEditingCommentId(null);
                setEditCommentValue('');
            }
        } catch (err) {
            console.error('Failed to edit comment:', err);
        }
    }

    async function handleDeleteComment(commentId: number) {
        try {
            const res = await fetch(`/api/workstream/tasks/${task?.id}/comments?comment_id=${commentId}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.success) {
                setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: '[This comment has been deleted]', is_deleted: true } : c));
            }
        } catch (err) {
            console.error('Failed to delete comment:', err);
        }
    }

    async function fetchCollaborators(taskId: number) {
        try {
            const res = await fetch(`/api/workstream/tasks/${taskId}/collaborators`);
            const json = await res.json();
            if (json.success) setCollaborators(json.data || []);
        } catch (err) {
            console.error('Failed to fetch collaborators:', err);
        }
    }

    async function fetchAttachments(taskId: number) {
        try {
            const res = await fetch(`/api/workstream/attachments?entity_type=task&entity_id=${taskId}`);
            const json = await res.json();
            if (json.success) setTaskAttachments(json.data || []);
        } catch (err) {
            console.error('Failed to fetch attachments:', err);
        }
    }

    async function handleAddCollaborator(userId: string) {
        if (!task) return;
        try {
            await fetch(`/api/workstream/tasks/${task.id}/collaborators`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, added_by: null }),
            });
            await fetchCollaborators(task.id);
            setShowCollabPicker(false);
            setCollabSearch('');
        } catch (err) {
            console.error('Failed to add collaborator:', err);
        }
    }

    async function handleRemoveCollaborator(userId: string) {
        if (!task) return;
        try {
            await fetch(`/api/workstream/tasks/${task.id}/collaborators?user_id=${userId}`, {
                method: 'DELETE',
            });
            setCollaborators(prev => prev.filter(c => c.user_id !== userId));
        } catch (err) {
            console.error('Failed to remove collaborator:', err);
        }
    }

    async function handleUploadTaskFile(files: FileList) {
        if (!task || files.length === 0) return;
        setUploading(true);
        try {
            for (const file of Array.from(files)) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('entity_type', 'task');
                formData.append('entity_id', String(task.id));
                formData.append('kind', file.type.startsWith('image/') ? 'image' : 'document');
                const res = await fetch('/api/workstream/attachments', { method: 'POST', body: formData });
                const json = await res.json();
                if (!json.success) console.error('Upload failed:', json.error);
            }
            await fetchAttachments(task.id);
        } catch (err) {
            console.error('Failed to upload:', err);
        } finally {
            setUploading(false);
        }
    }

    async function handleDeleteAttachment(attachmentId: string) {
        try {
            await fetch(`/api/workstream/attachments?id=${attachmentId}`, { method: 'DELETE' });
            setTaskAttachments(prev => prev.filter(a => a.id !== attachmentId));
        } catch (err) {
            console.error('Failed to delete attachment:', err);
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
        if (!newComment.trim() && !commentFile) return;
        if (!task) return;
        try {
            const content = newComment.trim() || (commentFile ? `📎 ${commentFile.name}` : '');
            const res = await fetch(`/api/workstream/tasks/${task.id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, user_id: profile?.id || null }),
            });
            const json = await res.json();
            if (json.success) {
                // Upload file attachment linked to the comment
                if (commentFile && json.data?.id) {
                    const formData = new FormData();
                    formData.append('file', commentFile);
                    formData.append('entity_type', 'comment');
                    formData.append('entity_id', String(json.data.id));
                    formData.append('kind', commentFile.type.startsWith('image/') ? 'screenshot' : 'document');
                    await fetch('/api/workstream/attachments', { method: 'POST', body: formData });
                }

                setComments((prev) => [...prev, json.data]);
                setNewComment('');
                setCommentFile(null);
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
            <div className="fixed right-0 top-[56px] h-[calc(100vh-56px)] w-[520px] bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800 shadow-2xl z-[100] flex flex-col overflow-hidden">
                {/* Top bar — close + delete */}
                <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
                    {/* Breadcrumb when viewing a subtask */}
                    {isSubtaskView && taskStack.length > 0 ? (
                        <button
                            onClick={goBackToParent}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-700 hover:border-gray-500 transition-colors"
                        >
                            <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                            Back to parent task
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                const newStatus: TaskStatus = isDone ? 'todo' : 'done';
                                onUpdate(task.id, 'status', newStatus);
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isDone
                                ? 'bg-green-900/30 text-green-400 border border-green-700 hover:bg-green-900/40'
                                : 'bg-gray-50 dark:bg-[#0a0a0a] text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:text-gray-900 dark:text-white hover:border-gray-500'
                                }`}
                        >
                            {isDone ? (
                                <CheckCircle2 className="h-4 w-4" />
                            ) : (
                                <Circle className="h-4 w-4" />
                            )}
                            {isDone ? 'Completed' : 'Mark complete'}
                        </button>
                    )}
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
                            className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-gray-900 dark:text-white transition-colors"
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
                                className="w-full bg-transparent border-none text-xl font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
                                autoFocus
                            />
                        ) : (
                            <h2
                                className={`text-xl font-bold cursor-pointer hover:text-blue-400 transition-colors ${isDone ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-white'
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
                        <div className="bg-gray-100 dark:bg-[#0a0a0a] rounded-lg p-4 space-y-3">
                            {/* Assignee — prominent like Asana */}
                            <div className="flex items-center gap-3">
                                <label className="text-xs text-gray-500 w-24 flex-shrink-0 flex items-center gap-1">
                                    <User className="h-3 w-3" /> Assignee
                                </label>
                                <div className="relative flex-1" ref={assigneePickerRef}>
                                    <button
                                        onClick={() => setShowAssigneePicker(!showAssigneePicker)}
                                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1e1f21] border border-transparent hover:border-gray-300 dark:border-gray-600 transition-colors"
                                    >
                                        {assignee ? (
                                            <>
                                                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium">
                                                    {assignee.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-sm text-gray-900 dark:text-white">{assignee.name}</span>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-[#0a0a0a] flex items-center justify-center">
                                                    <UserPlus className="h-3 w-3 text-gray-500" />
                                                </div>
                                                <span className="text-sm text-gray-500">Unassigned</span>
                                            </>
                                        )}
                                        <ChevronDown className="h-3 w-3 text-gray-500 ml-auto" />
                                    </button>
                                    {showAssigneePicker && (
                                        <div className="absolute left-0 top-full mt-1 z-30 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl w-64 max-h-60 overflow-hidden">
                                            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                                                <input
                                                    value={assigneeSearch}
                                                    onChange={(e) => setAssigneeSearch(e.target.value)}
                                                    placeholder="Search people..."
                                                    className="w-full bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
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
                                                    <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-[#0a0a0a] flex items-center justify-center">
                                                        <X className="h-3 w-3 text-gray-500" />
                                                    </div>
                                                    <span className="text-sm text-gray-500 dark:text-gray-400">Unassigned</span>
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
                                                            <p className="text-sm text-gray-900 dark:text-white truncate">{u.name}</p>
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
                                    <Users className="h-3 w-3" /> Collaborators
                                </label>
                                <div className="flex-1 relative" ref={collabPickerRef}>
                                    <div className="flex items-center gap-1 flex-wrap">
                                        {collaborators.map((c) => (
                                            <div
                                                key={c.user_id}
                                                className="group relative flex items-center gap-1 px-1.5 py-0.5 rounded bg-white dark:bg-black border border-gray-200 dark:border-gray-700 text-xs"
                                                title={`${c.user_name || ''} (${c.user_email || ''})`}
                                            >
                                                <div className="w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center text-white text-[8px] font-medium flex-shrink-0">
                                                    {(c.user_name || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-gray-700 dark:text-gray-300 truncate max-w-[80px]">{c.user_name || c.user_email}</span>
                                                <button
                                                    onClick={() => handleRemoveCollaborator(c.user_id)}
                                                    className="hidden group-hover:block text-gray-500 hover:text-red-400 ml-0.5"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => setShowCollabPicker(!showCollabPicker)}
                                            className="w-6 h-6 rounded-full border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-white hover:border-gray-400 transition-colors"
                                        >
                                            <UserPlus className="h-3 w-3" />
                                        </button>
                                    </div>
                                    {showCollabPicker && (
                                        <div className="absolute left-0 top-full mt-1 z-30 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl w-64 max-h-60 overflow-hidden">
                                            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                                                <input
                                                    value={collabSearch}
                                                    onChange={(e) => setCollabSearch(e.target.value)}
                                                    placeholder="Add collaborator..."
                                                    className="w-full bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="overflow-y-auto max-h-44">
                                                {users
                                                    .filter(u =>
                                                        !collaborators.some(c => c.user_id === u.id) &&
                                                        u.id !== task?.assignee_id &&
                                                        (u.name.toLowerCase().includes(collabSearch.toLowerCase()) ||
                                                            u.email.toLowerCase().includes(collabSearch.toLowerCase()))
                                                    )
                                                    .map((u) => (
                                                        <button
                                                            key={u.id}
                                                            onClick={() => handleAddCollaborator(u.id)}
                                                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 text-left"
                                                        >
                                                            <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-medium">
                                                                {u.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm text-gray-900 dark:text-white truncate">{u.name}</p>
                                                                <p className="text-[10px] text-gray-500 truncate">{u.email}</p>
                                                            </div>
                                                        </button>
                                                    ))}
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
                                        className={`flex-1 bg-white dark:bg-black border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500 ${isOverdue
                                            ? 'text-red-400 border-red-700'
                                            : 'text-gray-900 dark:text-white border-gray-300 dark:border-gray-600'
                                            }`}
                                    />
                                    {isOverdue && (
                                        <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                                            <AlertCircle className="h-3 w-3" /> Overdue
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Start Date */}
                            <div className="flex items-center gap-3">
                                <label className="text-xs text-gray-500 w-24 flex-shrink-0 flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> Start Date
                                </label>
                                <input
                                    type="date"
                                    value={task.start_date || ''}
                                    onChange={(e) => onUpdate(task.id, 'start_date', e.target.value || null)}
                                    className="flex-1 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            {/* Status */}
                            <div className="flex items-center gap-3">
                                <label className="text-xs text-gray-500 w-24 flex-shrink-0">Status</label>
                                <select
                                    value={task.status}
                                    onChange={(e) => onUpdate(task.id, 'status', e.target.value)}
                                    className="flex-1 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
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
                                    className="flex-1 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                                >
                                    {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                                        <option key={key} value={key}>{cfg.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Labels — Asana-style colored pills */}
                            <div className="flex items-start gap-3">
                                <label className="text-xs text-gray-500 w-24 flex-shrink-0 mt-1 flex items-center gap-1">
                                    <Tag className="h-3 w-3" /> Labels
                                </label>
                                <div className="flex-1 relative" ref={labelPickerRef}>
                                    <div className="flex flex-wrap gap-1">
                                        {taskLabels.map((label) => (
                                            <span
                                                key={label.id}
                                                className="group px-2 py-0.5 text-xs rounded-full flex items-center gap-1 border"
                                                style={{ backgroundColor: `${label.color}20`, borderColor: `${label.color}60`, color: label.color }}
                                            >
                                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: label.color }} />
                                                {label.name}
                                                <button
                                                    onClick={() => handleRemoveLabel(label.id)}
                                                    className="hidden group-hover:block hover:text-gray-900 dark:text-white ml-0.5"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                        <button
                                            onClick={() => setShowLabelPicker(!showLabelPicker)}
                                            className="px-2 py-0.5 text-xs rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 hover:text-gray-900 dark:text-white hover:border-gray-400 transition-colors"
                                        >
                                            + Label
                                        </button>
                                    </div>
                                    {showLabelPicker && (
                                        <div className="absolute left-0 top-full mt-1 z-30 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl w-64 max-h-72 overflow-hidden">
                                            <div className="p-2 border-b border-gray-200 dark:border-gray-700 text-[10px] text-gray-500 font-semibold uppercase tracking-wider px-3">
                                                Project Labels
                                            </div>
                                            <div className="overflow-y-auto max-h-36">
                                                {projectLabels.filter(pl => !taskLabels.some(tl => tl.id === pl.id)).map((pl) => (
                                                    <button
                                                        key={pl.id}
                                                        onClick={() => handleAddLabel(pl.id)}
                                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 text-left"
                                                    >
                                                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: pl.color }} />
                                                        <span className="text-sm text-gray-900 dark:text-white">{pl.name}</span>
                                                    </button>
                                                ))}
                                                {projectLabels.filter(pl => !taskLabels.some(tl => tl.id === pl.id)).length === 0 && (
                                                    <p className="px-3 py-2 text-xs text-gray-500">All labels applied</p>
                                                )}
                                            </div>
                                            <div className="border-t border-gray-200 dark:border-gray-700 p-2 space-y-1">
                                                <div className="flex gap-1">
                                                    <input
                                                        value={newLabelName}
                                                        onChange={(e) => setNewLabelName(e.target.value)}
                                                        placeholder="New label..."
                                                        className="flex-1 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                                        onKeyDown={(e) => e.key === 'Enter' && handleCreateLabel()}
                                                    />
                                                    <button onClick={handleCreateLabel} className="px-2 py-1 bg-blue-600 rounded text-xs text-white hover:bg-blue-500">
                                                        <Plus className="h-3 w-3" />
                                                    </button>
                                                </div>
                                                <div className="flex gap-1 flex-wrap">
                                                    {LABEL_COLORS.map((c) => (
                                                        <button
                                                            key={c}
                                                            onClick={() => setNewLabelColor(c)}
                                                            className={`w-4 h-4 rounded-full border-2 ${newLabelColor === c ? 'border-white' : 'border-transparent'}`}
                                                            style={{ backgroundColor: c }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tags — simple text tags */}
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
                                                className="hover:text-gray-900 dark:text-white"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                    <input
                                        placeholder="+ tag"
                                        className="bg-transparent text-xs text-gray-500 dark:text-gray-400 focus:outline-none w-16"
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
                            <div className="bg-gray-100 dark:bg-[#0a0a0a] rounded-lg p-4 space-y-3">
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
                                                    className="flex-1 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
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
                                                    className="flex-1 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
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
                                                    className="flex-1 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
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
                                    className="w-full bg-gray-50 dark:bg-[#0a0a0a] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none min-h-[100px]"
                                    autoFocus
                                />
                            ) : (
                                <div
                                    onClick={() => {
                                        setDescValue(task.description || '');
                                        setEditingDesc(true);
                                    }}
                                    className="bg-gray-50 dark:bg-[#0a0a0a] rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 min-h-[60px] cursor-pointer hover:border-gray-300 dark:border-gray-600 border border-transparent transition-colors"
                                >
                                    {task.description || (
                                        <span className="text-gray-600">Click to add a description...</span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* =============== SUBTASKS (hidden for subtask views) =============== */}
                        {!isSubtaskView && (
                            <div className="bg-gray-100 dark:bg-[#0a0a0a] rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Subtasks
                                        {subtasks.length > 0 && (
                                            <span className="text-[10px] text-gray-600 normal-case font-normal">
                                                ({subtasks.filter(s => s.status === 'done').length}/{subtasks.length})
                                            </span>
                                        )}
                                    </h4>
                                    <button
                                        onClick={() => setShowSubtaskInput(true)}
                                        className="text-xs text-gray-500 hover:text-blue-400 flex items-center gap-0.5 transition-colors"
                                    >
                                        <Plus className="h-3 w-3" /> Add
                                    </button>
                                </div>
                                {subtasks.length > 0 && (
                                    <div className="mb-2 h-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-500 transition-all duration-300"
                                            style={{ width: `${(subtasks.filter(s => s.status === 'done').length / subtasks.length) * 100}%` }}
                                        />
                                    </div>
                                )}
                                <div className="space-y-1">
                                    {subtasks.map((sub) => {
                                        const subAssignee = users.find(u => u.id === sub.assignee_id);
                                        const subStatusCfg = STATUS_CONFIG[sub.status];
                                        const subPriorityCfg = PRIORITY_CONFIG[sub.priority];
                                        return (
                                            <div
                                                key={sub.id}
                                                className="group rounded-lg border border-gray-200 dark:border-gray-700/50 hover:border-gray-300 dark:border-gray-600 bg-white dark:bg-black hover:bg-gray-100 dark:hover:bg-[#232425] transition-all cursor-pointer"
                                                onClick={() => openSubtask(sub)}
                                            >
                                                <div className="flex items-center gap-2 px-3 py-2">
                                                    {/* Status toggle */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleToggleSubtask(sub); }}
                                                        className={`flex-shrink-0 ${sub.status === 'done' ? 'text-green-400' : 'text-gray-600 hover:text-gray-500 dark:text-gray-400'}`}
                                                    >
                                                        {sub.status === 'done' ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                                    </button>
                                                    {/* Title */}
                                                    <span className={`text-sm flex-1 truncate ${sub.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-600 dark:text-gray-200'}`}>
                                                        {sub.title}
                                                    </span>
                                                    {/* Priority badge */}
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${subPriorityCfg.color} border-current/20`}>
                                                        {subPriorityCfg.label}
                                                    </span>
                                                    {/* Assignee avatar */}
                                                    {subAssignee && (
                                                        <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0" title={subAssignee.name}>
                                                            {subAssignee.name.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    {/* Due date */}
                                                    {sub.due_date && (
                                                        <span className={`text-[10px] flex items-center gap-0.5 ${new Date(sub.due_date) < new Date() && sub.status !== 'done' ? 'text-red-400' : 'text-gray-500'}`}>
                                                            <Calendar className="h-3 w-3" />
                                                            {new Date(sub.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                        </span>
                                                    )}
                                                    {/* Delete */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (confirm('Delete subtask?')) {
                                                                fetch(`/api/workstream/tasks/${sub.id}`, { method: 'DELETE' });
                                                                setSubtasks(prev => prev.filter(s => s.id !== sub.id));
                                                            }
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-opacity flex-shrink-0"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {showSubtaskInput && (
                                    <div className="flex gap-1.5 mt-2">
                                        <input
                                            value={newSubtaskTitle}
                                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                            placeholder="Subtask title..."
                                            className="flex-1 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleCreateSubtask();
                                                if (e.key === 'Escape') { setShowSubtaskInput(false); setNewSubtaskTitle(''); }
                                            }}
                                        />
                                        <button onClick={handleCreateSubtask} className="px-2 py-1.5 bg-blue-600 rounded text-sm text-white hover:bg-blue-500">
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                                {subtasks.length === 0 && !showSubtaskInput && (
                                    <p className="text-xs text-gray-600 text-center py-2">No subtasks</p>
                                )}
                            </div>
                        )}

                        {/* =============== DEPENDENCIES =============== */}
                        <div className="bg-gray-100 dark:bg-[#0a0a0a] rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <GitBranch className="h-3 w-3" />
                                    Dependencies
                                </h4>
                                <div className="relative" ref={depPickerRef}>
                                    <button
                                        onClick={() => setShowDepPicker(!showDepPicker)}
                                        className="text-xs text-gray-500 hover:text-blue-400 flex items-center gap-0.5 transition-colors"
                                    >
                                        <Plus className="h-3 w-3" /> Add
                                    </button>
                                    {showDepPicker && (
                                        <div className="absolute right-0 top-full mt-1 z-30 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl w-72 max-h-60 overflow-hidden">
                                            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                                                <input
                                                    value={depSearch}
                                                    onChange={(e) => setDepSearch(e.target.value)}
                                                    placeholder="Search tasks to add as blocker..."
                                                    className="w-full bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="overflow-y-auto max-h-44">
                                                {allTasks
                                                    .filter(t =>
                                                        t.id !== task.id &&
                                                        !dependencies.blockedBy.some(d => d.blocking_task_id === t.id) &&
                                                        (t.title.toLowerCase().includes(depSearch.toLowerCase()) || !depSearch)
                                                    )
                                                    .slice(0, 20)
                                                    .map((t) => (
                                                        <button
                                                            key={t.id}
                                                            onClick={() => handleAddDependency(t.id)}
                                                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 text-left"
                                                        >
                                                            <Circle className="h-3 w-3 text-gray-500 flex-shrink-0" />
                                                            <span className="text-sm text-gray-900 dark:text-white truncate">{t.title}</span>
                                                        </button>
                                                    ))}
                                                {allTasks.filter(t => t.id !== task.id).length === 0 && (
                                                    <p className="px-3 py-2 text-xs text-gray-500">No other tasks</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {dependencies.blockedBy.length > 0 && (
                                <div className="mb-2">
                                    <p className="text-[10px] text-gray-500 uppercase mb-1">Blocked by</p>
                                    {dependencies.blockedBy.map((dep) => {
                                        const bt = allTasks.find(t => t.id === dep.blocking_task_id);
                                        return (
                                            <div key={dep.id} className="group flex items-center gap-2 py-1 px-1 rounded hover:bg-gray-100 dark:hover:bg-[#1e1f21]">
                                                <AlertCircle className="h-3 w-3 text-red-400 flex-shrink-0" />
                                                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{bt?.title || `Task #${dep.blocking_task_id}`}</span>
                                                <button
                                                    onClick={() => handleRemoveDependency(dep.id)}
                                                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-opacity"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {dependencies.blocking.length > 0 && (
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase mb-1">Blocking</p>
                                    {dependencies.blocking.map((dep) => {
                                        const dt = allTasks.find(t => t.id === dep.dependent_task_id);
                                        return (
                                            <div key={dep.id} className="group flex items-center gap-2 py-1 px-1 rounded hover:bg-gray-100 dark:hover:bg-[#1e1f21]">
                                                <ArrowRight className="h-3 w-3 text-orange-400 flex-shrink-0" />
                                                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{dt?.title || `Task #${dep.dependent_task_id}`}</span>
                                                <button
                                                    onClick={() => handleRemoveDependency(dep.id)}
                                                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-opacity"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {dependencies.blockedBy.length === 0 && dependencies.blocking.length === 0 && (
                                <p className="text-xs text-gray-600 text-center py-2">No dependencies</p>
                            )}
                        </div>

                        {/* Tab navigation */}
                        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
                            {[
                                { key: 'comments' as const, label: 'Comments', icon: MessageSquare, count: comments.length },
                                { key: 'attachments' as const, label: 'Attachments', icon: Paperclip, count: taskAttachments.length },
                                { key: 'activity' as const, label: 'Activity', icon: Clock },
                            ].map(({ key, label, icon: Icon, count }) => (
                                <button
                                    key={key}
                                    onClick={() => setActiveTab(key)}
                                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === key
                                        ? 'border-blue-500 text-blue-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-300'
                                        }`}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {label}
                                    {count !== undefined && count > 0 && (
                                        <span className="bg-gray-100 dark:bg-[#0a0a0a] text-gray-700 dark:text-gray-300 text-[10px] px-1.5 rounded-full">{count}</span>
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
                                        const isEditing = editingCommentId === comment.id;
                                        return (
                                            <div key={comment.id} className={`bg-gray-50 dark:bg-[#0a0a0a] rounded-lg p-3 group ${comment.is_deleted ? 'opacity-50' : ''}`}>
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                                                        {commentUser ? (
                                                            <span className="text-[10px] text-gray-900 dark:text-white font-medium">
                                                                {commentUser.name.charAt(0).toUpperCase()}
                                                            </span>
                                                        ) : (
                                                            <User className="h-3 w-3 text-gray-900 dark:text-white" />
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
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
                                                    {comment.edited_at && !comment.is_deleted && (
                                                        <span className="text-[10px] text-gray-600">(edited)</span>
                                                    )}
                                                    {/* Edit/Delete buttons */}
                                                    {!comment.is_deleted && !isEditing && (
                                                        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingCommentId(comment.id);
                                                                    setEditCommentValue(comment.content);
                                                                }}
                                                                className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-blue-400"
                                                                title="Edit"
                                                            >
                                                                <Pencil className="h-3 w-3" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm('Delete this comment?')) handleDeleteComment(comment.id);
                                                                }}
                                                                className="p-1 rounded hover:bg-red-900/20 text-gray-500 hover:text-red-400"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                {isEditing ? (
                                                    <div className="space-y-1.5">
                                                        <textarea
                                                            value={editCommentValue}
                                                            onChange={(e) => setEditCommentValue(e.target.value)}
                                                            className="w-full bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 resize-none min-h-[60px]"
                                                            autoFocus
                                                        />
                                                        <div className="flex gap-1.5 justify-end">
                                                            <button
                                                                onClick={() => { setEditingCommentId(null); setEditCommentValue(''); }}
                                                                className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={() => handleEditComment(comment.id)}
                                                                className="px-2 py-1 text-xs bg-blue-600 rounded text-white hover:bg-blue-500"
                                                            >
                                                                Save
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
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
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* Attachments tab */}
                        {activeTab === 'attachments' && (
                            <div className="space-y-3">
                                {/* Upload area */}
                                <div
                                    className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center hover:border-blue-500 transition-colors cursor-pointer"
                                    onClick={() => taskFileRef.current?.click()}
                                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (e.dataTransfer.files.length > 0) handleUploadTaskFile(e.dataTransfer.files);
                                    }}
                                >
                                    <input
                                        ref={taskFileRef}
                                        type="file"
                                        multiple
                                        accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.svg,.xlsx,.xls,.docx,.csv"
                                        className="hidden"
                                        onChange={(e) => e.target.files && handleUploadTaskFile(e.target.files)}
                                    />
                                    {uploading ? (
                                        <div className="flex items-center justify-center gap-2 text-blue-400">
                                            <div className="h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-sm">Uploading...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <Paperclip className="h-5 w-5 text-gray-500 mx-auto mb-1" />
                                            <p className="text-xs text-gray-500">Drag files here or click to upload</p>
                                            <p className="text-[10px] text-gray-600 mt-0.5">PDF, Images, Excel, Word — max 20MB</p>
                                        </>
                                    )}
                                </div>

                                {/* Attachment list */}
                                {taskAttachments.length === 0 ? (
                                    <div className="text-center py-4 text-gray-600 text-sm">
                                        No attachments yet
                                    </div>
                                ) : (
                                    taskAttachments.map((att) => (
                                        <div key={att.id} className="group flex items-center gap-3 bg-gray-50 dark:bg-[#0a0a0a] rounded-lg p-3 hover:bg-gray-100 dark:hover:bg-[#303132]">
                                            <div className="w-8 h-8 rounded bg-gray-100 dark:bg-[#0a0a0a] flex items-center justify-center flex-shrink-0">
                                                {att.mime_type?.startsWith('image/') ? (
                                                    <ImageIcon className="h-4 w-4 text-blue-400" />
                                                ) : (
                                                    <FileText className="h-4 w-4 text-orange-400" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-gray-900 dark:text-white truncate">{att.file_name}</p>
                                                <p className="text-[10px] text-gray-500">
                                                    {att.size_bytes ? `${(att.size_bytes / 1024).toFixed(0)} KB` : ''} · {new Date(att.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {att.url && (
                                                    <a
                                                        href={att.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-1.5 rounded hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-blue-400"
                                                    >
                                                        <Download className="h-3.5 w-3.5" />
                                                    </a>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteAttachment(att.id)}
                                                    className="p-1.5 rounded hover:bg-red-900/20 text-gray-500 dark:text-gray-400 hover:text-red-400"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Activity tab */}
                        {activeTab === 'activity' && (
                            <div className="space-y-2">
                                {activities.length === 0 ? (
                                    <div className="text-center py-8 text-gray-600 text-sm">
                                        No activity recorded yet
                                    </div>
                                ) : (
                                    activities.map((act) => {
                                        const actUser = users.find(u => u.id === act.user_id);
                                        return (
                                            <div key={act.id} className="flex items-start gap-2 py-1.5 px-1">
                                                <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-[#0a0a0a] flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    {actUser ? (
                                                        <span className="text-[8px] text-gray-900 dark:text-white font-medium">{actUser.name.charAt(0).toUpperCase()}</span>
                                                    ) : (
                                                        <Activity className="h-2.5 w-2.5 text-gray-500" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        <span className="text-gray-700 dark:text-gray-300 font-medium">{actUser?.name || act.user_email || 'System'}</span>
                                                        {' '}{act.action}
                                                        {act.field_name && (
                                                            <span className="text-gray-500"> {act.field_name}</span>
                                                        )}
                                                        {act.old_value && act.new_value && (
                                                            <span className="text-gray-500">
                                                                {' '}from <span className="text-gray-500 dark:text-gray-400">{act.old_value}</span> to <span className="text-gray-700 dark:text-gray-300">{act.new_value}</span>
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-[10px] text-gray-600">
                                                        {new Date(act.created_at).toLocaleDateString('en-US', {
                                                            day: '2-digit',
                                                            month: 'short',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Comment input (always visible) with @mention and attachment */}
                <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 px-4 py-3 relative">
                    {/* @Mention autocomplete dropdown */}
                    {showMentionList && filteredMentionUsers.length > 0 && (
                        <div
                            ref={mentionListRef}
                            className="absolute bottom-full left-4 right-4 mb-1 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-44 overflow-y-auto z-50"
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
                                        <p className="text-sm text-gray-900 dark:text-white truncate">{u.name}</p>
                                        <p className="text-[10px] text-gray-500 truncate">{u.email}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    {/* Pending file preview */}
                    {commentFile && (
                        <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-gray-50 dark:bg-[#0a0a0a] rounded border border-gray-200 dark:border-gray-700 text-xs">
                            <Paperclip className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                            <span className="text-gray-700 dark:text-gray-300 truncate flex-1">{commentFile.name}</span>
                            <button onClick={() => setCommentFile(null)} className="text-gray-500 hover:text-red-400">
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <textarea
                                ref={commentInputRef}
                                value={newComment}
                                onChange={handleCommentChange}
                                onKeyDown={handleCommentKeyDown}
                                placeholder="Add a comment... (use @ to mention)"
                                rows={1}
                                className="w-full bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 pr-9 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                            />
                            <button
                                onClick={() => commentFileRef.current?.click()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10 text-gray-500 hover:text-gray-700 dark:text-gray-300 transition-colors"
                                title="Attach file"
                            >
                                <Paperclip className="h-3.5 w-3.5" />
                            </button>
                            <input
                                ref={commentFileRef}
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.svg"
                                className="hidden"
                                onChange={(e) => { if (e.target.files?.[0]) setCommentFile(e.target.files[0]); e.target.value = ''; }}
                            />
                        </div>
                        <button
                            onClick={handleAddComment}
                            disabled={!newComment.trim() && !commentFile}
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
