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
} from 'lucide-react';
import { BoardView } from '@/components/workstream/BoardView';
import { ListView } from '@/components/workstream/ListView';
import { TaskDetailPanel } from '@/components/workstream/TaskDetailPanel';
import type {
    WSProject,
    WSSection,
    WSTask,
    WSCustomField,
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
            const [projRes, secRes, taskRes, cfRes] = await Promise.all([
                fetch(`/api/workstream/projects/${projectId}`),
                fetch(`/api/workstream/sections?project_id=${projectId}`),
                fetch(`/api/workstream/tasks?project_id=${projectId}`),
                fetch(`/api/workstream/custom-fields?project_id=${projectId}`),
            ]);

            const [projJson, secJson, taskJson, cfJson] = await Promise.all([
                projRes.json(),
                secRes.json(),
                taskRes.json(),
                cfRes.json(),
            ]);

            if (projJson.success) setProject(projJson.data);
            if (secJson.success) setSections(secJson.data || []);
            if (taskJson.success) setTasks(taskJson.data || []);
            if (cfJson.success) setCustomFields(cfJson.data || []);
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
        if (!confirm('Tem certeza? Todas as tarefas desta seção serão excluídas.')) return;
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
                    <p className="text-gray-400 mb-4">Projeto não encontrado</p>
                    <button
                        onClick={() => router.push('/workstream')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
                    >
                        Voltar ao Início
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
                                    {doneTasks}/{totalTasks} tarefas concluídas
                                </p>
                            )}
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
                                placeholder="Filtrar tarefas..."
                                className="bg-[#2a2b2d] border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-48"
                            />
                        </div>

                        {/* Status filter */}
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="bg-[#2a2b2d] border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                        >
                            <option value="all">Todos Status</option>
                            <option value="todo">A Fazer</option>
                            <option value="in_progress">Em Progresso</option>
                            <option value="review">Revisão</option>
                            <option value="done">Concluído</option>
                            <option value="blocked">Bloqueado</option>
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
                                Lista
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
                    />
                )}
            </div>

            {/* Task Detail Panel */}
            {selectedTask && (
                <TaskDetailPanel
                    task={selectedTask}
                    customFields={customFields}
                    onClose={() => setSelectedTask(null)}
                    onUpdate={updateTaskField}
                    onDelete={deleteTask}
                />
            )}
        </div>
    );
}
