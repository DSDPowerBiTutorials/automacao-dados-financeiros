"use client";

import * as React from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export type ClinicEventType = "New" | "Pause" | "Return" | "Churn" | null;

interface ClinicEventDropdownProps {
    clinicId: number;
    currentEvent: ClinicEventType;
    isNew?: boolean;
    isChurned?: boolean;
    yearMonth: string;
    disabled?: boolean;
    onEventChange?: (eventType: ClinicEventType) => void;
}

const eventColors: Record<string, { bg: string; text: string; border: string }> = {
    New: { bg: "bg-green-900/50", text: "text-green-400", border: "border-green-600" },
    Pause: { bg: "bg-yellow-900/50", text: "text-yellow-400", border: "border-yellow-600" },
    Return: { bg: "bg-blue-900/50", text: "text-blue-400", border: "border-blue-600" },
    Churn: { bg: "bg-red-900/50", text: "text-red-400", border: "border-red-600" },
};

export function ClinicEventDropdown({
    clinicId,
    currentEvent,
    isNew = false,
    isChurned = false,
    yearMonth,
    disabled = false,
    onEventChange,
}: ClinicEventDropdownProps) {
    const [loading, setLoading] = React.useState(false);
    const [selectedEvent, setSelectedEvent] = React.useState<ClinicEventType>(
        currentEvent || (isNew ? "New" : null)
    );

    // If clinic is churned in a previous month and this is not the churn month,
    // show disabled "Churn" badge
    if (isChurned && currentEvent !== "Churn") {
        return (
            <Badge
                variant="outline"
                className="bg-red-900/30 text-red-400 border-red-700 opacity-60"
            >
                Churned
            </Badge>
        );
    }

    const handleChange = async (value: string) => {
        const newEvent = value === "none" ? null : (value as ClinicEventType);
        setSelectedEvent(newEvent);
        setLoading(true);

        try {
            if (newEvent && clinicId > 0) {
                // Save event via API
                const response = await fetch("/api/clinics/events", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        clinic_id: clinicId,
                        event_type: newEvent,
                        year_month: yearMonth,
                    }),
                });

                if (!response.ok) {
                    throw new Error("Failed to save event");
                }
            }

            onEventChange?.(newEvent);
        } catch (error) {
            console.error("Error saving clinic event:", error);
            // Revert on error
            setSelectedEvent(currentEvent);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center w-24 h-8">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
        );
    }

    // If New is auto-detected and confirmed, show as badge
    if (isNew && selectedEvent === "New") {
        return (
            <Badge
                variant="outline"
                className="bg-green-900/30 text-green-400 border-green-700"
            >
                New
            </Badge>
        );
    }

    const colors = selectedEvent ? eventColors[selectedEvent] : null;

    return (
        <Select
            value={selectedEvent || "none"}
            onValueChange={handleChange}
            disabled={disabled}
        >
            <SelectTrigger
                className={`w-24 h-8 text-xs border ${colors
                        ? `${colors.bg} ${colors.text} ${colors.border}`
                        : "bg-gray-800 text-gray-400 border-gray-600"
                    }`}
            >
                <SelectValue placeholder="-" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-600">
                <SelectItem value="none" className="text-gray-400 focus:bg-gray-700 focus:text-gray-200">
                    -
                </SelectItem>
                <SelectItem value="New" className="text-green-400 focus:bg-gray-700 focus:text-green-400">
                    New
                </SelectItem>
                <SelectItem value="Pause" className="text-yellow-400 focus:bg-gray-700 focus:text-yellow-400">
                    Pause
                </SelectItem>
                <SelectItem value="Return" className="text-blue-400 focus:bg-gray-700 focus:text-blue-400">
                    Return
                </SelectItem>
                <SelectItem value="Churn" className="text-red-400 focus:bg-gray-700 focus:text-red-400">
                    Churn
                </SelectItem>
            </SelectContent>
        </Select>
    );
}

// Badge-only version for display in tables
export function ClinicEventBadge({
    eventType,
    isAutoDetected = false
}: {
    eventType: ClinicEventType;
    isAutoDetected?: boolean;
}) {
    if (!eventType) return null;

    const colors = eventColors[eventType];

    return (
        <Badge
            variant="outline"
            className={`${colors.bg} ${colors.text} ${colors.border} ${isAutoDetected ? "opacity-70 border-dashed" : ""
                }`}
        >
            {eventType}
            {isAutoDetected && " ?"}
        </Badge>
    );
}
