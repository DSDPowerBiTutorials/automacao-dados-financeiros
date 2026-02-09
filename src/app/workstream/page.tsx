'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, FolderKanban, Clock, ArrowRight } from 'lucide-react';
import type { WSProject } from '@/lib/workstream-types';
import { PROJECT_TYPE_CONFIG } from '@/lib/workstream-types';
import { CreateProjectDialog } from '@/components/workstream/CreateProjectDialog';

export default function WorkstreamHomePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [projects, setProjects] = useState<WSProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateDialog, setShowCreateDialog] = useState(false);

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        if (searchParams.get('new') === 'true') {
            setShowCreateDialog(true);
        }
    }, [searchParams]);

    async function fetchProjects() {
        try {
            const res = await fetch('/api/workstream/projects');
            const json = await res.json();
            if (json.success) setProjects(json.data || []);
        } catch (err) {
            console.error('Failed to fetch projects:', err);
        } finally {
            setLoading(false);
        }
    }

    function handleProjectCreated(project: WSProject) {
        setProjects((prev) => [project, ...prev]);
        setShowCreateDialog(false);
        router.push(`/workstream/${project.id}`);
    }

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-3 border-gray-600 border-t-blue-500 rounded-full" />
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-5xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Welcome to Workstream</h1>
                        <p className="text-gray-400 text-sm mt-1">
                            Manage your team&apos;s projects and tasks
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreateDialog(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        New Project
                    </button>
                </div>

                {projects.length === 0 ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-20 h-20 rounded-2xl bg-[#2a2b2d] flex items-center justify-center mb-6">
                            <FolderKanban className="h-10 w-10 text-gray-600" />
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">No projects yet</h2>
                        <p className="text-gray-400 text-sm mb-6 text-center max-w-md">
                            Create your first project to start organizing tasks, tracking progress, and collaborating with your team.
                        </p>
                        <button
                            onClick={() => setShowCreateDialog(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            Create First Project
                        </button>
                    </div>
                ) : (
                    /* Project grid */
                    <div>
                        {/* Recent projects */}
                        <div className="mb-8">
                            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5" />
                                Recent Projects
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {projects.slice(0, 6).map((project) => (
                                    <button
                                        key={project.id}
                                        onClick={() => router.push(`/workstream/${project.id}`)}
                                        className="group text-left bg-[#2a2b2d] hover:bg-[#333435] border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-all"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div
                                                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                                style={{ backgroundColor: project.color + '20', color: project.color }}
                                            >
                                                <FolderKanban className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-white font-medium text-sm truncate group-hover:text-blue-400 transition-colors">
                                                    {project.name}
                                                </h3>
                                                <p className="text-gray-500 text-xs mt-0.5 truncate">
                                                    {PROJECT_TYPE_CONFIG[project.project_type]?.label || 'Geral'}
                                                </p>
                                            </div>
                                            <ArrowRight className="h-4 w-4 text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0 mt-1" />
                                        </div>
                                        {project.description && (
                                            <p className="text-gray-500 text-xs mt-2.5 line-clamp-2">
                                                {project.description}
                                            </p>
                                        )}
                                    </button>
                                ))}

                                {/* New project card */}
                                <button
                                    onClick={() => setShowCreateDialog(true)}
                                    className="flex flex-col items-center justify-center bg-[#2a2b2d]/50 hover:bg-[#2a2b2d] border border-dashed border-gray-700 hover:border-gray-600 rounded-xl p-4 min-h-[100px] transition-all"
                                >
                                    <Plus className="h-6 w-6 text-gray-600 mb-1" />
                                    <span className="text-gray-500 text-xs">New Project</span>
                                </button>
                            </div>
                        </div>

                        {/* All projects list */}
                        {projects.length > 6 && (
                            <div>
                                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                    All Projects
                                </h2>
                                <div className="space-y-1">
                                    {projects.slice(6).map((project) => (
                                        <button
                                            key={project.id}
                                            onClick={() => router.push(`/workstream/${project.id}`)}
                                            className="group flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-[#2a2b2d] transition-colors text-left"
                                        >
                                            <div
                                                className="w-2 h-2 rounded-sm flex-shrink-0"
                                                style={{ backgroundColor: project.color || '#3b82f6' }}
                                            />
                                            <span className="text-gray-300 text-sm truncate flex-1 group-hover:text-white transition-colors">
                                                {project.name}
                                            </span>
                                            <span className="text-gray-600 text-xs">
                                                {PROJECT_TYPE_CONFIG[project.project_type]?.label || 'Geral'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Create Project Dialog */}
            <CreateProjectDialog
                open={showCreateDialog}
                onClose={() => {
                    setShowCreateDialog(false);
                    // Clear ?new=true from URL
                    if (searchParams.get('new') === 'true') {
                        router.replace('/workstream');
                    }
                }}
                onCreated={handleProjectCreated}
            />
        </div>
    );
}
