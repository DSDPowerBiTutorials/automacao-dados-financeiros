'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import {
    CheckCircle2,
    Circle,
    Clock,
    AlertTriangle,
    Calendar,
    Filter,
    ChevronDown,
    ChevronRight,
} from 'lucide-react';
import type { WSTask, TaskStatus } from '@/lib/workstream-types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/workstream-types';
import { format, isPast, isToday, isTomorrow, isThisWeek, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type FilterTab = 'upcoming' | 'overdue' | 'completed';

interface TaskWithProject extends WSTask {
    ws_projects?: { id: string; name: string; color: string };
}

export default function MyTasksPage() {
    const { profile } = useAuth();
    const [tasks, setTasks] = useState<TaskWithProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<FilterTab>('upcoming');
    const [systemUserId, setSystemUserId] = useState<string | null>(null);
    const [sectionsExpanded, setSectionsExpanded] = useState<Record<string, boolean>>({
        overdue: true,
        today: true,
        tomorrow: true,
        thisWeek: true,
        later: true,
        noDueDate: true,
    });

    // Resolve system_users ID
    useEffect(() => {
        if (!profile?.name) return;
        (async () => {
            const firstName = profile.name.split(' ')[0];
            const { data } = await supabase
                .from('system_users')
                .select('id, name')
                .eq('is_active', true);
            const match = (data || []).find(u =>
                u.name.toLowerCase() === firstName.toLowerCase() ||
                u.name.toLowerCase().startsWith(firstName.toLowerCase())
            );
            setSystemUserId(match?.id || null);
        })();
    }, [profile?.name]);

    // Fetch tasks
    useEffect(() => {
        const userId = systemUserId || profile?.id;
        if (!userId) return;

        async function fetchTasks() {
            setLoading(true);
            try {
                const res = await fetch(`/api/workstream/my-tasks?user_id=${userId}&filter=${activeTab === 'upcoming' ? 'incomplete' : activeTab}`);
                const json = await res.json();
                if (json.success) {
                    setTasks(json.data || []);
                }
            } catch (err) {
                console.error('Failed to fetch tasks:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchTasks();
    }, [systemUserId, profile?.id, activeTab]);

    // Group tasks by date sections
    const groupedTasks = useMemo(() => {
        const overdue: TaskWithProject[] = [];
        const today: TaskWithProject[] = [];
        const tomorrow: TaskWithProject[] = [];
        const thisWeek: TaskWithProject[] = [];
        const later: TaskWithProject[] = [];
        const noDueDate: TaskWithProject[] = [];

        tasks.forEach((task) => {
            if (!task.due_date) {
                noDueDate.push(task);
                return;
            }
            const dueDate = new Date(task.due_date);
            if (task.status === 'done') {
                // Completed tasks go to a flat list
                later.push(task);
            } else if (isPast(dueDate) && !isToday(dueDate)) {
                overdue.push(task);
            } else if (isToday(dueDate)) {
                today.push(task);
            } else if (isTomorrow(dueDate)) {
                tomorrow.push(task);
            } else if (isThisWeek(dueDate)) {
                thisWeek.push(task);
            } else {
                later.push(task);
            }
        });

        return { overdue, today, tomorrow, thisWeek, later, noDueDate };
    }, [tasks]);

    const tabs: { key: FilterTab; label: string; count: number }[] = [
        { key: 'upcoming', label: 'Upcoming', count: tasks.length },
        { key: 'overdue', label: 'Overdue', count: groupedTasks.overdue.length },
        { key: 'completed', label: 'Completed', count: 0 },
    ];

    async function toggleTaskStatus(taskId: number, currentStatus: TaskStatus) {
        const newStatus = currentStatus === 'done' ? 'todo' : 'done';
        try {
            await fetch(`/api/workstream/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: newStatus,
                    completed_at: newStatus === 'done' ? new Date().toISOString() : null,
                }),
            });
            setTasks(prev =>
                prev.map(t => t.id === taskId ? { ...t, status: newStatus as TaskStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null } : t)
            );
        } catch (err) {
            console.error('Failed to toggle task:', err);
        }
    }

    function toggleSection(key: string) {
        setSectionsExpanded(prev => ({ ...prev, [key]: !prev[key] }));
    }

    function TaskRow({ task }: { task: TaskWithProject }) {
        const isDone = task.status === 'done';
        const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && !isDone;
        const priorityConfig = PRIORITY_CONFIG[task.priority];

        return (
            <div className="group flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 border-b border-gray-200 dark:border-gray-800/50 transition-colors">
                {/* Checkbox */}
                <button
                    onClick={() => toggleTaskStatus(task.id, task.status)}
                    className="flex-shrink-0 transition-colors"
                >
                    {isDone ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                        <Circle className="h-5 w-5 text-gray-600 hover:text-gray-500 dark:text-gray-400" />
                    )}
                </button>

                {/* Task info */}
                <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${isDone ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                        {task.title}
                    </p>
                    {task.ws_projects && (
                        <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                            <span
                                className="w-2 h-2 rounded-sm inline-block"
                                style={{ backgroundColor: task.ws_projects.color || '#3b82f6' }}
                            />
                            {task.ws_projects.name}
                        </p>
                    )}
                </div>

                {/* Priority */}
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityConfig.bg} ${priorityConfig.color} border ${priorityConfig.border}`}>
                    {priorityConfig.label}
                </span>

                {/* Due date */}
                {task.due_date && (
                    <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-400' : isDone ? 'text-gray-600' : 'text-gray-500 dark:text-gray-400'}`}>
                        {isOverdue && <AlertTriangle className="h-3 w-3" />}
                        <Calendar className="h-3 w-3" />
                        {format(new Date(task.due_date), 'dd MMM', { locale: ptBR })}
                    </span>
                )}
            </div>
        );
    }

    function SectionGroup({ title, tasks, sectionKey, icon: Icon, iconColor }: {
        title: string;
        tasks: TaskWithProject[];
        sectionKey: string;
        icon: React.ElementType;
        iconColor: string;
    }) {
        if (tasks.length === 0) return null;
        const expanded = sectionsExpanded[sectionKey] !== false;

        return (
            <div className="mb-2">
                <button
                    onClick={() => toggleSection(sectionKey)}
                    className="flex items-center gap-2 px-4 py-2 w-full text-left hover:bg-white/5 transition-colors"
                >
                    {expanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-500" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-500" />}
                    <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
                    <span className="text-xs text-gray-600 ml-1">{tasks.length}</span>
                </button>
                {expanded && (
                    <div>
                        {tasks.map(task => (
                            <TaskRow key={task.id} task={task} />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    const firstName = profile?.name?.split(' ')[0] || 'User';

    return (
        <div className="h-full overflow-y-auto bg-white dark:bg-black">
            <div className="max-w-4xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Tasks</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                        Tasks assigned to {firstName} across all projects
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-800 mb-6">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key
                                ? 'text-gray-900 dark:text-white border-blue-500'
                                : 'text-gray-500 border-transparent hover:text-gray-700 dark:text-gray-300'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin h-8 w-8 border-3 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full" />
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <CheckCircle2 className="h-12 w-12 text-gray-700 mb-4" />
                        <h2 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-1">
                            {activeTab === 'completed' ? 'No completed tasks' : 'No tasks assigned'}
                        </h2>
                        <p className="text-sm text-gray-600">
                            {activeTab === 'completed'
                                ? 'Completed tasks will appear here'
                                : 'Tasks assigned to you will appear here'
                            }
                        </p>
                    </div>
                ) : (
                    <div className="bg-gray-50 dark:bg-[#0a0a0a] rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                        {activeTab === 'completed' ? (
                            tasks.map(task => <TaskRow key={task.id} task={task} />)
                        ) : (
                            <>
                                <SectionGroup
                                    title="Overdue"
                                    tasks={groupedTasks.overdue}
                                    sectionKey="overdue"
                                    icon={AlertTriangle}
                                    iconColor="text-red-400"
                                />
                                <SectionGroup
                                    title="Today"
                                    tasks={groupedTasks.today}
                                    sectionKey="today"
                                    icon={Clock}
                                    iconColor="text-blue-400"
                                />
                                <SectionGroup
                                    title="Tomorrow"
                                    tasks={groupedTasks.tomorrow}
                                    sectionKey="tomorrow"
                                    icon={Calendar}
                                    iconColor="text-purple-400"
                                />
                                <SectionGroup
                                    title="This Week"
                                    tasks={groupedTasks.thisWeek}
                                    sectionKey="thisWeek"
                                    icon={Calendar}
                                    iconColor="text-green-400"
                                />
                                <SectionGroup
                                    title="Later"
                                    tasks={groupedTasks.later}
                                    sectionKey="later"
                                    icon={Calendar}
                                    iconColor="text-gray-500 dark:text-gray-400"
                                />
                                <SectionGroup
                                    title="No due date"
                                    tasks={groupedTasks.noDueDate}
                                    sectionKey="noDueDate"
                                    icon={Circle}
                                    iconColor="text-gray-500"
                                />
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
