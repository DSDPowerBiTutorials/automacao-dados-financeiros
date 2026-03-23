"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { hasUnread, getLatestItemId, getLastReadId } from "@/lib/whats-new-data";

export function WhatsNewIndicator() {
    const [unread, setUnread] = useState(false);

    useEffect(() => {
        setUnread(hasUnread());

        const onStorage = (e: StorageEvent) => {
            if (e.key === "whats-new-last-read-id") {
                setUnread(getLatestItemId() > (parseInt(e.newValue || "0", 10) || 0));
            }
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    return (
        <Link
            href="/whats-new"
            className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
            title="What's New"
        >
            <Lightbulb size={20} className="text-gray-700 dark:text-gray-300" />
            {unread && (
                <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                </span>
            )}
        </Link>
    );
}
