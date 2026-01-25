"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/user-avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Camera, Trash2, Save, Lock, User, Mail, Building2, Phone, Calendar } from 'lucide-react';
import { formatTimestamp } from '@/lib/formatters';

export default function ProfilePage() {
    const { user, profile, refreshProfile } = useAuth();
    const { toast } = useToast();

    // Profile data state
    const [name, setName] = useState('');
    const [department, setDepartment] = useState('');
    const [phone, setPhone] = useState('');
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

    // Password state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // Avatar state
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load profile data
    useEffect(() => {
        if (profile) {
            setName(profile.name || '');
            setDepartment(profile.department || '');
            setPhone(profile.phone || '');
            setAvatarUrl(profile.avatar_url || null);
        }
    }, [profile]);

    const handleUpdateProfile = async () => {
        if (!user) return;

        try {
            setIsUpdatingProfile(true);

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No session');

            const response = await fetch('/api/profile', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    name,
                    department,
                    phone,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update profile');
            }

            await refreshProfile();

            toast({
                title: 'Success',
                description: 'Profile updated successfully',
            });
        } catch (error: any) {
            console.error('Error updating profile:', error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to update profile',
                variant: 'destructive',
            });
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const handleChangePassword = async () => {
        if (!user) return;

        if (newPassword !== confirmPassword) {
            toast({
                title: 'Error',
                description: 'Passwords do not match',
                variant: 'destructive',
            });
            return;
        }

        if (newPassword.length < 6) {
            toast({
                title: 'Error',
                description: 'Password must be at least 6 characters',
                variant: 'destructive',
            });
            return;
        }

        try {
            setIsChangingPassword(true);

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No session');

            const response = await fetch('/api/profile/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to change password');
            }

            toast({
                title: 'Success',
                description: 'Password changed successfully',
            });

            // Clear password fields
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            console.error('Error changing password:', error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to change password',
                variant: 'destructive',
            });
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user) return;

        try {
            setIsUploadingAvatar(true);

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No session');

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/profile/upload-avatar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                // Mostrar dica se for erro de configuração
                if (data.hint) {
                    throw new Error(`${data.error}\n\nDica: ${data.hint}`);
                }
                throw new Error(data.error || 'Failed to upload avatar');
            }

            setAvatarUrl(data.avatar_url);
            await refreshProfile();

            toast({
                title: 'Success',
                description: 'Avatar uploaded successfully',
            });
        } catch (error: any) {
            console.error('Error uploading avatar:', error);

            // Mostrar mensagem mais detalhada
            const errorMessage = error.message || 'Failed to upload avatar';
            const isConfigError = errorMessage.includes('bucket') || errorMessage.includes('policy');

            toast({
                title: isConfigError ? 'Configuration Error' : 'Error',
                description: errorMessage,
                variant: 'destructive',
                duration: isConfigError ? 10000 : 5000, // Mostrar mais tempo se for erro de config
            });
        } finally {
            setIsUploadingAvatar(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDeleteAvatar = async () => {
        if (!user) return;

        try {
            setIsDeletingAvatar(true);

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No session');

            const response = await fetch('/api/profile/upload-avatar', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete avatar');
            }

            setAvatarUrl(null);
            await refreshProfile();

            toast({
                title: 'Success',
                description: 'Avatar removed successfully',
            });
        } catch (error: any) {
            console.error('Error deleting avatar:', error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to delete avatar',
                variant: 'destructive',
            });
        } finally {
            setIsDeletingAvatar(false);
        }
    };

    const getInitials = () => {
        if (!profile?.name) return 'U';
        return profile.name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    if (!user || !profile) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4 max-w-4xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
                <p className="text-gray-600 mt-2">Manage your account settings and preferences</p>
            </div>

            <div className="space-y-6">
                {/* Avatar Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Profile Picture</CardTitle>
                        <CardDescription>Upload or remove your profile picture</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-6">
                            <UserAvatar 
                                user={profile} 
                                size="xl" 
                                className="h-24 w-24"
                            />
                            <div className="flex flex-col gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleAvatarUpload}
                                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                                    className="hidden"
                                />
                                <Button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploadingAvatar}
                                    variant="outline"
                                >
                                    {isUploadingAvatar ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <Camera className="mr-2 h-4 w-4" />
                                            Upload Photo
                                        </>
                                    )}
                                </Button>
                                {avatarUrl && (
                                    <Button
                                        onClick={handleDeleteAvatar}
                                        disabled={isDeletingAvatar}
                                        variant="outline"
                                        className="text-red-600 hover:text-red-700"
                                    >
                                        {isDeletingAvatar ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Removing...
                                            </>
                                        ) : (
                                            <>
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Remove Photo
                                            </>
                                        )}
                                    </Button>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                    JPG, PNG, WebP or GIF. Max 2MB.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Personal Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>Personal Information</CardTitle>
                        <CardDescription>Update your personal details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">
                                    <User className="inline h-4 w-4 mr-2" />
                                    Full Name
                                </Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter your full name"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">
                                    <Mail className="inline h-4 w-4 mr-2" />
                                    Email (Read-only)
                                </Label>
                                <Input
                                    id="email"
                                    value={profile.email}
                                    disabled
                                    className="bg-gray-50"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="department">
                                    <Building2 className="inline h-4 w-4 mr-2" />
                                    Department
                                </Label>
                                <Input
                                    id="department"
                                    value={department}
                                    onChange={(e) => setDepartment(e.target.value)}
                                    placeholder="e.g., Finance, IT, Marketing"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">
                                    <Phone className="inline h-4 w-4 mr-2" />
                                    Phone
                                </Label>
                                <Input
                                    id="phone"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+351 123 456 789"
                                />
                            </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                            <div>
                                <span className="font-medium">Role:</span> {profile.role}
                            </div>
                            <div>
                                <span className="font-medium">Company:</span> {profile.company_code}
                            </div>
                            {profile.last_login_at && (
                                <div className="col-span-2">
                                    <Calendar className="inline h-4 w-4 mr-2" />
                                    <span className="font-medium">Last Login:</span>{' '}
                                    {formatTimestamp(profile.last_login_at)}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end">
                            <Button
                                onClick={handleUpdateProfile}
                                disabled={isUpdatingProfile}
                            >
                                {isUpdatingProfile ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Change Password */}
                <Card>
                    <CardHeader>
                        <CardTitle>Change Password</CardTitle>
                        <CardDescription>Update your password to keep your account secure</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="currentPassword">
                                <Lock className="inline h-4 w-4 mr-2" />
                                Current Password
                            </Label>
                            <Input
                                id="currentPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Enter your current password"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="newPassword">New Password</Label>
                            <Input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter new password (min 6 characters)"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm New Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm your new password"
                            />
                        </div>

                        <div className="flex justify-end">
                            <Button
                                onClick={handleChangePassword}
                                disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                            >
                                {isChangingPassword ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Changing Password...
                                    </>
                                ) : (
                                    <>
                                        <Lock className="mr-2 h-4 w-4" />
                                        Change Password
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Account Information (Read-only) */}
                <Card className="bg-gray-50">
                    <CardHeader>
                        <CardTitle>Account Information</CardTitle>
                        <CardDescription>Your account details (read-only)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="font-medium text-gray-700">User ID:</span>
                            <span className="text-gray-600 font-mono text-xs">{user.id}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-medium text-gray-700">Account Status:</span>
                            <span className={`font-medium ${profile.is_active ? 'text-green-600' : 'text-red-600'}`}>
                                {profile.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
