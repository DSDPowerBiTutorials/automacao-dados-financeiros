'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 8) {
            setError('A password deve ter pelo menos 8 caracteres');
            return;
        }

        if (password !== confirmPassword) {
            setError('As passwords não coincidem');
            return;
        }

        setLoading(true);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password,
            });

            if (updateError) {
                setError(updateError.message);
            } else {
                setSuccess(true);
                setTimeout(() => {
                    router.push('/dashboard');
                }, 2000);
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao atualizar password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4">
            <div className="absolute inset-0 z-0">
                <Image
                    src="/LoginBackgroundLogo.png"
                    alt="DSD Background"
                    fill
                    className="object-cover"
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/50 to-[#243140]/70" />
            </div>

            <Card className="relative z-10 w-full max-w-md shadow-2xl border-0 bg-white/95 dark:bg-black/95 backdrop-blur-sm">
                <CardHeader className="space-y-4 text-center pb-8 pt-10">
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
                        <p className="text-sm text-gray-600 font-medium">
                            Set your password
                        </p>
                    </div>
                    <div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
                </CardHeader>

                <CardContent className="pb-10">
                    {success ? (
                        <div className="text-center space-y-4">
                            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
                            <h3 className="font-semibold text-lg">Password updated!</h3>
                            <p className="text-gray-600 text-sm">
                                Redirecting to dashboard...
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <Alert variant="destructive" className="border-red-200 bg-red-50">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription className="font-medium">{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                                    New Password
                                </Label>
                                <div className="relative">
                                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="Minimum 8 characters"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="!pl-12 h-12 border-gray-300 text-base rounded-lg"
                                        required
                                        disabled={loading}
                                        minLength={8}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirm" className="text-sm font-semibold text-gray-700">
                                    Confirm Password
                                </Label>
                                <div className="relative">
                                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                                    <Input
                                        id="confirm"
                                        type="password"
                                        placeholder="Repeat your password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="!pl-12 h-12 border-gray-300 text-base rounded-lg"
                                        required
                                        disabled={loading}
                                        minLength={8}
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-12 bg-gradient-to-r from-[#243140] to-[#1a2530] hover:from-[#1a2530] hover:to-[#0f1419] text-white font-semibold text-base rounded-lg shadow-lg"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    'Set Password'
                                )}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>

            <div className="absolute bottom-6 left-0 right-0 text-center z-10">
                <p className="text-sm text-gray-900 dark:text-white/90 font-medium drop-shadow-lg">
                    © 2025 Digital Smile Design. All rights reserved.
                </p>
            </div>
        </div>
    );
}
