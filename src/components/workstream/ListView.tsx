'use client';

import { useState } from 'react';
import {
    ChevronDown,
    ChevronRight,
    Plus,
    CheckCircle2,
    Circle,
    Calendar,
    AlertCircle,
    User,
} from 'lucide-react';
import type { WSSection, WSTask, TaskStatus, TaskPriority, WSUser } from '@/lib/workstream-types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/workstream-types';

interface ListViewProps {
    sections: WSSection[];
    tasks: WSTask[];
    sectionOrder: number[];
    onTaskClick: (task: WSTask) => void;
    onAddTask: (sectionId: number, title: string) => void;
    onToggleTaskStatus: (taskId: number, currentStatus: TaskStatus) => void;
    onUpdateTaskField: (taskId: number, field: string, value: unknown) => void;
    users?: WSUser[];
}

export function ListView({
    sections,
    tasks,
    sectionOrder,
    onTaskClick,
    onAddTask,
    onToggleTaskStatus,
    onUpdateTaskField,
    users = [],
}: ListViewProps) {
    const [expandedSections, setExpandedSections] = useState<Set<number>>(
        new Set(sections.map((s) => s.id))
    );
    const [addingTaskSection, setAddingTaskSection] = useState<number | null>(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');

    const orderedSections = sectionOrder
        .map((id) => sections.find((s) => s.id === id))
        .filter(Boolean) as WSSection[];
    const missing = sections.filter((s) => !sectionOrder.includes(s.id));
    const allSections = [...orderedSections, ...missing];

    function getTasksForSection(sectionId: number) {
        const section = sections.find((s) => s.id === sectionId);
        if (!section) return [];
        const sectionTasks = tasks.filter((t) => t.section_id === sectionId);
        if (section.task_order?.length) {
            const ordered: WSTask[] = [];
            for (const tid of section.task_order) {
                const found = sectionTasks.find((t) => t.id === tid);
                if (found) ordered.push(found);
            }
            const remaining = sectionTasks.filter((t) => !section.task_order.includes(t.id));
            return [...ordered, ...remaining];
        }
        return sectionTasks.sort((a, b) => a.position - b.position);
    }

    function toggleSection(sectionId: number) {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(sectionId)) next.delete(sectionId);
            else next.add(sectionId);
            return next;
        });
    }

    function handleAddTask(sectionId: number) {
        if (newTaskTitle.trim()) {
            onAddTask(sectionId, newTaskTitle.trim());
            setNewTaskTitle('');
            setAddingTaskSection(null);
        }
    }

    return (
        <div className="h-full overflow-y-auto">
            {/* Sticky header */}
            <div className="sticky top-0 z-10 bg-gray-50 dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-[1fr_120px_100px_100px_120px] gap-2 px-6 py-2">
                    <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Task</div>
                    <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Status</div>
                    <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Priority</div>
                    <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Assignee</div>
                    <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Due Date</div>
                </div>
            </div>

            {/* Sections */}
            <div>
                {allSections.map((section) => {
                    const sectionTasks = getTasksForSection(section.id);
                    const isExpanded = expandedSections.has(section.id);
                    const doneCount = sectionTasks.filter((t) => t.status === 'done').length;

                    return (
                        <div key={section.id} className="border-b border-gray-200 dark:border-gray-800">
                            {/* Section header */}
                            <button
                                onClick={() => toggleSection(section.id)}
                                className="w-full flex items-center gap-2 px-6 py-2.5 hover:bg-gray-100 dark:bg-black/50 transition-colors"
                            >
                                {isExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                                ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                                )}
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{section.title}</span>
                                <span className="text-xs text-gray-600 ml-1">
                                    {doneCount}/{sectionTasks.length}
                                </span>
                            </button>

                            {/* Task rows */}
                            {isExpanded && (
                                <div>
                                    {sectionTasks.map((task) => {
                                        const isDone = task.status === 'done';
                                        const isOverdue = task.due_date && !task.completed_at && new Date(task.due_date) < new Date();
                                        const statusCfg = STATUS_CONFIG[task.status];
                                        const priorityCfg = PRIORITY_CONFIG[task.priority];

                                        return (
                                            <div
                                                key={task.id}
                                                onClick={() => onTaskClick(task)}
                                                className="grid grid-cols-[1fr_120px_100px_100px_120px] gap-2 px-6 py-2 border-t border-gray-200 dark:border-gray-800/50 hover:bg-gray-50 dark:bg-black/30 cursor-pointer transition-colors items-center"
                                            >
                                                {/* Title + checkbox */}
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onToggleTaskStatus(task.id, task.status);
                                                        }}
                                                        className="flex-shrink-0"
                                                    >
                                                        {isDone ? (
                                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <Circle className="h-4 w-4 text-gray-600 hover:text-gray-500 dark:text-gray-400" />
                                                        )}
                                                    </button>
                                                    <span
                                                        className={`text-sm truncate ${isDone ? 'text-gray-500 line-through' : 'text-gray-600 dark:text-gray-200'
                                                            }`}
                                                    >
                                                        {task.title}
                                                    </span>
                                                    {task.tags?.length > 0 && (
                                                        <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] rounded bg-purple-900/30 text-purple-400 border border-purple-700">
                                                            {task.tags[0]}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Status */}
                                                <div>
                                                    <select
                                                        value={task.status}
                                                        onChange={(e) => {
                                                            e.stopPropagation();
                                                            onUpdateTaskField(task.id, 'status', e.target.value);
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className={`text-xs px-2 py-1 rounded border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border} bg-transparent cursor-pointer focus:outline-none`}
                                                    >
                                                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                                            <option key={key} value={key}>
                                                                {cfg.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Priority */}
                                                <div>
                                                    <select
                                                        value={task.priority}
                                                        onChange={(e) => {
                                                            e.stopPropagation();
                                                            onUpdateTaskField(task.id, 'priority', e.target.value);
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className={`text-xs px-2 py-1 rounded border ${priorityCfg.bg} ${priorityCfg.color} ${priorityCfg.border} bg-transparent cursor-pointer focus:outline-none`}
                                                    >
                                                        {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                                                            <option key={key} value={key}>
                                                                {cfg.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Assignee */}
                                                <div className="flex items-center gap-1.5">
                                                    {task.assignee_id ? (
                                                        <>
                                                            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                                                                {(() => {
                                                                    const assignee = users.find(u => u.id === task.assignee_id);
                                                                    return assignee ? (
                                                                        <span className="text-[10px] text-gray-900 dark:text-white font-medium">{assignee.name.charAt(0).toUpperCase()}</span>
                                                                    ) : (
                                                                        <User className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                                                                    );
                                                                })()}
                                                            </div>
                                                            {(() => {
                                                                const assignee = users.find(u => u.id === task.assignee_id);
                                                                return assignee ? (
                                                                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{assignee.name.split(' ')[0]}</span>
                                                                ) : null;
                                                            })()}
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-gray-600">—</span>
                                                    )}
                                                </div>

                                                {/* Due date */}
                                                <div className="flex items-center gap-1">
                                                    {task.due_date ? (
                                                        <span
                                                            className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-400' : 'text-gray-500'
                                                                }`}
                                                        >
                                                            <Calendar className="h-3 w-3" />
                                                            {new Date(task.due_date).toLocaleDateString('en-US', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                            })}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-600">—</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Add task row */}
                                    {addingTaskSection === section.id ? (
                                        <div className="px-6 py-2 border-t border-gray-200 dark:border-gray-800/50">
                                            <div className="flex items-center gap-2">
                                                <Circle className="h-4 w-4 text-gray-600 flex-shrink-0" />
                                                <input
                                                    value={newTaskTitle}
                                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                                    placeholder="Task title..."
                                                    className="flex-1 bg-transparent border-none text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleAddTask(section.id);
                                                        if (e.key === 'Escape') {
                                                            setNewTaskTitle('');
                                                            setAddingTaskSection(null);
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        if (newTaskTitle.trim()) handleAddTask(section.id);
                                                        else setAddingTaskSection(null);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setAddingTaskSection(section.id)}
                                            className="w-full flex items-center gap-2 px-6 py-2 text-gray-600 hover:text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:bg-black/20 text-xs transition-colors"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            Add task...
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
