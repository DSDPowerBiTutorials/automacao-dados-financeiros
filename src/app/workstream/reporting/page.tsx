'use client';

import { useState, useEffect } from 'react';
import {
    BarChart3,
    TrendingUp,
    Users,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Calendar,
    PieChart,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

interface ProjectStats {
    project_name: string;
    project_color: string;
    total_tasks: number;
    completed_tasks: number;
    overdue_tasks: number;
    in_progress: number;
}

export default function ReportingPage() {
    const [statsData, setStatsData] = useState<ProjectStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalStats, setTotalStats] = useState({
        totalTasks: 0,
        completedTasks: 0,
        overdueTasks: 0,
        inProgressTasks: 0,
    });

    useEffect(() => {
        async function fetchData() {
            try {
                const projectsRes = await fetch('/api/workstream/projects');
                const projectsJson = await projectsRes.json();
                const projects = projectsJson.data || [];

                const stats: ProjectStats[] = [];
                let totalTasks = 0;
                let completedTasks = 0;
                let overdueTasks = 0;
                let inProgressTasks = 0;
                const now = new Date().toISOString().split('T')[0];

                for (const project of projects) {
                    const tasksRes = await fetch(`/api/workstream/tasks?project_id=${project.id}`);
                    const tasksJson = await tasksRes.json();
                    const tasks = tasksJson.data || [];

                    const completed = tasks.filter((t: any) => t.status === 'done').length;
                    const overdue = tasks.filter((t: any) => t.status !== 'done' && t.due_date && t.due_date < now).length;
                    const inProg = tasks.filter((t: any) => t.status === 'in_progress').length;

                    stats.push({
                        project_name: project.name,
                        project_color: project.color || '#3b82f6',
                        total_tasks: tasks.length,
                        completed_tasks: completed,
                        overdue_tasks: overdue,
                        in_progress: inProg,
                    });

                    totalTasks += tasks.length;
                    completedTasks += completed;
                    overdueTasks += overdue;
                    inProgressTasks += inProg;
                }

                setStatsData(stats);
                setTotalStats({ totalTasks, completedTasks, overdueTasks, inProgressTasks });
            } catch (err) {
                console.error('Failed to fetch reporting data:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const completionRate = totalStats.totalTasks > 0
        ? Math.round((totalStats.completedTasks / totalStats.totalTasks) * 100)
        : 0;

    const summaryCards = [
        { label: 'Total Tasks', value: totalStats.totalTasks, icon: CheckCircle2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'Completed', value: totalStats.completedTasks, icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
        { label: 'In Progress', value: totalStats.inProgressTasks, icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
        { label: 'Overdue', value: totalStats.overdueTasks, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
    ];

    return (
        <div className="h-full overflow-y-auto bg-white dark:bg-black">
            <div className="max-w-5xl mx-auto px-6 py-8">
                <PageHeader title="Reporting" subtitle="Overview of task progress across all projects" />

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin h-8 w-8 border-3 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full" />
                    </div>
                ) : (
                    <>
                        {/* Summary cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            {summaryCards.map((card) => (
                                <div key={card.label} className="bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                                    <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                                        <card.icon className={`h-5 w-5 ${card.color}`} />
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Completion rate bar */}
                        <div className="bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-8">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Overall Completion Rate</h3>
                                <span className="text-2xl font-bold text-gray-900 dark:text-white">{completionRate}%</span>
                            </div>
                            <div className="w-full h-3 bg-gray-100 dark:bg-black rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
                                    style={{ width: `${completionRate}%` }}
                                />
                            </div>
                        </div>

                        {/* Per-project breakdown */}
                        <div className="bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Project Breakdown</h3>
                            </div>
                            {statsData.length === 0 ? (
                                <div className="px-4 py-8 text-center text-gray-600 text-sm">
                                    No projects to show
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                                    {statsData.map((stat) => {
                                        const rate = stat.total_tasks > 0
                                            ? Math.round((stat.completed_tasks / stat.total_tasks) * 100)
                                            : 0;
                                        return (
                                            <div key={stat.project_name} className="px-4 py-3 flex items-center gap-4">
                                                <div
                                                    className="w-3 h-3 rounded-sm flex-shrink-0"
                                                    style={{ backgroundColor: stat.project_color }}
                                                />
                                                <span className="text-sm text-gray-900 dark:text-white flex-1 truncate">{stat.project_name}</span>
                                                <div className="flex items-center gap-6 text-xs text-gray-500 dark:text-gray-400">
                                                    <span>{stat.total_tasks} tasks</span>
                                                    <span className="text-green-400">{stat.completed_tasks} done</span>
                                                    {stat.overdue_tasks > 0 && (
                                                        <span className="text-red-400">{stat.overdue_tasks} overdue</span>
                                                    )}
                                                </div>
                                                <div className="w-24 h-2 bg-gray-100 dark:bg-black rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-green-500 rounded-full"
                                                        style={{ width: `${rate}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-500 w-10 text-right">{rate}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
