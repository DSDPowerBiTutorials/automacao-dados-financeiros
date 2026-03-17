'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            try {
                const code = searchParams.get('code');
                const type = searchParams.get('type');

                if (code) {
                    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                    if (exchangeError) {
                        console.error('Error exchanging code:', exchangeError);
                        setError(exchangeError.message);
                        return;
                    }

                    // For invite and recovery, redirect to set/reset password
                    if (type === 'invite' || type === 'recovery') {
                        router.replace('/reset-password');
                        return;
                    }

                    // For signup confirmation or other, go to dashboard
                    router.replace('/dashboard');
                    return;
                }

                // No code found — check if session already exists from hash detection
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    if (type === 'invite' || type === 'recovery') {
                        router.replace('/reset-password');
                    } else {
                        router.replace('/dashboard');
                    }
                } else {
                    setError('Link de autenticação inválido ou expirado');
                }
            } catch (err) {
                console.error('Auth callback error:', err);
                setError('Erro ao processar autenticação');
            }
        };

        handleCallback();
    }, [router, searchParams]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="text-center max-w-md p-8 bg-white rounded-lg shadow-lg">
                    <h2 className="text-xl font-bold text-red-600 mb-2">Erro de Autenticação</h2>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <a href="/login" className="text-[#243140] hover:underline font-medium">
                        Voltar ao Login
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center space-y-4">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#243140]" />
                <p className="text-gray-600">A processar autenticação...</p>
            </div>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#243140]" />
            </div>
        }>
            <AuthCallbackContent />
        </Suspense>
    );
}
