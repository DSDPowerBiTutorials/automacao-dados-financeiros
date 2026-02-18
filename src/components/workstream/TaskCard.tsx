'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, User, GripVertical, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import type { WSTask, TaskPriority, TaskStatus, WSUser } from '@/lib/workstream-types';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/lib/workstream-types';

interface TaskCardProps {
    task: WSTask;
    onClick: (task: WSTask) => void;
    overlay?: boolean;
    users?: WSUser[];
}

export function TaskCard({ task, onClick, overlay, users = [] }: TaskCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: `task-${task.id}`,
        data: { type: 'task', task },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const priority = PRIORITY_CONFIG[task.priority];
    const isOverdue = task.due_date && !task.completed_at && new Date(task.due_date) < new Date();

    return (
        <div
            ref={overlay ? undefined : setNodeRef}
            style={overlay ? undefined : style}
            className={`group bg-gray-50 dark:bg-[#2a2b2d] hover:bg-gray-100 dark:hover:bg-[#333435] border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600 rounded-lg p-3 cursor-pointer transition-colors ${isDragging ? 'shadow-xl ring-1 ring-blue-500/50' : ''
                }`}
            onClick={() => onClick(task)}
        >
            <div className="flex items-start gap-2">
                {/* Drag handle */}
                <div
                    {...(overlay ? {} : attributes)}
                    {...(overlay ? {} : listeners)}
                    className="opacity-0 group-hover:opacity-100 mt-0.5 cursor-grab active:cursor-grabbing"
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical className="h-3.5 w-3.5 text-gray-600" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Title */}
                    <p className="text-sm text-gray-900 dark:text-white font-medium leading-snug line-clamp-2">
                        {task.title}
                    </p>

                    {/* Meta row */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {/* Priority */}
                        {task.priority !== 'medium' && (
                            <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${priority.bg} ${priority.color} ${priority.border}`}
                            >
                                {task.priority === 'urgent' && <AlertCircle className="h-2.5 w-2.5" />}
                                {priority.label}
                            </span>
                        )}

                        {/* Due date */}
                        {task.due_date && (
                            <span
                                className={`inline-flex items-center gap-1 text-[10px] ${isOverdue ? 'text-red-400' : 'text-gray-500'
                                    }`}
                            >
                                <Calendar className="h-2.5 w-2.5" />
                                {new Date(task.due_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}
                            </span>
                        )}

                        {/* Tags */}
                        {task.tags?.slice(0, 2).map((tag) => (
                            <span
                                key={tag}
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-900/30 text-purple-400 border border-purple-700"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>

                    {/* Assignee */}
                    {task.assignee_id && (
                        <div className="flex items-center gap-1 mt-2">
                            <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                                {(() => {
                                    const assignee = users.find(u => u.id === task.assignee_id);
                                    return assignee ? (
                                        <span className="text-[9px] text-gray-900 dark:text-white font-medium">{assignee.name.charAt(0).toUpperCase()}</span>
                                    ) : (
                                        <User className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                                    );
                                })()}
                            </div>
                            {(() => {
                                const assignee = users.find(u => u.id === task.assignee_id);
                                return assignee ? (
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[120px]">{assignee.name}</span>
                                ) : null;
                            })()}
                        </div>
                    )}
                </div>

                {/* Status indicator */}
                <div className="flex-shrink-0">
                    {task.status === 'done' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : task.status === 'in_progress' ? (
                        <Clock className="h-4 w-4 text-blue-500" />
                    ) : task.status === 'blocked' ? (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                    ) : null}
                </div>
            </div>
        </div>
    );
}
