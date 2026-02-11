'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
    Plus,
    Home,
    CheckSquare,
    Inbox,
    BarChart3,
    Briefcase,
    Target,
    Star,
    ChevronDown,
    ChevronRight,
    Archive,
    MoreHorizontal,
    Trash2,
    Pencil,
    StarOff,
    Users2,
    FolderKanban,
    UserPlus,
} from 'lucide-react';
import { useNotifications } from '@/contexts/notification-context';
import type { WSProject } from '@/lib/workstream-types';
import { PROJECT_TYPE_CONFIG } from '@/lib/workstream-types';

interface WorkstreamSidebarProps {
    open: boolean;
    onClose?: () => void;
}

export function WorkstreamSidebar({ open, onClose }: WorkstreamSidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { unreadCount } = useNotifications();
    const [projects, setProjects] = useState<WSProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [starredExpanded, setStarredExpanded] = useState(true);
    const [projectsExpanded, setProjectsExpanded] = useState(true);
    const [teamsExpanded, setTeamsExpanded] = useState(true);
    const [insightsExpanded, setInsightsExpanded] = useState(true);
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
        if (!confirm('Are you sure you want to permanently delete this project?')) return;
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

    // Group projects by type for teams section
    const teams = Array.from(new Set(projects.map(p => p.project_type))).filter(Boolean);

    const isActive = (path: string) => pathname === path;

    function ProjectItem({ project }: { project: WSProject }) {
        return (
            <div
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors text-sm ${isActive(`/workstream/${project.id}`)
                    ? 'bg-white/15 text-white'
                    : 'text-gray-400 hover:bg-white/8 hover:text-gray-200'
                    }`}
                onClick={() => {
                    router.push(`/workstream/${project.id}`);
                    onClose?.();
                }}
            >
                <div
                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                    style={{ backgroundColor: project.color || '#3b82f6', color: '#fff' }}
                >
                    {project.name.charAt(0).toUpperCase()}
                </div>
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

    // Top-level nav items (Asana-style)
    const topNavItems = [
        { label: 'Home', href: '/workstream', icon: Home, active: pathname === '/workstream' },
        { label: 'My Tasks', href: '/workstream/my-tasks', icon: CheckSquare, active: pathname === '/workstream/my-tasks' },
        { label: 'Inbox', href: '/workstream/inbox', icon: Inbox, active: pathname === '/workstream/inbox', badge: unreadCount > 0 ? unreadCount : undefined },
    ];

    const insightItems = [
        { label: 'Reporting', href: '/workstream/reporting', icon: BarChart3, active: pathname === '/workstream/reporting' },
        { label: 'Portfolios', href: '/workstream/portfolios', icon: Briefcase, active: pathname === '/workstream/portfolios' },
        { label: 'Goals', href: '/workstream/goals', icon: Target, active: pathname === '/workstream/goals' },
    ];

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
                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-2 py-3">
                    {/* Top nav items: Home, My Tasks, Inbox */}
                    <div className="space-y-0.5">
                        {topNavItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => onClose?.()}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors no-underline ${item.active
                                    ? 'bg-white/15 text-white'
                                    : 'text-gray-400 hover:bg-white/8 hover:text-gray-200'
                                    }`}
                            >
                                <item.icon className="h-4 w-4 flex-shrink-0" />
                                <span className="flex-1">{item.label}</span>
                                {item.badge && (
                                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                        {item.badge > 99 ? '99+' : item.badge}
                                    </span>
                                )}
                            </Link>
                        ))}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-800 my-3 mx-2" />

                    {/* Insights Section */}
                    <div>
                        <button
                            onClick={() => setInsightsExpanded(!insightsExpanded)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-full hover:text-gray-400 transition-colors"
                        >
                            {insightsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            Insights
                        </button>
                        {insightsExpanded && (
                            <div className="mt-0.5 space-y-0.5">
                                {insightItems.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => onClose?.()}
                                        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors no-underline ${item.active
                                            ? 'bg-white/15 text-white'
                                            : 'text-gray-400 hover:bg-white/8 hover:text-gray-200'
                                            }`}
                                    >
                                        <item.icon className="h-4 w-4 flex-shrink-0" />
                                        <span>{item.label}</span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-800 my-3 mx-2" />

                    {/* Starred / Favorites */}
                    {favorites.length > 0 && (
                        <div>
                            <button
                                onClick={() => setStarredExpanded(!starredExpanded)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-full hover:text-gray-400 transition-colors"
                            >
                                {starredExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                <Star className="h-3 w-3" />
                                Starred
                            </button>
                            {starredExpanded && (
                                <div className="mt-0.5 space-y-0.5">
                                    {favorites.map((p) => (
                                        <ProjectItem key={`fav-${p.id}`} project={p} />
                                    ))}
                                </div>
                            )}
                            <div className="border-t border-gray-800 my-3 mx-2" />
                        </div>
                    )}

                    {/* Projects */}
                    <div>
                        <div className="flex items-center justify-between px-3 py-1.5">
                            <button
                                onClick={() => setProjectsExpanded(!projectsExpanded)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-400 transition-colors"
                            >
                                {projectsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                Projects
                            </button>
                            <Link
                                href="/workstream?new=true"
                                onClick={() => onClose?.()}
                                className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors no-underline"
                                title="Create project"
                            >
                                <Plus className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                        {projectsExpanded && (
                            <div className="mt-0.5 space-y-0.5">
                                {loading ? (
                                    <div className="px-3 py-4 text-center">
                                        <div className="animate-spin h-4 w-4 border-2 border-gray-600 border-t-blue-500 rounded-full mx-auto" />
                                    </div>
                                ) : allProjects.length === 0 ? (
                                    <div className="px-3 py-3 text-gray-600 text-xs text-center">
                                        No projects yet
                                    </div>
                                ) : (
                                    allProjects.map((p) => <ProjectItem key={p.id} project={p} />)
                                )}
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-800 my-3 mx-2" />

                    {/* Teams */}
                    <div>
                        <div className="flex items-center justify-between px-3 py-1.5">
                            <button
                                onClick={() => setTeamsExpanded(!teamsExpanded)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-400 transition-colors"
                            >
                                {teamsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                <Users2 className="h-3 w-3" />
                                Teams
                            </button>
                        </div>
                        {teamsExpanded && (
                            <div className="mt-0.5 space-y-0.5">
                                {teams.length === 0 ? (
                                    <div className="px-3 py-3 text-gray-600 text-xs text-center">
                                        No teams yet
                                    </div>
                                ) : (
                                    teams.map((teamType) => {
                                        const teamProjects = projects.filter(p => p.project_type === teamType);
                                        const config = PROJECT_TYPE_CONFIG[teamType];
                                        return (
                                            <div key={teamType} className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm text-gray-400 hover:bg-white/8 hover:text-gray-200 transition-colors cursor-pointer">
                                                <Users2 className="h-3.5 w-3.5 flex-shrink-0" />
                                                <span className="truncate flex-1">{config?.label || teamType}</span>
                                                <span className="text-[10px] text-gray-600">{teamProjects.length}</span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>

                    {/* Bottom: Invite teammates */}
                    <div className="border-t border-gray-800 my-3 mx-2" />
                    <div className="px-3 pb-3">
                        <button
                            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-gray-500 hover:bg-white/8 hover:text-gray-300 transition-colors"
                        >
                            <UserPlus className="h-4 w-4" />
                            Invite teammates
                        </button>
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
                                                <StarOff className="h-3.5 w-3.5" /> Remove favorite
                                            </>
                                        ) : (
                                            <>
                                                <Star className="h-3.5 w-3.5" /> Add to favorites
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
                                        <Pencil className="h-3.5 w-3.5" /> Edit project
                                    </button>
                                    <button
                                        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10 transition-colors"
                                        onClick={() => archiveProject(project.id)}
                                    >
                                        <Archive className="h-3.5 w-3.5" /> Archive
                                    </button>
                                    <div className="border-t border-gray-700 my-1" />
                                    <button
                                        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-400 hover:bg-red-900/20 transition-colors"
                                        onClick={() => deleteProjectById(project.id)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" /> Delete
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
