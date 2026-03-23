'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bell, Mail, MessageSquare, Smartphone } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'

export default function NotificationsPage() {
    const [settings, setSettings] = useState({
        emailEnabled: true,
        pushEnabled: true,
        smsEnabled: false,
        digestFrequency: 'daily',
        taskSuccess: true,
        taskFailure: true,
        reconciliationComplete: true,
        dailyReport: true
    })

    return (
        <div className="space-y-6">
            <PageHeader title="Notification Channels" subtitle="Configure how you receive alerts" />
            <Card>
                <CardHeader>
                    <CardTitle>Notification Channels</CardTitle>
                    <CardDescription>
                        Configure how you want to receive notifications
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                            <Mail className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Email</p>
                                <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                            </div>
                        </div>
                        <Switch
                            checked={settings.emailEnabled}
                            onCheckedChange={v => setSettings({ ...settings, emailEnabled: v })}
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                            <Bell className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Push (Browser)</p>
                                <p className="text-sm text-muted-foreground">Browser push notifications</p>
                            </div>
                        </div>
                        <Switch
                            checked={settings.pushEnabled}
                            onCheckedChange={v => setSettings({ ...settings, pushEnabled: v })}
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                            <Smartphone className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">SMS</p>
                                <p className="text-sm text-muted-foreground">Text messages (critical only)</p>
                            </div>
                        </div>
                        <Switch
                            checked={settings.smsEnabled}
                            onCheckedChange={v => setSettings({ ...settings, smsEnabled: v })}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Notification Types</CardTitle>
                    <CardDescription>
                        Choose which events should generate notifications
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <p className="font-medium">Tasks Completed</p>
                            <p className="text-sm text-muted-foreground">When a BOT task finishes successfully</p>
                        </div>
                        <Switch
                            checked={settings.taskSuccess}
                            onCheckedChange={v => setSettings({ ...settings, taskSuccess: v })}
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <p className="font-medium">Task Failures</p>
                            <p className="text-sm text-muted-foreground">When a BOT task fails</p>
                        </div>
                        <Switch
                            checked={settings.taskFailure}
                            onCheckedChange={v => setSettings({ ...settings, taskFailure: v })}
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <p className="font-medium">Reconciliation Complete</p>
                            <p className="text-sm text-muted-foreground">When automatic reconciliation finishes</p>
                        </div>
                        <Switch
                            checked={settings.reconciliationComplete}
                            onCheckedChange={v => setSettings({ ...settings, reconciliationComplete: v })}
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <p className="font-medium">Daily Report</p>
                            <p className="text-sm text-muted-foreground">Daily activity summary</p>
                        </div>
                        <Switch
                            checked={settings.dailyReport}
                            onCheckedChange={v => setSettings({ ...settings, dailyReport: v })}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Digest Frequency</CardTitle>
                    <CardDescription>
                        How often you want to receive the activity summary
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Select
                        value={settings.digestFrequency}
                        onValueChange={v => setSettings({ ...settings, digestFrequency: v })}
                    >
                        <SelectTrigger className="w-[200px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="realtime">Real Time</SelectItem>
                            <SelectItem value="hourly">Hourly</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="never">Never</SelectItem>
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>
        </div>
    )
}
