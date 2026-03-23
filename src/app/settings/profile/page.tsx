'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/user-avatar'
import { Badge } from '@/components/ui/badge'
import { Camera, Mail, Phone, Building, Shield, Loader2, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/ui/page-header'

const roleLabels: Record<string, { label: string; color: string }> = {
    admin: { label: 'Admin', color: 'bg-red-100 text-red-800' },
    finance_manager: { label: 'Finance Manager', color: 'bg-purple-100 text-purple-800' },
    manager: { label: 'Manager', color: 'bg-purple-100 text-purple-800' },
    analyst: { label: 'Analyst', color: 'bg-blue-100 text-blue-800' },
    editor: { label: 'Editor', color: 'bg-blue-100 text-blue-800' },
    viewer: { label: 'Viewer', color: 'bg-gray-100 text-gray-800' },
}

export default function ProfilePage() {
    const { profile, refreshProfile } = useAuth()
    const { toast } = useToast()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [saving, setSaving] = useState(false)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        department: ''
    })

    useEffect(() => {
        if (profile) {
            setFormData({
                name: profile.name || '',
                email: profile.email || '',
                phone: profile.phone || '',
                department: profile.department || ''
            })
        }
    }, [profile])

    async function handleSave() {
        if (!profile?.id) {
            toast({ title: 'Error', description: 'User not authenticated', variant: 'destructive' })
            return
        }

        setSaving(true)

        try {
            const { error } = await supabase
                .from('users')
                .update({
                    name: formData.name,
                    phone: formData.phone,
                    department: formData.department,
                    updated_at: new Date().toISOString()
                })
                .eq('id', profile.id)

            if (error) throw error

            await refreshProfile()

            toast({ title: 'Profile updated successfully!' })
        } catch (error) {
            console.error('Error saving profile:', error)
            toast({
                title: 'Error saving',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive'
            })
        } finally {
            setSaving(false)
        }
    }

    async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]
        if (!file) return

        // Validar tipo
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        if (!allowedTypes.includes(file.type)) {
            toast({
                title: 'Invalid type',
                description: 'Only JPEG, PNG and WebP are allowed',
                variant: 'destructive'
            })
            return
        }

        if (file.size > 2 * 1024 * 1024) {
            toast({
                title: 'File too large',
                description: 'Maximum size: 2MB',
                variant: 'destructive'
            })
            return
        }

        setUploadingAvatar(true)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.access_token) {
                throw new Error('Not authenticated')
            }

            const formDataUpload = new FormData()
            formDataUpload.append('file', file)

            const response = await fetch('/api/profile/upload-avatar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: formDataUpload
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || result.hint || 'Upload error')
            }

            await refreshProfile()

            toast({ title: 'Avatar updated!' })
        } catch (error) {
            console.error('Upload error:', error)
            toast({
                title: 'Upload error',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive'
            })
        } finally {
            setUploadingAvatar(false)
            // Limpar input
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    if (!profile) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const roleConfig = roleLabels[profile.role] || { label: profile.role, color: 'bg-gray-100 text-gray-800' }

    return (
        <div className="space-y-6">
            <PageHeader title="My Profile" subtitle="Account settings and preferences" />
            <Card>
                <CardHeader>
                    <CardTitle>My Profile</CardTitle>
                    <CardDescription>
                        Manage your personal information
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-start gap-8">
                        <div className="flex flex-col items-center gap-3">
                            <div className="relative">
                                <UserAvatar
                                    user={{
                                        email: profile.email,
                                        name: profile.name,
                                        avatar_url: profile.avatar_url
                                    }}
                                    size="xl"
                                />
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    onChange={handleAvatarUpload}
                                />
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingAvatar}
                                >
                                    {uploadingAvatar ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Camera className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                            <Badge className={roleConfig.color}>
                                <Shield className="h-3 w-3 mr-1" />
                                {roleConfig.label}
                            </Badge>
                            {profile.company_code && (
                                <span className="text-xs text-muted-foreground">
                                    {profile.company_code}
                                </span>
                            )}
                        </div>

                        <div className="flex-1 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Name</label>
                                    <Input
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="email"
                                            value={formData.email}
                                            disabled
                                            className="pl-10 bg-muted"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Email cannot be changed
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Phone</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            className="pl-10"
                                            placeholder="+34 600 000 000"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Department</label>
                                    <div className="relative">
                                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            value={formData.department}
                                            onChange={e => setFormData({ ...formData, department: e.target.value })}
                                            className="pl-10"
                                            placeholder="e.g. Finance"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => refreshProfile()}
                                    disabled={saving}
                                >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Reload
                                </Button>
                                <Button onClick={handleSave} disabled={saving}>
                                    {saving ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        'Save Changes'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Account Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">ID:</span>
                            <span className="ml-2 font-mono text-xs">{profile.id}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Role:</span>
                            <span className="ml-2">{roleConfig.label}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Last login:</span>
                            <span className="ml-2">
                                {profile.last_login_at
                                    ? new Date(profile.last_login_at).toLocaleString('en-US')
                                    : 'Never'
                                }
                            </span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Created at:</span>
                            <span className="ml-2">
                                {profile.created_at
                                    ? new Date(profile.created_at).toLocaleDateString('en-US')
                                    : '-'
                                }
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
