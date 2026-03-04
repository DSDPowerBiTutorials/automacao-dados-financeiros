"use client";

import { HardDrive } from "lucide-react";
import { FileExplorer } from "@/components/app/file-explorer";

export default function DrivePage() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3">
                    <HardDrive className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <h2 className="text-xl font-semibold">Drive</h2>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                    Gerencie todos os ficheiros do sistema — extratos, faturas e anexos
                </p>
            </div>

            {/* File Explorer */}
            <FileExplorer />
        </div>
    );
}
