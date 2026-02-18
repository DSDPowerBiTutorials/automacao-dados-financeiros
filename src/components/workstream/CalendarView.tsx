'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { WSTask, WSUser } from '@/lib/workstream-types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/workstream-types';

interface CalendarViewProps {
    tasks: WSTask[];
    users: WSUser[];
    onTaskClick: (task: WSTask) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

export function CalendarView({ tasks, users, onTaskClick }: CalendarViewProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const calendarDays = useMemo(() => {
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const startDay = firstDayOfMonth.getDay();
        const totalDays = lastDayOfMonth.getDate();

        const days: { date: Date; isCurrentMonth: boolean }[] = [];

        // Previous month days
        for (let i = startDay - 1; i >= 0; i--) {
            const d = new Date(year, month, -i);
            days.push({ date: d, isCurrentMonth: false });
        }

        // Current month days
        for (let i = 1; i <= totalDays; i++) {
            days.push({ date: new Date(year, month, i), isCurrentMonth: true });
        }

        // Next month days to fill the grid (always show 6 rows = 42 cells)
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
        }

        return days;
    }, [year, month]);

    // Group tasks by date
    const tasksByDate = useMemo(() => {
        const map = new Map<string, WSTask[]>();
        tasks.forEach((t) => {
            if (t.due_date) {
                const key = t.due_date.split('T')[0]; // YYYY-MM-DD
                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push(t);
            }
        });
        return map;
    }, [tasks]);

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const goToday = () => setCurrentDate(new Date());

    const todayStr = new Date().toISOString().split('T')[0];

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {MONTHS[month]} {year}
                    </h2>
                    <button
                        onClick={goToday}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white bg-gray-50 dark:bg-[#2a2b2d] border border-gray-200 dark:border-gray-700 rounded px-2 py-1 hover:border-gray-500 transition-colors"
                    >
                        Today
                    </button>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={prevMonth}
                        className="p-1.5 rounded hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white transition-colors"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                        onClick={nextMonth}
                        className="p-1.5 rounded hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white transition-colors"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
                {DAYS.map((day) => (
                    <div key={day} className="px-2 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-hidden">
                {calendarDays.map((cell, idx) => {
                    const dateStr = cell.date.toISOString().split('T')[0];
                    const dayTasks = tasksByDate.get(dateStr) || [];
                    const isToday = dateStr === todayStr;

                    return (
                        <div
                            key={idx}
                            className={`border-b border-r border-gray-200 dark:border-gray-800 p-1 min-h-0 overflow-hidden ${cell.isCurrentMonth ? 'bg-white dark:bg-[#1e1f21]' : 'bg-gray-100 dark:bg-[#171819]'
                                }`}
                        >
                            <div className={`text-xs mb-0.5 ${isToday
                                ? 'w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium'
                                : cell.isCurrentMonth
                                    ? 'text-gray-500 dark:text-gray-400 px-0.5'
                                    : 'text-gray-600 px-0.5'
                                }`}
                            >
                                {cell.date.getDate()}
                            </div>
                            <div className="space-y-0.5 overflow-y-auto max-h-[calc(100%-20px)]">
                                {dayTasks.slice(0, 3).map((t) => {
                                    const sCfg = STATUS_CONFIG[t.status];
                                    return (
                                        <button
                                            key={t.id}
                                            onClick={() => onTaskClick(t)}
                                            className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] truncate border ${sCfg.bg} ${sCfg.border} ${sCfg.color} hover:brightness-125 transition-all`}
                                        >
                                            {t.title}
                                        </button>
                                    );
                                })}
                                {dayTasks.length > 3 && (
                                    <span className="text-[9px] text-gray-500 px-1">
                                        +{dayTasks.length - 3} more
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
