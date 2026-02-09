'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
    Plus,
    FolderKanban,
    Star,
    ChevronDown,
    ChevronRight,
    Hash,
    Archive,
    MoreHorizontal,
    Trash2,
    Pencil,
    StarOff,
} from 'lucide-react';
import type { WSProject } from '@/lib/workstream-types';
import { PROJECT_TYPE_CONFIG } from '@/lib/workstream-types';

interface WorkstreamSidebarProps {
    open: boolean;
    onClose?: () => void;
}

export function WorkstreamSidebar({ open, onClose }: WorkstreamSidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [projects, setProjects] = useState<WSProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [favoritesExpanded, setFavoritesExpanded] = useState(true);
    const [allProjectsExpanded, setAllProjectsExpanded] = useState(true);
    const [contextMenu, setContextMenu] = useState<{ projectId: string; x: number; y: number } | null>(null);

    useEffect(() => {
        fetchProjects();
    }, []);

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

    async function toggleFavorite(projectId: string, currentFav: boolean) {
        try {
            await fetch(`/api/workstream/projects/${projectId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_favorite: !currentFav }),
            });
            setProjects((prev) =>
                prev.map((p) => (p.id === projectId ? { ...p, is_favorite: !currentFav } : p))
            );
        } catch (err) {
            console.error('Failed to toggle favorite:', err);
        }
        setContextMenu(null);
    }

    async function archiveProject(projectId: string) {
        try {
            await fetch(`/api/workstream/projects/${projectId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_archived: true }),
            });
            setProjects((prev) => prev.filter((p) => p.id !== projectId));
        } catch (err) {
            console.error('Failed to archive project:', err);
        }
        setContextMenu(null);
    }

    async function deleteProjectById(projectId: string) {
        if (!confirm('Tem certeza que deseja excluir este projeto permanentemente?')) return;
        try {
            await fetch(`/api/workstream/projects/${projectId}`, { method: 'DELETE' });
            setProjects((prev) => prev.filter((p) => p.id !== projectId));
            if (pathname === `/workstream/${projectId}`) {
                router.push('/workstream');
            }
        } catch (err) {
            console.error('Failed to delete project:', err);
        }
        setContextMenu(null);
    }

    const favorites = projects.filter((p) => p.is_favorite);
    const allProjects = projects;

    const isActive = (projectId: string) => pathname === `/workstream/${projectId}`;

    function ProjectItem({ project }: { project: WSProject }) {
        return (
            <div
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors text-sm ${isActive(project.id)
                        ? 'bg-white/15 text-white'
                        : 'text-gray-400 hover:bg-white/8 hover:text-gray-200'
                    }`}
                onClick={() => {
                    router.push(`/workstream/${project.id}`);
                    onClose?.();
                }}
            >
                <div
                    className="w-2 h-2 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: project.color || '#3b82f6' }}
                />
                <span className="truncate flex-1">{project.name}</span>
                <button
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-opacity"
                    onClick={(e) => {
                        e.stopPropagation();
                        const rect = (e.target as HTMLElement).getBoundingClientRect();
                        setContextMenu({ projectId: project.id, x: rect.right, y: rect.bottom });
                    }}
                >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
            </div>
        );
    }

    return (
        <>
            {/* Mobile overlay */}
            {open && (
                <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
            )}

            {/* Sidebar */}
            <aside
                className={`
          fixed lg:relative top-0 left-0 h-full z-50 lg:z-auto
          w-64 flex-shrink-0 flex flex-col
          bg-[#1e1f21] border-r border-gray-800
          transition-transform duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
                style={{ paddingTop: 0 }}
            >
                {/* New Project Button */}
                <div className="px-3 py-3 border-b border-gray-800">
                    <Link
                        href="/workstream?new=true"
                        onClick={() => onClose?.()}
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors no-underline"
                    >
                        <Plus className="h-4 w-4" />
                        Novo Projeto
                    </Link>
                </div>

                {/* Scrollable project list */}
                <div className="flex-1 overflow-y-auto px-2 py-2">
                    {/* Home link */}
                    <Link
                        href="/workstream"
                        onClick={() => onClose?.()}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors no-underline mb-1 ${pathname === '/workstream'
                                ? 'bg-white/15 text-white'
                                : 'text-gray-400 hover:bg-white/8 hover:text-gray-200'
                            }`}
                    >
                        <FolderKanban className="h-4 w-4" />
                        Início
                    </Link>

                    {/* Favorites */}
                    {favorites.length > 0 && (
                        <div className="mt-3">
                            <button
                                onClick={() => setFavoritesExpanded(!favoritesExpanded)}
                                className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider w-full hover:text-gray-400 transition-colors"
                            >
                                {favoritesExpanded ? (
                                    <ChevronDown className="h-3 w-3" />
                                ) : (
                                    <ChevronRight className="h-3 w-3" />
                                )}
                                <Star className="h-3 w-3" />
                                Favoritos
                            </button>
                            {favoritesExpanded && (
                                <div className="mt-1 space-y-0.5">
                                    {favorites.map((p) => (
                                        <ProjectItem key={p.id} project={p} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* All Projects */}
                    <div className="mt-3">
                        <button
                            onClick={() => setAllProjectsExpanded(!allProjectsExpanded)}
                            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider w-full hover:text-gray-400 transition-colors"
                        >
                            {allProjectsExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                            ) : (
                                <ChevronRight className="h-3 w-3" />
                            )}
                            <Hash className="h-3 w-3" />
                            Projetos
                        </button>
                        {allProjectsExpanded && (
                            <div className="mt-1 space-y-0.5">
                                {loading ? (
                                    <div className="px-3 py-4 text-center">
                                        <div className="animate-spin h-4 w-4 border-2 border-gray-600 border-t-blue-500 rounded-full mx-auto" />
                                    </div>
                                ) : allProjects.length === 0 ? (
                                    <div className="px-3 py-3 text-gray-600 text-xs text-center">
                                        Nenhum projeto ainda
                                    </div>
                                ) : (
                                    allProjects.map((p) => <ProjectItem key={p.id} project={p} />)
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setContextMenu(null)} />
                    <div
                        className="fixed z-[61] bg-[#2a2b2d] border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                    >
                        {(() => {
                            const project = projects.find((p) => p.id === contextMenu.projectId);
                            if (!project) return null;
                            return (
                                <>
                                    <button
                                        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10 transition-colors"
                                        onClick={() => toggleFavorite(project.id, project.is_favorite)}
                                    >
                                        {project.is_favorite ? (
                                            <>
                                                <StarOff className="h-3.5 w-3.5" /> Remover favorito
                                            </>
                                        ) : (
                                            <>
                                                <Star className="h-3.5 w-3.5" /> Adicionar favorito
                                            </>
                                        )}
                                    </button>
                                    <button
                                        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10 transition-colors"
                                        onClick={() => {
                                            router.push(`/workstream/${project.id}?settings=true`);
                                            setContextMenu(null);
                                        }}
                                    >
                                        <Pencil className="h-3.5 w-3.5" /> Editar projeto
                                    </button>
                                    <button
                                        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10 transition-colors"
                                        onClick={() => archiveProject(project.id)}
                                    >
                                        <Archive className="h-3.5 w-3.5" /> Arquivar
                                    </button>
                                    <div className="border-t border-gray-700 my-1" />
                                    <button
                                        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-400 hover:bg-red-900/20 transition-colors"
                                        onClick={() => deleteProjectById(project.id)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                                    </button>
                                </>
                            );
                        })()}
                    </div>
                </>
            )}
        </>
    );
}
