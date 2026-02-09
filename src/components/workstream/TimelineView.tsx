'use client';

import { useState, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { WSTask, WSSection, WSUser } from '@/lib/workstream-types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/workstream-types';

interface TimelineViewProps {
    tasks: WSTask[];
    sections: WSSection[];
    users: WSUser[];
    onTaskClick: (task: WSTask) => void;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function addDays(date: Date, days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function diffDays(a: Date, b: Date) {
    return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: Date) {
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

const STATUS_COLORS: Record<string, string> = {
    todo: '#6b7280',
    in_progress: '#3b82f6',
    review: '#eab308',
    done: '#22c55e',
    blocked: '#ef4444',
};

export function TimelineView({ tasks, sections, users, onTaskClick }: TimelineViewProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Calculate date range: from earliest start/due to latest due, default to 4 weeks if none
    const { startDate, endDate, totalDays, weekStarts } = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        let minDate = new Date(now);
        let maxDate = addDays(now, 28);

        const tasksWithDates = tasks.filter(t => t.due_date || t.start_date);
        tasksWithDates.forEach((t) => {
            if (t.start_date) {
                const sd = new Date(t.start_date);
                if (sd < minDate) minDate = sd;
            }
            if (t.due_date) {
                const dd = new Date(t.due_date);
                if (dd > maxDate) maxDate = dd;
                if (dd < minDate) minDate = dd;
            }
        });

        // Add padding
        minDate = addDays(minDate, -3);
        maxDate = addDays(maxDate, 7);

        const total = diffDays(maxDate, minDate) + 1;

        // Generate week starts
        const weeks: Date[] = [];
        const current = new Date(minDate);
        // move to next Monday
        while (current.getDay() !== 1) current.setDate(current.getDate() + 1);
        while (current <= maxDate) {
            weeks.push(new Date(current));
            current.setDate(current.getDate() + 7);
        }

        return { startDate: minDate, endDate: maxDate, totalDays: total, weekStarts: weeks };
    }, [tasks]);

    const DAY_WIDTH = 32; // pixels per day
    const ROW_HEIGHT = 36;
    const SIDEBAR_WIDTH = 260;

    // Filter tasks with at least a due_date
    const sortedTasks = useMemo(() => {
        return [...tasks].sort((a, b) => {
            // Sort by section, then position
            if (a.section_id !== b.section_id) return a.section_id - b.section_id;
            return a.position - b.position;
        });
    }, [tasks]);

    const todayOffset = diffDays(new Date(), startDate);

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Scrollable area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar: task names */}
                <div className="flex-shrink-0 border-r border-gray-800 overflow-y-auto bg-[#1e1f21]" style={{ width: SIDEBAR_WIDTH }}>
                    {/* Header */}
                    <div className="h-12 border-b border-gray-800 px-3 flex items-center">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tasks</span>
                    </div>
                    {/* Task rows */}
                    {sortedTasks.map((t) => {
                        const assignee = users.find(u => u.id === t.assignee_id);
                        return (
                            <div
                                key={t.id}
                                onClick={() => onTaskClick(t)}
                                className="flex items-center gap-2 px-3 border-b border-gray-800/50 cursor-pointer hover:bg-white/5 transition-colors"
                                style={{ height: ROW_HEIGHT }}
                            >
                                <div
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: STATUS_COLORS[t.status] || '#6b7280' }}
                                />
                                <span className="text-xs text-gray-300 truncate flex-1">{t.title}</span>
                                {assignee && (
                                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[8px] font-medium flex-shrink-0">
                                        {assignee.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Timeline area */}
                <div className="flex-1 overflow-auto" ref={scrollRef}>
                    <div style={{ width: totalDays * DAY_WIDTH, minHeight: '100%' }} className="relative">
                        {/* Date header */}
                        <div className="h-12 border-b border-gray-800 sticky top-0 z-10 bg-[#1e1f21] flex">
                            {weekStarts.map((ws, idx) => {
                                const offset = diffDays(ws, startDate) * DAY_WIDTH;
                                return (
                                    <div
                                        key={idx}
                                        className="absolute top-0 border-l border-gray-800"
                                        style={{ left: offset }}
                                    >
                                        <div className="px-2 py-1">
                                            <span className="text-[10px] text-gray-500">{formatDate(ws)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Today line */}
                        {todayOffset >= 0 && todayOffset <= totalDays && (
                            <div
                                className="absolute top-0 bottom-0 w-px bg-blue-500 z-20"
                                style={{ left: todayOffset * DAY_WIDTH }}
                            />
                        )}

                        {/* Task bars */}
                        {sortedTasks.map((t, idx) => {
                            const hasStart = !!t.start_date;
                            const hasDue = !!t.due_date;
                            if (!hasDue && !hasStart) {
                                return (
                                    <div
                                        key={t.id}
                                        style={{ top: 48 + idx * ROW_HEIGHT, height: ROW_HEIGHT }}
                                        className="absolute left-0 right-0 border-b border-gray-800/30"
                                    />
                                );
                            }

                            const taskStart = hasStart ? new Date(t.start_date!) : hasDue ? addDays(new Date(t.due_date!), -1) : new Date();
                            const taskEnd = hasDue ? new Date(t.due_date!) : addDays(taskStart, 1);
                            const leftOffset = diffDays(taskStart, startDate) * DAY_WIDTH;
                            const barWidth = Math.max(diffDays(taskEnd, taskStart) + 1, 1) * DAY_WIDTH;
                            const color = STATUS_COLORS[t.status] || '#6b7280';

                            return (
                                <div
                                    key={t.id}
                                    style={{ top: 48 + idx * ROW_HEIGHT, height: ROW_HEIGHT }}
                                    className="absolute left-0 right-0 border-b border-gray-800/30"
                                >
                                    <div
                                        onClick={() => onTaskClick(t)}
                                        className="absolute top-1.5 rounded cursor-pointer hover:brightness-125 transition-all flex items-center px-2 overflow-hidden"
                                        style={{
                                            left: leftOffset,
                                            width: barWidth,
                                            height: ROW_HEIGHT - 12,
                                            backgroundColor: `${color}30`,
                                            borderLeft: `3px solid ${color}`,
                                        }}
                                    >
                                        <span className="text-[10px] text-gray-300 truncate">{t.title}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
