'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Briefcase,
    Plus,
    ArrowRight,
    CheckCircle2,
    Clock,
    AlertTriangle,
    FolderKanban,
    TrendingUp,
} from 'lucide-react';
import type { WSProject } from '@/lib/workstream-types';
import { PROJECT_TYPE_CONFIG } from '@/lib/workstream-types';

interface ProjectWithStats extends WSProject {
    total_tasks: number;
    completed_tasks: number;
    overdue_tasks: number;
    completion_rate: number;
}

export default function PortfoliosPage() {
    const router = useRouter();
    const [projects, setProjects] = useState<ProjectWithStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const projectsRes = await fetch('/api/workstream/projects');
                const projectsJson = await projectsRes.json();
                const rawProjects: WSProject[] = projectsJson.data || [];
                const now = new Date().toISOString().split('T')[0];

                const enriched: ProjectWithStats[] = [];
                for (const project of rawProjects) {
                    const tasksRes = await fetch(`/api/workstream/tasks?project_id=${project.id}`);
                    const tasksJson = await tasksRes.json();
                    const tasks = tasksJson.data || [];

                    const total = tasks.length;
                    const completed = tasks.filter((t: any) => t.status === 'done').length;
                    const overdue = tasks.filter((t: any) => t.status !== 'done' && t.due_date && t.due_date < now).length;

                    enriched.push({
                        ...project,
                        total_tasks: total,
                        completed_tasks: completed,
                        overdue_tasks: overdue,
                        completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
                    });
                }

                setProjects(enriched);
            } catch (err) {
                console.error('Failed to fetch portfolios:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    function getStatusColor(rate: number) {
        if (rate >= 80) return 'text-green-400';
        if (rate >= 50) return 'text-yellow-400';
        return 'text-red-400';
    }

    function getStatusLabel(project: ProjectWithStats) {
        if (project.overdue_tasks > 0) return { label: 'At Risk', color: 'text-red-400', bg: 'bg-red-500/10' };
        if (project.completion_rate >= 80) return { label: 'On Track', color: 'text-green-400', bg: 'bg-green-500/10' };
        if (project.completion_rate >= 50) return { label: 'In Progress', color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
        return { label: 'Just Started', color: 'text-blue-400', bg: 'bg-blue-500/10' };
    }

    return (
        <div className="h-full overflow-y-auto bg-white dark:bg-black">
            <div className="max-w-5xl mx-auto px-6 py-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Briefcase className="h-6 w-6" />
                            Portfolios
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                            Track progress across all your projects at a glance
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin h-8 w-8 border-3 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full" />
                    </div>
                ) : projects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Briefcase className="h-12 w-12 text-gray-700 mb-4" />
                        <h2 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-1">No projects yet</h2>
                        <p className="text-sm text-gray-600">Create a project to see it in your portfolio</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Table header */}
                        <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            <div className="col-span-4">Project</div>
                            <div className="col-span-2 text-center">Status</div>
                            <div className="col-span-1 text-center">Tasks</div>
                            <div className="col-span-3">Progress</div>
                            <div className="col-span-1 text-center">Overdue</div>
                            <div className="col-span-1 text-center">Type</div>
                        </div>

                        {projects.map((project) => {
                            const status = getStatusLabel(project);
                            return (
                                <div
                                    key={project.id}
                                    onClick={() => router.push(`/workstream/${project.id}`)}
                                    className="grid grid-cols-12 gap-4 items-center bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#333435] cursor-pointer transition-colors"
                                >
                                    {/* Project name */}
                                    <div className="col-span-4 flex items-center gap-3">
                                        <div
                                            className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                                            style={{ backgroundColor: project.color || '#3b82f6', color: '#fff' }}
                                        >
                                            {project.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-sm text-gray-900 dark:text-white truncate">{project.name}</span>
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-2 flex justify-center">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${status.color} ${status.bg}`}>
                                            {status.label}
                                        </span>
                                    </div>

                                    {/* Total tasks */}
                                    <div className="col-span-1 text-center text-sm text-gray-500 dark:text-gray-400">
                                        {project.total_tasks}
                                    </div>

                                    {/* Progress */}
                                    <div className="col-span-3 flex items-center gap-2">
                                        <div className="flex-1 h-2 bg-gray-100 dark:bg-black rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-green-500 rounded-full transition-all"
                                                style={{ width: `${project.completion_rate}%` }}
                                            />
                                        </div>
                                        <span className={`text-xs font-medium ${getStatusColor(project.completion_rate)}`}>
                                            {project.completion_rate}%
                                        </span>
                                    </div>

                                    {/* Overdue */}
                                    <div className="col-span-1 text-center">
                                        {project.overdue_tasks > 0 ? (
                                            <span className="text-xs text-red-400 font-medium">{project.overdue_tasks}</span>
                                        ) : (
                                            <span className="text-xs text-gray-600">0</span>
                                        )}
                                    </div>

                                    {/* Type */}
                                    <div className="col-span-1 text-center">
                                        <span className="text-[10px] text-gray-500">
                                            {PROJECT_TYPE_CONFIG[project.project_type]?.label || 'General'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
