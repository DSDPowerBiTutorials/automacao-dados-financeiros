'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Users2,
    Plus,
    UserPlus,
    Settings,
    ChevronRight,
    FolderKanban,
    Mail,
} from 'lucide-react';
import { PROJECT_TYPE_CONFIG, type ProjectType } from '@/lib/workstream-types';
import type { WSProject } from '@/lib/workstream-types';
import { UserAvatar } from '@/components/user-avatar';
import type { WSUser } from '@/lib/workstream-types';

interface Team {
    type: ProjectType;
    label: string;
    projects: WSProject[];
    members: WSUser[];
}

export default function TeamsPage() {
    const router = useRouter();
    const [teams, setTeams] = useState<Team[]>([]);
    const [allUsers, setAllUsers] = useState<WSUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInviteDialog, setShowInviteDialog] = useState(false);

    useEffect(() => {
        async function fetchData() {
            try {
                const [projectsRes, usersRes] = await Promise.all([
                    fetch('/api/workstream/projects'),
                    fetch('/api/workstream/users'),
                ]);
                const projectsJson = await projectsRes.json();
                const usersJson = await usersRes.json();
                const projects: WSProject[] = projectsJson.data || [];
                const users: WSUser[] = usersJson.data || [];

                setAllUsers(users);

                // Group projects by type to form "teams"
                const typeMap: Record<string, WSProject[]> = {};
                for (const p of projects) {
                    const key = p.project_type || 'general';
                    if (!typeMap[key]) typeMap[key] = [];
                    typeMap[key].push(p);
                }

                const teamsList: Team[] = Object.entries(typeMap).map(([type, projs]) => ({
                    type: type as ProjectType,
                    label: PROJECT_TYPE_CONFIG[type as ProjectType]?.label || type,
                    projects: projs,
                    members: users, // For now all users are members of all teams
                }));

                setTeams(teamsList);
            } catch (err) {
                console.error('Failed to fetch teams data:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    return (
        <div className="h-full overflow-y-auto bg-white dark:bg-[#1e1f21]">
            <div className="max-w-5xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Users2 className="h-6 w-6" />
                            Teams
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                            Manage your teams and their projects
                        </p>
                    </div>
                    <button
                        onClick={() => setShowInviteDialog(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <UserPlus className="h-4 w-4" />
                        Invite People
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin h-8 w-8 border-3 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full" />
                    </div>
                ) : teams.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Users2 className="h-12 w-12 text-gray-700 mb-4" />
                        <h2 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-1">No teams yet</h2>
                        <p className="text-sm text-gray-600">Create projects to organize your teams</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {teams.map((team) => (
                            <div key={team.type} className="bg-gray-50 dark:bg-[#2a2b2d] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                                {/* Team header */}
                                <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                            <Users2 className="h-5 w-5 text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{team.label}</h3>
                                            <p className="text-xs text-gray-500">
                                                {team.projects.length} project{team.projects.length !== 1 ? 's' : ''} · {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-gray-700 dark:text-gray-300 transition-colors">
                                            <Settings className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Members row */}
                                <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800/50">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mr-2">Members</span>
                                        <div className="flex -space-x-2">
                                            {team.members.slice(0, 6).map((user) => (
                                                <div key={user.id} title={user.name}>
                                                    <UserAvatar user={user} size="sm" />
                                                </div>
                                            ))}
                                            {team.members.length > 6 && (
                                                <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[10px] text-gray-700 dark:text-gray-300 font-medium border-2 border-[#2a2b2d]">
                                                    +{team.members.length - 6}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Projects */}
                                <div className="divide-y divide-gray-200 dark:divide-gray-800/50">
                                    {team.projects.map((project) => (
                                        <div
                                            key={project.id}
                                            onClick={() => router.push(`/workstream/${project.id}`)}
                                            className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 cursor-pointer transition-colors"
                                        >
                                            <div
                                                className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                                                style={{ backgroundColor: project.color || '#3b82f6', color: '#fff' }}
                                            >
                                                {project.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{project.name}</span>
                                            <ChevronRight className="h-4 w-4 text-gray-600" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* All Members section */}
                        <div className="bg-gray-50 dark:bg-[#2a2b2d] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">All Members</h3>
                                <p className="text-xs text-gray-500 mt-0.5">{allUsers.length} people in your organization</p>
                            </div>
                            <div className="divide-y divide-gray-200 dark:divide-gray-800/50">
                                {allUsers.map((user) => (
                                    <div key={user.id} className="flex items-center gap-3 px-5 py-3">
                                        <UserAvatar user={user} size="md" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-900 dark:text-white truncate">{user.name}</p>
                                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                        </div>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                            {user.role}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
