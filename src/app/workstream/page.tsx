'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Plus,
    FolderKanban,
    Clock,
    ArrowRight,
    CheckCircle2,
    Circle,
    AlertTriangle,
    Calendar,
    Users,
    ChevronRight,
    Sparkles,
    UserPlus,
    Grip,
} from 'lucide-react';
import type { WSProject, WSTask, TaskStatus } from '@/lib/workstream-types';
import { PROJECT_TYPE_CONFIG, PRIORITY_CONFIG } from '@/lib/workstream-types';
import { CreateProjectDialog } from '@/components/workstream/CreateProjectDialog';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { UserAvatar } from '@/components/user-avatar';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TaskWithProject extends WSTask {
    ws_projects?: { id: string; name: string; color: string };
}

interface WSUser {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
    role: string;
}

export default function WorkstreamHomePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { profile } = useAuth();
    const [projects, setProjects] = useState<WSProject[]>([]);
    const [myTasks, setMyTasks] = useState<TaskWithProject[]>([]);
    const [users, setUsers] = useState<WSUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [systemUserId, setSystemUserId] = useState<string | null>(null);
    const [activeTaskTab, setActiveTaskTab] = useState<'upcoming' | 'overdue' | 'completed'>('upcoming');

    useEffect(() => {
        if (searchParams.get('new') === 'true') {
            setShowCreateDialog(true);
        }
    }, [searchParams]);

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

    // Fetch all data
    useEffect(() => {
        async function fetchAll() {
            try {
                const [projectsRes, usersRes] = await Promise.all([
                    fetch('/api/workstream/projects'),
                    fetch('/api/workstream/users'),
                ]);
                const projectsJson = await projectsRes.json();
                const usersJson = await usersRes.json();

                if (projectsJson.success) setProjects(projectsJson.data || []);
                if (usersJson.success) setUsers(usersJson.data || []);
            } catch (err) {
                console.error('Failed to fetch data:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchAll();
    }, []);

    // Fetch my tasks
    useEffect(() => {
        const userId = systemUserId || profile?.id;
        if (!userId) return;
        (async () => {
            try {
                const res = await fetch(`/api/workstream/my-tasks?user_id=${userId}&filter=incomplete`);
                const json = await res.json();
                if (json.success) setMyTasks(json.data || []);
            } catch (err) {
                console.error('Failed to fetch my tasks:', err);
            }
        })();
    }, [systemUserId, profile?.id]);

    function handleProjectCreated(project: WSProject) {
        setProjects((prev) => [project, ...prev]);
        setShowCreateDialog(false);
        router.push(`/workstream/${project.id}`);
    }

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
            setMyTasks(prev =>
                prev.map(t => t.id === taskId
                    ? { ...t, status: newStatus as TaskStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null }
                    : t
                )
            );
        } catch (err) {
            console.error('Failed to toggle task:', err);
        }
    }

    // Filtered tasks based on tab
    const filteredTasks = useMemo(() => {
        const now = new Date().toISOString().split('T')[0];
        switch (activeTaskTab) {
            case 'overdue':
                return myTasks.filter(t => t.status !== 'done' && t.due_date && t.due_date < now);
            case 'completed':
                return myTasks.filter(t => t.status === 'done');
            default:
                return myTasks.filter(t => t.status !== 'done');
        }
    }, [myTasks, activeTaskTab]);

    const overdueTasks = myTasks.filter(t => t.status !== 'done' && t.due_date && t.due_date < new Date().toISOString().split('T')[0]);

    const firstName = profile?.name?.split(' ')[0] || 'User';
    const greeting = getGreeting();

    function getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    }

    const dayOfWeek = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-white dark:bg-[#1e1f21]">
                <div className="animate-spin h-8 w-8 border-3 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full" />
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto bg-white dark:bg-[#1e1f21]">
            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Header greeting */}
                <div className="mb-8">
                    <p className="text-sm text-gray-500 capitalize">{dayOfWeek}</p>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        {greeting}, {firstName}!
                    </h1>
                </div>

                {/* Main grid — 2 columns like Asana */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* LEFT COLUMN: My Tasks */}
                    <div className="bg-gray-50 dark:bg-[#2a2b2d] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">My Tasks</h2>
                            <div className="text-[10px] text-gray-600">
                                {overdueTasks.length > 0 && (
                                    <span className="text-red-400 mr-2">{overdueTasks.length} overdue</span>
                                )}
                            </div>
                        </div>

                        {/* Task tabs */}
                        <div className="flex border-b border-gray-200 dark:border-gray-800">
                            {(['upcoming', 'overdue', 'completed'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTaskTab(tab)}
                                    className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTaskTab === tab
                                        ? 'text-gray-900 dark:text-white border-blue-500'
                                        : 'text-gray-500 border-transparent hover:text-gray-700 dark:text-gray-300'
                                        }`}
                                >
                                    {tab === 'upcoming' ? 'Upcoming' : tab === 'overdue' ? `Overdue (${overdueTasks.length})` : 'Completed'}
                                </button>
                            ))}
                        </div>

                        {/* Task list */}
                        <div className="max-h-[400px] overflow-y-auto">
                            {filteredTasks.length === 0 ? (
                                <div className="px-5 py-10 text-center text-gray-600 text-sm">
                                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-gray-700" />
                                    {activeTaskTab === 'completed' ? 'No completed tasks' : 'No tasks to show'}
                                </div>
                            ) : (
                                filteredTasks.slice(0, 10).map((task) => {
                                    const isDone = task.status === 'done';
                                    const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && !isDone;
                                    return (
                                        <div
                                            key={task.id}
                                            className="group flex items-center gap-3 px-5 py-2.5 border-b border-gray-200 dark:border-gray-800/50 hover:bg-white/5 transition-colors"
                                        >
                                            <button
                                                onClick={() => toggleTaskStatus(task.id, task.status)}
                                                className="flex-shrink-0"
                                            >
                                                {isDone ? (
                                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                ) : (
                                                    <Circle className="h-4 w-4 text-gray-600 hover:text-gray-500 dark:text-gray-400" />
                                                )}
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm truncate ${isDone ? 'text-gray-500 line-through' : 'text-gray-600 dark:text-gray-200'}`}>
                                                    {task.title}
                                                </p>
                                            </div>
                                            {task.ws_projects && (
                                                <span
                                                    className="w-2 h-2 rounded-sm flex-shrink-0"
                                                    style={{ backgroundColor: task.ws_projects.color || '#3b82f6' }}
                                                    title={task.ws_projects.name}
                                                />
                                            )}
                                            {task.due_date && (
                                                <span className={`text-[10px] ${isOverdue ? 'text-red-400' : 'text-gray-500'}`}>
                                                    {format(new Date(task.due_date), 'dd MMM', { locale: ptBR })}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer link */}
                        {myTasks.length > 10 && (
                            <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-800">
                                <button
                                    onClick={() => router.push('/workstream/my-tasks')}
                                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                                >
                                    View all tasks
                                    <ArrowRight className="h-3 w-3" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Projects */}
                    <div className="bg-gray-50 dark:bg-[#2a2b2d] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Projects</h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => router.push('/workstream/portfolios')}
                                    className="text-[10px] text-gray-500 hover:text-gray-700 dark:text-gray-300 transition-colors"
                                >
                                    View all
                                </button>
                            </div>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto">
                            {projects.length === 0 ? (
                                <div className="px-5 py-10 text-center">
                                    <FolderKanban className="h-8 w-8 mx-auto mb-2 text-gray-700" />
                                    <p className="text-sm text-gray-600">No projects yet</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 p-4">
                                    {projects.slice(0, 6).map((project) => (
                                        <button
                                            key={project.id}
                                            onClick={() => router.push(`/workstream/${project.id}`)}
                                            className="group text-left bg-gray-200 dark:bg-[#333435] hover:bg-gray-100 dark:hover:bg-[#3d3e40] border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600 rounded-lg p-3 transition-all"
                                        >
                                            <div className="flex items-center gap-2.5 mb-2">
                                                <div
                                                    className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                                                    style={{ backgroundColor: project.color || '#3b82f6', color: '#fff' }}
                                                >
                                                    {project.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-xs text-gray-900 dark:text-white font-medium truncate group-hover:text-blue-400 transition-colors">
                                                    {project.name}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-gray-500">
                                                {PROJECT_TYPE_CONFIG[project.project_type]?.label || 'General'}
                                            </p>
                                        </button>
                                    ))}

                                    {/* Create project card */}
                                    <button
                                        onClick={() => setShowCreateDialog(true)}
                                        className="flex flex-col items-center justify-center bg-transparent border border-dashed border-gray-200 dark:border-gray-700 hover:border-gray-500 rounded-lg p-3 min-h-[70px] transition-all"
                                    >
                                        <Plus className="h-4 w-4 text-gray-600 mb-1" />
                                        <span className="text-[10px] text-gray-600">Create project</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* BOTTOM LEFT: People */}
                    <div className="bg-gray-50 dark:bg-[#2a2b2d] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">People</h2>
                            <span className="text-[10px] text-gray-500">Frequent collaborators</span>
                        </div>

                        <div className="p-4">
                            {users.length === 0 ? (
                                <div className="py-6 text-center">
                                    <Users className="h-8 w-8 mx-auto mb-2 text-gray-700" />
                                    <p className="text-sm text-gray-600">No team members yet</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {/* Invite button */}
                                    <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                                        <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                            <UserPlus className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                        </div>
                                        <span className="text-sm text-gray-500 dark:text-gray-400">Invite</span>
                                    </div>

                                    {users.slice(0, 5).map((user) => (
                                        <div
                                            key={user.id}
                                            className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                                        >
                                            <UserAvatar user={user} size="md" />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">{user.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {users.length > 5 && (
                            <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-800">
                                <button
                                    onClick={() => router.push('/workstream/teams')}
                                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                                >
                                    View all teams
                                    <ArrowRight className="h-3 w-3" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* BOTTOM RIGHT: Customize / Quick Links */}
                    <div className="bg-gray-50 dark:bg-[#2a2b2d] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Customize</h2>
                            <Sparkles className="h-4 w-4 text-gray-500" />
                        </div>

                        <div className="p-5 space-y-3">
                            <button
                                onClick={() => router.push('/workstream/reporting')}
                                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-200 dark:bg-[#333435] hover:bg-gray-100 dark:hover:bg-[#3d3e40] border border-gray-200 dark:border-gray-700 rounded-lg transition-colors text-left"
                            >
                                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                    <Sparkles className="h-4 w-4 text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-200 font-medium">Reporting</p>
                                    <p className="text-[10px] text-gray-500">View progress across all projects</p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-gray-600 ml-auto" />
                            </button>

                            <button
                                onClick={() => router.push('/workstream/goals')}
                                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-200 dark:bg-[#333435] hover:bg-gray-100 dark:hover:bg-[#3d3e40] border border-gray-200 dark:border-gray-700 rounded-lg transition-colors text-left"
                            >
                                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-200 font-medium">Goals</p>
                                    <p className="text-[10px] text-gray-500">Track team and company goals</p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-gray-600 ml-auto" />
                            </button>

                            <button
                                onClick={() => router.push('/workstream/portfolios')}
                                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-200 dark:bg-[#333435] hover:bg-gray-100 dark:hover:bg-[#3d3e40] border border-gray-200 dark:border-gray-700 rounded-lg transition-colors text-left"
                            >
                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                    <FolderKanban className="h-4 w-4 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-200 font-medium">Portfolios</p>
                                    <p className="text-[10px] text-gray-500">Monitor project health at a glance</p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-gray-600 ml-auto" />
                            </button>

                            <button
                                onClick={() => router.push('/dashboard')}
                                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-200 dark:bg-[#333435] hover:bg-gray-100 dark:hover:bg-[#3d3e40] border border-gray-200 dark:border-gray-700 rounded-lg transition-colors text-left"
                            >
                                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                                    <Calendar className="h-4 w-4 text-yellow-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-200 font-medium">Finance Hub</p>
                                    <p className="text-[10px] text-gray-500">Go to financial dashboards</p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-gray-600 ml-auto" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Project Dialog */}
            <CreateProjectDialog
                open={showCreateDialog}
                onClose={() => {
                    setShowCreateDialog(false);
                    if (searchParams.get('new') === 'true') {
                        router.replace('/workstream');
                    }
                }}
                onCreated={handleProjectCreated}
            />
        </div>
    );
}
