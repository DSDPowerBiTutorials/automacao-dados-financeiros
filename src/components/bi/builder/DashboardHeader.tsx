"use client";

import { Calendar, User } from "lucide-react";

interface DashboardHeaderProps {
    title: string;
    authorName: string;
    createdAt: string;
    updatedAt: string;
    onTitleChange: (title: string) => void;
}

export function DashboardHeader({ title, authorName, createdAt, updatedAt, onTitleChange }: DashboardHeaderProps) {
    const created = new Date(createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const updated = new Date(updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

    return (
        <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
                <input
                    type="text"
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    className="text-lg font-bold text-gray-900 dark:text-white bg-transparent border-none outline-none focus:ring-0 w-full placeholder-gray-400"
                    placeholder="Dashboard title..."
                />
                <div className="flex items-center gap-4 mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                    <span className="flex items-center gap-1">
                        <User size={10} /> {authorName || "Unknown"}
                    </span>
                    <span className="flex items-center gap-1">
                        <Calendar size={10} /> Created {created}
                    </span>
                    <span className="flex items-center gap-1">
                        <Calendar size={10} /> Updated {updated}
                    </span>
                </div>
            </div>
        </div>
    );
}
