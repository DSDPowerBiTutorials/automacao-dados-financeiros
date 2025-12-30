"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface UserProfile {
    id: string;
    email: string;
    name: string;
    role: string;
    company_code: string;
    department?: string;
    phone?: string;
    avatar_url?: string;
    is_active: boolean;
    last_login_at?: string;
}

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: any }>;
    signUp: (email: string, password: string, name: string, role?: string, company_code?: string) => Promise<{ error: any }>;
    signOut: () => Promise<void>;
    hasPermission: (permission: string) => boolean;
    isAdmin: () => boolean;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    // Fetch user profile from users table
    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select(`
          id,
          email,
          name,
          role,
          company_code,
          department,
          phone,
          avatar_url,
          is_active,
          last_login_at
        `)
                .eq('id', userId)
                .single();

            if (error) throw error;
            return data as UserProfile;
        } catch (error) {
            console.error('Error fetching profile:', error);
            return null;
        }
    };

    // Update last login timestamp
    const updateLastLogin = async (userId: string) => {
        try {
            await supabase
                .from('users')
                .update({ last_login_at: new Date().toISOString() })
                .eq('id', userId);
        } catch (error) {
            console.error('Error updating last login:', error);
        }
    };

    // Log audit action
    const logAudit = async (action: string, details?: any) => {
        if (!user) return;

        try {
            await supabase
                .from('audit_log')
                .insert({
                    user_id: user.id,
                    action,
                    details: details || {},
                });
        } catch (error) {
            console.error('Error logging audit:', error);
        }
    };

    // Initialize auth state
    useEffect(() => {
        const initializeAuth = async () => {
            try {
                const { data: { session: currentSession } } = await supabase.auth.getSession();

                if (currentSession?.user) {
                    setSession(currentSession);
                    setUser(currentSession.user);

                    const userProfile = await fetchProfile(currentSession.user.id);
                    setProfile(userProfile);

                    if (userProfile && !userProfile.is_active) {
                        // Don't auto-signout here, let the page handle it
                        console.warn('User account is inactive');
                    }
                }
            } catch (error) {
                console.error('Error initializing auth:', error);
            } finally {
                setLoading(false);
            }
        };

        initializeAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            console.log('Auth event:', event);

            setSession(currentSession);
            setUser(currentSession?.user ?? null);

            if (currentSession?.user) {
                const userProfile = await fetchProfile(currentSession.user.id);
                setProfile(userProfile);

                if (event === 'SIGNED_IN') {
                    await updateLastLogin(currentSession.user.id);
                    await logAudit('login');
                }
            } else {
                setProfile(null);
            }

            setLoading(false);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // Sign in
    const signIn = async (email: string, password: string) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) return { error };

            if (data.user) {
                const userProfile = await fetchProfile(data.user.id);

                if (!userProfile?.is_active) {
                    await supabase.auth.signOut();
                    return { error: { message: 'Account is inactive. Please contact administrator.' } };
                }

                await updateLastLogin(data.user.id);
                await logAudit('login');
                // Don't redirect here - AuthGuard will handle it
            }

            return { error: null };
        } catch (error: any) {
            return { error };
        }
    };

    // Sign up (admin only or self-registration with viewer role)
    const signUp = async (
        email: string,
        password: string,
        name: string,
        role: string = 'viewer',
        company_code: string = 'GLOBAL'
    ) => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) return { error };

            if (data.user) {
                // Create user profile
                const { error: profileError } = await supabase
                    .from('users')
                    .insert({
                        id: data.user.id,
                        email,
                        name,
                        role,
                        company_code,
                        is_active: true,
                    });

                if (profileError) {
                    console.error('Error creating profile:', profileError);
                    return { error: profileError };
                }

                await logAudit('user_created', { email, role, company_code });
            }

            return { error: null };
        } catch (error: any) {
            return { error };
        }
    };

    // Sign out
    const signOut = async () => {
        try {
            await logAudit('logout');
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
            setSession(null);
            router.push('/login');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    // Check if user has specific permission
    const hasPermission = (permission: string): boolean => {
        if (!profile) return false;
        if (!profile.is_active) return false;
        if (profile.role === 'admin') return true;

        // Map roles to permissions
        const rolePermissions: Record<string, string[]> = {
            admin: ['*'],
            finance_manager: ['view_all', 'edit_invoices', 'edit_payments', 'reconcile', 'export_data', 'view_reports', 'edit_master_data'],
            analyst: ['view_all', 'edit_invoices', 'view_reports', 'export_data'],
            viewer: ['view_reports', 'export_data'],
        };

        const permissions = rolePermissions[profile.role] || [];
        return permissions.includes('*') || permissions.includes(permission);
    };

    // Check if user is admin
    const isAdmin = (): boolean => {
        return profile?.role === 'admin' && profile?.is_active === true;
    };

    // Refresh profile data
    const refreshProfile = async () => {
        if (user) {
            const updatedProfile = await fetchProfile(user.id);
            setProfile(updatedProfile);
        }
    };

    const value = {
        user,
        profile,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        hasPermission,
        isAdmin,
        refreshProfile,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

// Permission-based hook
export function usePermission(permission: string) {
    const { hasPermission } = useAuth();
    return hasPermission(permission);
}

// Role-based hook
export function useRole(requiredRole: string | string[]) {
    const { profile } = useAuth();

    if (!profile) return false;

    if (Array.isArray(requiredRole)) {
        return requiredRole.includes(profile.role);
    }

    return profile.role === requiredRole;
}
