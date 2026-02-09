'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import {
    LayoutGrid,
    List,
    Plus,
    Filter,
    Search,
    Settings,
    Loader2,
    UserPlus,
    X,
} from 'lucide-react';
import { BoardView } from '@/components/workstream/BoardView';
import { ListView } from '@/components/workstream/ListView';
import { TaskDetailPanel } from '@/components/workstream/TaskDetailPanel';
import type {
    WSProject,
    WSSection,
    WSTask,
    WSCustomField,
    WSUser,
    WSProjectMember,
    ViewMode,
    TaskStatus,
} from '@/lib/workstream-types';

export default function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = use(params);
    const router = useRouter();

    const [project, setProject] = useState<WSProject | null>(null);
    const [sections, setSections] = useState<WSSection[]>([]);
    const [tasks, setTasks] = useState<WSTask[]>([]);
    const [customFields, setCustomFields] = useState<WSCustomField[]>([]);
    const [users, setUsers] = useState<WSUser[]>([]);
    const [members, setMembers] = useState<WSProjectMember[]>([]);
    const [showMemberPicker, setShowMemberPicker] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('board');
    const [selectedTask, setSelectedTask] = useState<WSTask | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterPriority, setFilterPriority] = useState<string>('all');

    // Fetch project data
    useEffect(() => {
        fetchData();
    }, [projectId]);

    async function fetchData() {
        setLoading(true);
        try {
            const [projRes, secRes, taskRes, cfRes, usersRes, membersRes] = await Promise.all([
                fetch(`/api/workstream/projects/${projectId}`),
                fetch(`/api/workstream/sections?project_id=${projectId}`),
                fetch(`/api/workstream/tasks?project_id=${projectId}`),
                fetch(`/api/workstream/custom-fields?project_id=${projectId}`),
                fetch('/api/workstream/users'),
                fetch(`/api/workstream/projects/${projectId}/members`),
            ]);

            const [projJson, secJson, taskJson, cfJson, usersJson, membersJson] = await Promise.all([
                projRes.json(),
                secRes.json(),
                taskRes.json(),
                cfRes.json(),
                usersRes.json(),
                membersRes.json(),
            ]);

            if (projJson.success) setProject(projJson.data);
            if (secJson.success) setSections(secJson.data || []);
            if (taskJson.success) setTasks(taskJson.data || []);
            if (cfJson.success) setCustomFields(cfJson.data || []);
            if (usersJson.success) setUsers(usersJson.data || []);
            if (membersJson.success) setMembers(membersJson.data || []);
        } catch (err) {
            console.error('Failed to fetch project data:', err);
        } finally {
            setLoading(false);
        }
    }

    // Filtered tasks
    const filteredTasks = tasks.filter((t) => {
        if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (filterStatus !== 'all' && t.status !== filterStatus) return false;
        if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
        return true;
    });

    // ============================================================
    // CRUD Operations
    // ============================================================

    const addTask = useCallback(async (sectionId: number, title: string) => {
        try {
            const res = await fetch('/api/workstream/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, section_id: sectionId, project_id: projectId }),
            });
            const json = await res.json();
            if (json.success) {
                setTasks((prev) => [...prev, json.data]);
                // Update section task_order
                const section = sections.find((s) => s.id === sectionId);
                if (section) {
                    const newOrder = [...(section.task_order || []), json.data.id];
                    await fetch(`/api/workstream/sections/${sectionId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ task_order: newOrder }),
                    });
                    setSections((prev) =>
                        prev.map((s) => (s.id === sectionId ? { ...s, task_order: newOrder } : s))
                    );
                }
            }
        } catch (err) {
            console.error('Failed to create task:', err);
        }
    }, [projectId, sections]);

    const updateTaskField = useCallback(async (taskId: number, field: string, value: unknown) => {
        try {
            // Optimistic update
            setTasks((prev) =>
                prev.map((t) => (t.id === taskId ? { ...t, [field]: value } : t))
            );

            // Also update selected task if open
            setSelectedTask((prev) =>
                prev && prev.id === taskId ? { ...prev, [field]: value } : prev
            );

            await fetch(`/api/workstream/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: value }),
            });
        } catch (err) {
            console.error('Failed to update task:', err);
            fetchData(); // Rollback
        }
    }, []);

    const deleteTask = useCallback(async (taskId: number) => {
        try {
            await fetch(`/api/workstream/tasks/${taskId}`, { method: 'DELETE' });
            setTasks((prev) => prev.filter((t) => t.id !== taskId));
            // Update section task_order
            const task = tasks.find((t) => t.id === taskId);
            if (task) {
                const section = sections.find((s) => s.id === task.section_id);
                if (section) {
                    const newOrder = (section.task_order || []).filter((id) => id !== taskId);
                    await fetch(`/api/workstream/sections/${section.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ task_order: newOrder }),
                    });
                    setSections((prev) =>
                        prev.map((s) => (s.id === section.id ? { ...s, task_order: newOrder } : s))
                    );
                }
            }
        } catch (err) {
            console.error('Failed to delete task:', err);
        }
    }, [tasks, sections]);

    const moveTask = useCallback(async (taskId: number, fromSectionId: number, toSectionId: number, newIndex: number) => {
        const task = tasks.find((t) => t.id === taskId);
        if (!task) return;

        // Optimistic: update task section_id
        setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, section_id: toSectionId } : t))
        );

        try {
            // Update task section
            if (fromSectionId !== toSectionId) {
                await fetch(`/api/workstream/tasks/${taskId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ section_id: toSectionId }),
                });
            }

            // Update from section task_order
            const fromSection = sections.find((s) => s.id === fromSectionId);
            if (fromSection) {
                const fromOrder = (fromSection.task_order || []).filter((id) => id !== taskId);
                await fetch(`/api/workstream/sections/${fromSectionId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ task_order: fromOrder }),
                });
                setSections((prev) =>
                    prev.map((s) => (s.id === fromSectionId ? { ...s, task_order: fromOrder } : s))
                );
            }

            // Update to section task_order
            const toSection = sections.find((s) => s.id === toSectionId);
            if (toSection) {
                const toOrder = (toSection.task_order || []).filter((id) => id !== taskId);
                toOrder.splice(newIndex, 0, taskId);
                await fetch(`/api/workstream/sections/${toSectionId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ task_order: toOrder }),
                });
                setSections((prev) =>
                    prev.map((s) => (s.id === toSectionId ? { ...s, task_order: toOrder } : s))
                );
            }
        } catch (err) {
            console.error('Failed to move task:', err);
            fetchData(); // Rollback
        }
    }, [tasks, sections]);

    const reorderSections = useCallback(async (newOrder: number[]) => {
        if (!project) return;
        try {
            setProject((prev) => (prev ? { ...prev, section_order: newOrder } : prev));
            await fetch(`/api/workstream/projects/${project.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ section_order: newOrder }),
            });
        } catch (err) {
            console.error('Failed to reorder sections:', err);
        }
    }, [project]);

    const addSection = useCallback(async (title: string) => {
        if (!project) return;
        try {
            const res = await fetch('/api/workstream/sections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_id: projectId, title, position: sections.length }),
            });
            const json = await res.json();
            if (json.success) {
                setSections((prev) => [...prev, json.data]);
                const newOrder = [...(project.section_order || []), json.data.id];
                setProject((prev) => (prev ? { ...prev, section_order: newOrder } : prev));
                await fetch(`/api/workstream/projects/${project.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ section_order: newOrder }),
                });
            }
        } catch (err) {
            console.error('Failed to add section:', err);
        }
    }, [project, projectId, sections.length]);

    const deleteSection = useCallback(async (sectionId: number) => {
        if (!confirm('Are you sure? All tasks in this section will be deleted.')) return;
        try {
            await fetch(`/api/workstream/sections/${sectionId}`, { method: 'DELETE' });
            setSections((prev) => prev.filter((s) => s.id !== sectionId));
            setTasks((prev) => prev.filter((t) => t.section_id !== sectionId));
            if (project) {
                const newOrder = (project.section_order || []).filter((id) => id !== sectionId);
                setProject((prev) => (prev ? { ...prev, section_order: newOrder } : prev));
                await fetch(`/api/workstream/projects/${project.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ section_order: newOrder }),
                });
            }
        } catch (err) {
            console.error('Failed to delete section:', err);
        }
    }, [project]);

    const renameSection = useCallback(async (sectionId: number, title: string) => {
        try {
            setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, title } : s)));
            await fetch(`/api/workstream/sections/${sectionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title }),
            });
        } catch (err) {
            console.error('Failed to rename section:', err);
        }
    }, []);

    const toggleTaskStatus = useCallback(async (taskId: number, currentStatus: TaskStatus) => {
        const newStatus: TaskStatus = currentStatus === 'done' ? 'todo' : 'done';
        updateTaskField(taskId, 'status', newStatus);
        if (newStatus === 'done') {
            updateTaskField(taskId, 'completed_at', new Date().toISOString());
        } else {
            updateTaskField(taskId, 'completed_at', null);
        }
    }, [updateTaskField]);

    // Member management
    const addMember = useCallback(async (userId: string) => {
        try {
            const res = await fetch(`/api/workstream/projects/${projectId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, role: 'member' }),
            });
            const json = await res.json();
            if (json.success) {
                // Re-fetch members to get enriched data
                const membersRes = await fetch(`/api/workstream/projects/${projectId}/members`);
                const membersJson = await membersRes.json();
                if (membersJson.success) setMembers(membersJson.data || []);
            }
        } catch (err) {
            console.error('Failed to add member:', err);
        }
    }, [projectId]);

    const removeMember = useCallback(async (userId: string) => {
        try {
            await fetch(`/api/workstream/projects/${projectId}/members?user_id=${userId}`, {
                method: 'DELETE',
            });
            setMembers((prev) => prev.filter((m) => m.user_id !== userId));
        } catch (err) {
            console.error('Failed to remove member:', err);
        }
    }, [projectId]);

    // Users not yet members
    const nonMemberUsers = users.filter(
        (u) => !members.some((m) => m.user_id === u.id)
    );

    // ============================================================
    // Render
    // ============================================================

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-[#1e1f21]">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="h-full flex items-center justify-center bg-[#1e1f21]">
                <div className="text-center">
                    <p className="text-gray-400 mb-4">Project not found</p>
                    <button
                        onClick={() => router.push('/workstream')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.status === 'done').length;

    return (
        <div className="h-full flex flex-col bg-[#1e1f21]">
            {/* Project Header */}
            <div className="flex-shrink-0 border-b border-gray-700 px-6 py-3">
                <div className="flex items-center justify-between">
                    {/* Left: Project info */}
                    <div className="flex items-center gap-3">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: project.color + '20', color: project.color }}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-white">{project.name}</h1>
                            {totalTasks > 0 && (
                                <p className="text-xs text-gray-500">
                                    {doneTasks}/{totalTasks} tasks completed
                                </p>
                            )}
                        </div>

                        {/* Member avatars */}
                        <div className="flex items-center ml-4">
                            <div className="flex -space-x-2">
                                {members.slice(0, 5).map((m) => (
                                    <div
                                        key={m.user_id}
                                        title={m.user_name || m.user_email || ''}
                                        className="w-7 h-7 rounded-full bg-blue-600 border-2 border-[#1e1f21] flex items-center justify-center text-white text-[10px] font-medium cursor-default"
                                    >
                                        {(m.user_name || m.user_email || '?').charAt(0).toUpperCase()}
                                    </div>
                                ))}
                                {members.length > 5 && (
                                    <div className="w-7 h-7 rounded-full bg-gray-700 border-2 border-[#1e1f21] flex items-center justify-center text-gray-300 text-[10px] font-medium">
                                        +{members.length - 5}
                                    </div>
                                )}
                            </div>
                            {/* Add member button */}
                            <div className="relative ml-1">
                                <button
                                    onClick={() => setShowMemberPicker(!showMemberPicker)}
                                    className="w-7 h-7 rounded-full bg-[#2a2b2d] border border-dashed border-gray-600 hover:border-gray-400 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors"
                                    title="Add member"
                                >
                                    <UserPlus className="h-3 w-3" />
                                </button>
                                {showMemberPicker && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowMemberPicker(false)} />
                                        <div className="absolute left-0 top-full mt-2 z-20 bg-[#2a2b2d] border border-gray-700 rounded-lg shadow-xl w-72 max-h-80 overflow-hidden">
                                            <div className="p-2 border-b border-gray-700">
                                                <input
                                                    value={memberSearch}
                                                    onChange={(e) => setMemberSearch(e.target.value)}
                                                    placeholder="Search people..."
                                                    className="w-full bg-[#1e1f21] border border-gray-600 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                                    autoFocus
                                                />
                                            </div>
                                            {/* Current members */}
                                            {members.length > 0 && (
                                                <div className="border-b border-gray-700">
                                                    <p className="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider">Members</p>
                                                    {members
                                                        .filter(m => !memberSearch || (m.user_name || '').toLowerCase().includes(memberSearch.toLowerCase()))
                                                        .map((m) => (
                                                            <div key={m.user_id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5">
                                                                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-medium">
                                                                    {(m.user_name || '?').charAt(0).toUpperCase()}
                                                                </div>
                                                                <span className="text-sm text-white flex-1 truncate">{m.user_name || m.user_email}</span>
                                                                <button
                                                                    onClick={() => removeMember(m.user_id)}
                                                                    className="p-0.5 rounded hover:bg-red-900/20 text-gray-500 hover:text-red-400"
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                </div>
                                            )}
                                            {/* Available users */}
                                            <div className="overflow-y-auto max-h-44">
                                                <p className="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider">Add people</p>
                                                {nonMemberUsers
                                                    .filter(u => !memberSearch || u.name.toLowerCase().includes(memberSearch.toLowerCase()) || u.email.toLowerCase().includes(memberSearch.toLowerCase()))
                                                    .map((u) => (
                                                        <button
                                                            key={u.id}
                                                            onClick={() => {
                                                                addMember(u.id);
                                                                setMemberSearch('');
                                                            }}
                                                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 text-left"
                                                        >
                                                            <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-gray-300 text-[10px] font-medium">
                                                                {u.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm text-gray-300 truncate">{u.name}</p>
                                                                <p className="text-[10px] text-gray-500 truncate">{u.email}</p>
                                                            </div>
                                                            <Plus className="h-3 w-3 text-gray-500" />
                                                        </button>
                                                    ))}
                                                {nonMemberUsers.filter(u => !memberSearch || u.name.toLowerCase().includes(memberSearch.toLowerCase())).length === 0 && (
                                                    <p className="px-3 py-2 text-xs text-gray-500">No users available</p>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: View toggle + actions */}
                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="relative hidden md:block">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Filter tasks..."
                                className="bg-[#2a2b2d] border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-48"
                            />
                        </div>

                        {/* Status filter */}
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="bg-[#2a2b2d] border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                        >
                            <option value="all">All Status</option>
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="review">Review</option>
                            <option value="done">Done</option>
                            <option value="blocked">Blocked</option>
                        </select>

                        {/* View toggle */}
                        <div className="flex bg-[#2a2b2d] rounded-lg border border-gray-700 p-0.5">
                            <button
                                onClick={() => setViewMode('board')}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'board'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                <LayoutGrid className="h-3.5 w-3.5" />
                                Board
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'list'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                <List className="h-3.5 w-3.5" />
                                List
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
                {viewMode === 'board' ? (
                    <BoardView
                        sections={sections}
                        tasks={filteredTasks}
                        sectionOrder={project.section_order || []}
                        onTaskClick={setSelectedTask}
                        onAddTask={addTask}
                        onMoveTask={moveTask}
                        onReorderSections={reorderSections}
                        onDeleteSection={deleteSection}
                        onRenameSection={renameSection}
                        onAddSection={addSection}
                        users={users}
                    />
                ) : (
                    <ListView
                        sections={sections}
                        tasks={filteredTasks}
                        sectionOrder={project.section_order || []}
                        onTaskClick={setSelectedTask}
                        onAddTask={addTask}
                        onToggleTaskStatus={toggleTaskStatus}
                        onUpdateTaskField={updateTaskField}
                        users={users}
                    />
                )}
            </div>

            {/* Task Detail Panel */}
            {selectedTask && (
                <TaskDetailPanel
                    task={selectedTask}
                    customFields={customFields}
                    projectId={projectId}
                    users={users}
                    onClose={() => setSelectedTask(null)}
                    onUpdate={updateTaskField}
                    onDelete={deleteTask}
                />
            )}
        </div>
    );
}
