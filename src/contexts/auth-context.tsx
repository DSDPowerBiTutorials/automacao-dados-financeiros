"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
    timezone?: string;
    is_active: boolean;
    last_login_at?: string;
}

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: any }>;
    signUp: (email: string, password: string, name: string, role?: string, company_code?: string) => Promise<{ error: any }>;
    signOut: () => Promise<void>;
    hasPermission: (permission: string) => boolean;
    isAdmin: () => boolean;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    // Fetch user profile from users table
    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, email, name, role, company_code, department, phone, avatar_url, is_active, last_login_at, created_at')
                .eq('id', userId)
                .maybeSingle(); // Use maybeSingle para não dar erro se não existir

            if (error) {
                console.error('Error fetching profile:', error);
                return null;
            }

            return data as UserProfile | null;
        } catch (error) {
            console.error('Error fetching profile:', error);
            return null;
        }
    };

    // Update last login timestamp (async, não bloqueia login)
    const updateLastLogin = async (userId: string) => {
        try {
            supabase
                .from('users')
                .update({ last_login_at: new Date().toISOString() })
                .eq('id', userId)
                .then(() => console.log('Last login updated'))
                .catch(err => console.error('Error updating last login:', err));
        } catch (error) {
            console.error('Error updating last login:', error);
        }
    };

    // Log audit action (async, não bloqueia login)
    const logAudit = async (action: string, details?: any) => {
        if (!user) return;

        try {
            supabase
                .from('audit_log')
                .insert({
                    user_id: user.id,
                    action,
                    details: details || {},
                })
                .then(() => console.log('Audit logged'))
                .catch(err => console.error('Error logging audit:', err));
        } catch (error) {
            console.error('Error logging audit:', error);
        }
    };

    // Initialize auth state
    useEffect(() => {
        let mounted = true;
        let timeoutId: NodeJS.Timeout;
        let initComplete = false;

        const initializeAuth = async () => {
            try {
                // Timeout de 5 segundos para prevenir loading infinito (reduzido de 10s)
                timeoutId = setTimeout(() => {
                    if (mounted && loading && !initComplete) {
                        console.warn('Auth initialization timeout - forcing loading to false');
                        setLoading(false);
                        initComplete = true;
                    }
                }, 5000);

                const { data: { session: currentSession }, error } = await supabase.auth.getSession();

                if (!mounted) return;

                if (error) {
                    console.error('Error getting session:', error);
                    setSession(null);
                    setUser(null);
                    setProfile(null);
                    setLoading(false);
                    return;
                }

                if (currentSession?.user) {
                    setSession(currentSession);
                    setUser(currentSession.user);

                    const userProfile = await fetchProfile(currentSession.user.id);

                    if (!mounted) return;

                    if (!userProfile) {
                        console.warn('User profile not found');
                        setProfile(null);
                    } else if (!userProfile.is_active) {
                        console.warn('User account is inactive');
                        await supabase.auth.signOut();
                        setSession(null);
                        setUser(null);
                        setProfile(null);
                    } else {
                        setProfile(userProfile);
                    }
                } else {
                    setSession(null);
                    setUser(null);
                    setProfile(null);
                }
            } catch (error) {
                console.error('Error initializing auth:', error);
                if (mounted) {
                    setSession(null);
                    setUser(null);
                    setProfile(null);
                }
            } finally {
                if (mounted) {
                    clearTimeout(timeoutId);
                    setLoading(false);
                    initComplete = true;
                }
            }
        };

        initializeAuth();

        // Listen for auth changes - com debounce para evitar race conditions entre abas
        let authChangeTimeout: NodeJS.Timeout;
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            console.log('Auth event:', event);

            if (!mounted) return;

            // Debounce para evitar múltiplas execuções simultâneas
            clearTimeout(authChangeTimeout);
            authChangeTimeout = setTimeout(async () => {
                if (!mounted) return;

                // Handle token refresh silently
                if (event === 'TOKEN_REFRESHED') {
                    if (currentSession) {
                        setSession(currentSession);
                    }
                    return;
                }

                // Handle sign out event
                if (event === 'SIGNED_OUT') {
                    setSession(null);
                    setUser(null);
                    setProfile(null);
                    return;
                }

                setSession(currentSession);
                setUser(currentSession?.user ?? null);

                if (currentSession?.user) {
                    const userProfile = await fetchProfile(currentSession.user.id);

                    if (!mounted) return;

                    if (!userProfile) {
                        console.warn('Profile not found');
                        setProfile(null);
                    } else if (!userProfile.is_active) {
                        console.warn('User inactive, signing out');
                        await supabase.auth.signOut();
                        setSession(null);
                        setUser(null);
                        setProfile(null);
                    } else {
                        setProfile(userProfile);

                        if (event === 'SIGNED_IN') {
                            await updateLastLogin(currentSession.user.id);
                            await logAudit('login');
                        }
                    }
                } else {
                    setProfile(null);
                }
            }, 100); // 100ms debounce
        });

        return () => {
            mounted = false;
            clearTimeout(authChangeTimeout);
            clearTimeout(timeoutId);
            subscription.unsubscribe();
        };
    }, []);

    // Sign in
    const signIn = async (email: string, password: string, rememberMe: boolean = false) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
                options: {
                    // Se rememberMe for true, sessão persiste por 30 dias
                    // Se false, sessão expira quando o navegador fecha
                    data: {
                        rememberMe
                    }
                }
            });

            if (error) return { error };

            if (data.user) {
                // Se remember me, armazenar flag no localStorage
                if (rememberMe) {
                    localStorage.setItem('rememberMe', 'true');
                } else {
                    localStorage.removeItem('rememberMe');
                }

                // Buscar profile sem bloquear (usar timeout)
                const profilePromise = fetchProfile(data.user.id);
                const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));

                const userProfile = await Promise.race([profilePromise, timeoutPromise]);

                if (userProfile && !userProfile.is_active) {
                    await supabase.auth.signOut();
                    return { error: { message: 'Account is inactive. Please contact administrator.' } };
                }

                // Executar em background (não aguardar)
                updateLastLogin(data.user.id);
                logAudit('login');
            }

            return { error: null };
        } catch (error: any) {
            console.error('Sign in error:', error);
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
            if (user) {
                await logAudit('logout');
            }
        } catch (error) {
            console.error('Error logging audit on signout:', error);
        }

        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Error signing out from Supabase:', error);
        } finally {
            setUser(null);
            setProfile(null);
            setSession(null);
            router.push('/login');
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
