'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Lock, Key, Shield, Smartphone, Clock, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'

export default function SecurityPage() {
    const [settings, setSettings] = useState({
        require2FA: false,
        sessionTimeout: 24,
        passwordMinLength: 8,
        requireSpecialChars: true
    })

    return (
        <div className="space-y-6">
            <PageHeader title="Security" subtitle="Authentication and access control" />
            <Card>
                <CardHeader>
                    <CardTitle>Authentication</CardTitle>
                    <CardDescription>
                        Configure authentication policies
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                            <Smartphone className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Two-Factor Authentication (2FA)</p>
                                <p className="text-sm text-muted-foreground">Require 2FA for all users</p>
                            </div>
                        </div>
                        <Switch
                            checked={settings.require2FA}
                            onCheckedChange={v => setSettings({ ...settings, require2FA: v })}
                        />
                    </div>

                    <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-3 mb-3">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Session Timeout</p>
                                <p className="text-sm text-muted-foreground">Time in hours before requiring a new login</p>
                            </div>
                        </div>
                        <Input
                            type="number"
                            value={settings.sessionTimeout}
                            onChange={e => setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) })}
                            className="w-[100px]"
                            min={1}
                            max={168}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Password Policy</CardTitle>
                    <CardDescription>
                        Define minimum password requirements
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-3 mb-3">
                            <Key className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Minimum Length</p>
                                <p className="text-sm text-muted-foreground">Minimum number of characters</p>
                            </div>
                        </div>
                        <Input
                            type="number"
                            value={settings.passwordMinLength}
                            onChange={e => setSettings({ ...settings, passwordMinLength: parseInt(e.target.value) })}
                            className="w-[100px]"
                            min={6}
                            max={32}
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                            <Shield className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Special Characters</p>
                                <p className="text-sm text-muted-foreground">Require at least one special character</p>
                            </div>
                        </div>
                        <Switch
                            checked={settings.requireSpecialChars}
                            onCheckedChange={v => setSettings({ ...settings, requireSpecialChars: v })}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Active Sessions</CardTitle>
                    <CardDescription>
                        Manage your active sessions on other devices
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                                <p className="font-medium">This device</p>
                                <p className="text-sm text-muted-foreground">Chrome • Linux • Now</p>
                            </div>
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                        </div>
                    </div>

                    <Button variant="destructive" className="mt-4">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        End All Other Sessions
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>
                        Update your access password
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Current Password</label>
                        <Input type="password" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">New Password</label>
                        <Input type="password" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Confirm New Password</label>
                        <Input type="password" />
                    </div>
                    <Button>
                        <Lock className="h-4 w-4 mr-2" />
                        Change Password
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
