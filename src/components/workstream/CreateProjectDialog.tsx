'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { WSProject, ProjectType } from '@/lib/workstream-types';
import { PROJECT_TYPE_CONFIG } from '@/lib/workstream-types';

const COLORS = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444',
    '#f97316', '#eab308', '#22c55e', '#06b6d4',
    '#6366f1', '#a855f7', '#f43f5e', '#14b8a6',
];

interface CreateProjectDialogProps {
    open: boolean;
    onClose: () => void;
    onCreated: (project: WSProject) => void;
}

export function CreateProjectDialog({ open, onClose, onCreated }: CreateProjectDialogProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [projectType, setProjectType] = useState<ProjectType>('general');
    const [color, setColor] = useState('#3b82f6');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    if (!open) return null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) {
            setError('Project name is required');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const res = await fetch('/api/workstream/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim(),
                    project_type: projectType,
                    color,
                }),
            });
            const json = await res.json();
            if (json.success) {
                // Create default sections
                const defaultSections = ['To Do', 'In Progress', 'Review', 'Done'];
                const sectionIds: number[] = [];
                for (let i = 0; i < defaultSections.length; i++) {
                    const secRes = await fetch('/api/workstream/sections', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            project_id: json.data.id,
                            title: defaultSections[i],
                            position: i,
                        }),
                    });
                    const secJson = await secRes.json();
                    if (secJson.success) sectionIds.push(secJson.data.id);
                }

                // Update project section_order
                if (sectionIds.length > 0) {
                    await fetch(`/api/workstream/projects/${json.data.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ section_order: sectionIds }),
                    });
                }

                onCreated(json.data);
                // Reset form
                setName('');
                setDescription('');
                setProjectType('general');
                setColor('#3b82f6');
            } else {
                setError(json.error || 'Error creating project');
            }
        } catch (err) {
            setError('Network error creating project');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />

            {/* Dialog */}
            <div className="relative bg-[#2a2b2d] rounded-xl border border-gray-700 shadow-2xl w-full max-w-lg mx-4">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                    <h2 className="text-lg font-semibold text-white">New Project</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                    {/* Name */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">
                            Project Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="E.g.: Q1 2026 Reconciliation"
                            className="w-full bg-[#1e1f21] border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            autoFocus
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe the goal of this project..."
                            rows={3}
                            className="w-full bg-[#1e1f21] border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                        />
                    </div>

                    {/* Project Type */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">
                            Type
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {(Object.entries(PROJECT_TYPE_CONFIG) as [ProjectType, { label: string }][]).map(
                                ([type, config]) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setProjectType(type)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${projectType === type
                                            ? 'bg-blue-600/20 border-blue-600 text-blue-400'
                                            : 'bg-[#1e1f21] border-gray-700 text-gray-400 hover:border-gray-600'
                                            }`}
                                    >
                                        {config.label}
                                    </button>
                                )
                            )}
                        </div>
                    </div>

                    {/* Color */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">
                            Color
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            {COLORS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className={`w-7 h-7 rounded-lg transition-all ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#2a2b2d] scale-110' : 'hover:scale-105'
                                        }`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="text-red-400 text-sm bg-red-900/20 border border-red-900/50 rounded-lg px-3 py-2">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !name.trim()}
                            className="px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Creating...' : 'Create Project'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
