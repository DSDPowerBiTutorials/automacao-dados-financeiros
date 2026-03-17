'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import Image from 'next/image';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.dsdfinancehub.com';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${SITE_URL}/auth/callback?type=recovery`,
            });

            if (resetError) {
                setError(resetError.message);
            } else {
                setSent(true);
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao enviar email');
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
                            Reset your password
                        </p>
                    </div>
                    <div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
                </CardHeader>

                <CardContent className="pb-10">
                    {sent ? (
                        <div className="text-center space-y-4">
                            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
                            <h3 className="font-semibold text-lg">Email sent!</h3>
                            <p className="text-gray-600 text-sm">
                                Check your inbox for <strong>{email}</strong>.
                                <br />
                                Click the link in the email to reset your password.
                            </p>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 text-[#243140] hover:underline font-medium text-sm mt-4"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back to Login
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <Alert variant="destructive" className="border-red-200 bg-red-50">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription className="font-medium">{error}</AlertDescription>
                                </Alert>
                            )}

                            <p className="text-sm text-gray-600">
                                Enter your email address and we&apos;ll send you a link to reset your password.
                            </p>

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-semibold text-gray-700">
                                    Email Address
                                </Label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="your.email@digitalsmiledesign.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="!pl-12 h-12 border-gray-300 text-base rounded-lg"
                                        required
                                        disabled={loading}
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
                                        Sending...
                                    </>
                                ) : (
                                    'Send Reset Link'
                                )}
                            </Button>

                            <div className="text-center">
                                <Link
                                    href="/login"
                                    className="inline-flex items-center gap-2 text-[#243140] hover:underline font-medium text-sm"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Back to Login
                                </Link>
                            </div>
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
