"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import {
    formatDateForDisplay,
    formatDateTimeForDisplay,
    getMadridDate,
    getCurrentDateForDB
} from '@/lib/date-utils';

// REFERENCE TIMEZONE - ALL dates are displayed in Madrid timezone
// No conversions, no local timezone considerations
// Everyone sees the same date/time regardless of where they are
const REFERENCE_TIMEZONE = 'Europe/Madrid';

interface TimezoneContextType {
    // Reference timezone (always Madrid - for display everywhere)
    referenceTimezone: string;
    // Format date for display (always Madrid timezone)
    formatDate: (dateString: string | Date | null | undefined, locale?: string) => string;
    // Format datetime for display (always Madrid timezone)
    formatDateTime: (dateString: string | Date | null | undefined, locale?: string) => string;
    // Get current date in Madrid timezone
    getCurrentDate: () => Date;
    // Get current date string for DB (YYYY-MM-DD in Madrid timezone)
    getCurrentDateString: () => string;
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

interface TimezoneProviderProps {
    children: ReactNode;
}

export function TimezoneProvider({ children }: TimezoneProviderProps) {
    // Format date - ALWAYS Madrid timezone, no conversions
    const formatDate = (
        dateString: string | Date | null | undefined,
        locale: string = 'es-ES'
    ): string => {
        return formatDateForDisplay(dateString, locale);
    };

    // Format datetime - ALWAYS Madrid timezone, no conversions
    const formatDateTime = (
        dateString: string | Date | null | undefined,
        locale: string = 'es-ES'
    ): string => {
        return formatDateTimeForDisplay(dateString, locale);
    };

    // Get current date in Madrid timezone
    const getCurrentDate = (): Date => {
        return getMadridDate();
    };

    // Get current date string for DB
    const getCurrentDateString = (): string => {
        return getCurrentDateForDB();
    };

    const value: TimezoneContextType = {
        referenceTimezone: REFERENCE_TIMEZONE,
        formatDate,
        formatDateTime,
        getCurrentDate,
        getCurrentDateString,
    };

    return (
        <TimezoneContext.Provider value={value}>
            {children}
        </TimezoneContext.Provider>
    );
}

export function useTimezone(): TimezoneContextType {
    const context = useContext(TimezoneContext);
    if (context === undefined) {
        throw new Error('useTimezone must be used within a TimezoneProvider');
    }
    return context;
}

// Optional hook for components that may not have the provider
export function useTimezoneOptional(): TimezoneContextType | null {
    const context = useContext(TimezoneContext);
    return context || null;
}
