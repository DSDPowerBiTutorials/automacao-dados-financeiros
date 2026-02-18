"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, Mail, AlertCircle } from 'lucide-react';
import Image from 'next/image';

export function LoginForm() {
    const { signIn } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { error: signInError } = await signIn(email, password, rememberMe);

            if (signInError) {
                setError(signInError.message || 'Invalid email or password');
            } else {
                // Login successful - redirect to dashboard
                router.push('/dashboard');
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred during login');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4">
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="/LoginBackgroundLogo.png"
                    alt="DSD Background"
                    fill
                    className="object-cover"
                    priority
                />
                {/* Overlay escuro para melhor legibilidade */}
                <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/50 to-[#243140]/70" />
            </div>

            {/* Login Card - Centralizado */}
            <Card className="relative z-10 w-full max-w-md shadow-2xl border-0 bg-white/95 dark:bg-[#1e1f21]/95 backdrop-blur-sm">
                <CardHeader className="space-y-4 text-center pb-8 pt-10">
                    {/* Logo e Título */}
                    <div className="mx-auto space-y-4">
                        <div className="flex items-center justify-center gap-3">
                            <Image
                                src="/favicon-32x32.png"
                                alt="DSD Logo"
                                width={40}
                                height={40}
                                className="w-10 h-10"
                                priority
                            />
                            <h1 className="text-2xl font-bold text-[#243140]">
                                DSD Finance Hub
                            </h1>
                        </div>
                        <CardDescription className="text-sm text-gray-600 font-medium tracking-wide">
                            In-house code. Shaped by how we work.
                        </CardDescription>
                    </div>
                    <div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
                </CardHeader>

                <CardContent className="pb-10">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <Alert variant="destructive" className="border-red-200 bg-red-50">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription className="font-medium">{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-semibold text-gray-700">
                                Email Address
                            </Label>
                            <div className="relative">
                                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="your.email@digitalsmiledesign.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="!pl-12 h-12 border-gray-300 text-base focus:border-gray-200 dark:border-[#243140] focus:ring-[#243140] rounded-lg"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                                Password
                            </Label>
                            <div className="relative">
                                <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="!pl-12 h-12 border-gray-300 text-base focus:border-gray-200 dark:border-[#243140] focus:ring-[#243140] rounded-lg"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 py-2">
                            <input
                                id="remember"
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-4 w-4 text-[#243140] focus:ring-[#243140] border-gray-300 rounded cursor-pointer"
                                disabled={loading}
                            />
                            <Label htmlFor="remember" className="text-sm font-medium text-gray-700 cursor-pointer">
                                Keep me signed in for 30 days
                            </Label>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 bg-gradient-to-r from-[#243140] to-[#1a2530] hover:from-[#1a2530] hover:to-[#0f1419] text-white font-semibold text-base rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    <Lock className="mr-2 h-5 w-5" />
                                    Sign In
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 text-center text-sm text-gray-600 space-y-1">
                        <p className="font-medium">Need access?</p>
                        <p className="text-gray-500">
                            Contact your system administrator
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Footer */}
            <div className="absolute bottom-6 left-0 right-0 text-center z-10">
                <p className="text-sm text-gray-900 dark:text-white/90 font-medium drop-shadow-lg">
                    © 2025 Digital Smile Design. All rights reserved.
                </p>
            </div>
        </div>
    );
}
