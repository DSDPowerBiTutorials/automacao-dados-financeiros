"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
    SUPPORTED_TIMEZONES,
    SupportedTimezone,
    formatDateForUserTimezone,
    formatDateTimeForUserTimezone,
    getTimezoneOffsetLabel,
    formatRelativeTimeForUser
} from '@/lib/date-utils';

// Reference timezone - ALL data is stored in Madrid timezone
const REFERENCE_TIMEZONE = 'Europe/Madrid';

interface TimezoneContextType {
    // User's display timezone (for viewing dates in their local time)
    userTimezone: string;
    // Set user's display timezone
    setUserTimezone: (tz: string) => void;
    // Reference timezone (always Madrid)
    referenceTimezone: string;
    // List of supported timezones
    supportedTimezones: typeof SUPPORTED_TIMEZONES;
    // Format date for display in user's timezone
    formatDate: (dateString: string | Date | null | undefined, locale?: string) => string;
    // Format datetime for display in user's timezone  
    formatDateTime: (dateString: string | Date | null | undefined, locale?: string) => string;
    // Format relative time in user's timezone
    formatRelativeTime: (dateString: string | Date | null | undefined) => string;
    // Get offset label (e.g., "-4h from Spain")
    getOffsetLabel: () => string;
    // Is the user in a different timezone than Spain?
    isDifferentTimezone: boolean;
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

interface TimezoneProviderProps {
    children: ReactNode;
    initialTimezone?: string;
}

export function TimezoneProvider({ children, initialTimezone }: TimezoneProviderProps) {
    const [userTimezone, setUserTimezoneState] = useState<string>(initialTimezone || REFERENCE_TIMEZONE);

    // Check if user is in a different timezone than Spain
    const isDifferentTimezone = userTimezone !== REFERENCE_TIMEZONE;

    // Format date for user's timezone
    const formatDate = useCallback((
        dateString: string | Date | null | undefined,
        locale: string = 'es-ES'
    ): string => {
        return formatDateForUserTimezone(dateString, userTimezone, locale);
    }, [userTimezone]);

    // Format datetime for user's timezone
    const formatDateTime = useCallback((
        dateString: string | Date | null | undefined,
        locale: string = 'es-ES'
    ): string => {
        return formatDateTimeForUserTimezone(dateString, userTimezone, locale);
    }, [userTimezone]);

    // Format relative time for user's timezone
    const formatRelativeTime = useCallback((
        dateString: string | Date | null | undefined
    ): string => {
        return formatRelativeTimeForUser(dateString, userTimezone);
    }, [userTimezone]);

    // Get offset label
    const getOffsetLabel = useCallback((): string => {
        return getTimezoneOffsetLabel(userTimezone);
    }, [userTimezone]);

    // Update timezone and save preference
    const setUserTimezone = useCallback((tz: string) => {
        setUserTimezoneState(tz);
        // Save to localStorage for persistence
        if (typeof window !== 'undefined') {
            localStorage.setItem('user-timezone', tz);
        }
    }, []);

    // Load timezone from localStorage on mount
    useEffect(() => {
        if (typeof window !== 'undefined' && !initialTimezone) {
            const savedTz = localStorage.getItem('user-timezone');
            if (savedTz) {
                setUserTimezoneState(savedTz);
            }
        }
    }, [initialTimezone]);

    const value: TimezoneContextType = {
        userTimezone,
        setUserTimezone,
        referenceTimezone: REFERENCE_TIMEZONE,
        supportedTimezones: SUPPORTED_TIMEZONES,
        formatDate,
        formatDateTime,
        formatRelativeTime,
        getOffsetLabel,
        isDifferentTimezone,
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
