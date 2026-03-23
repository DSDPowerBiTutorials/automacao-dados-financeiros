'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plug, RefreshCw, CheckCircle2, XCircle, Settings, ExternalLink } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'

const integrations = [
    {
        name: 'Braintree',
        description: 'Payment processing',
        status: 'active',
        lastSync: '2026-01-25T08:00:00',
        icon: '💳'
    },
    {
        name: 'Stripe',
        description: 'Payments and subscriptions',
        status: 'active',
        lastSync: '2026-01-25T08:00:00',
        icon: '💰'
    },
    {
        name: 'GoCardless',
        description: 'SEPA direct debit',
        status: 'active',
        lastSync: '2026-01-25T07:00:00',
        icon: '🏦'
    },
    {
        name: 'HubSpot',
        description: 'CRM and customer management',
        status: 'active',
        lastSync: '2026-01-25T06:00:00',
        icon: '📊'
    },
    {
        name: 'QuickBooks',
        description: 'Accounting',
        status: 'inactive',
        lastSync: null,
        icon: '📒'
    },
    {
        name: 'Slack',
        description: 'Notifications and alerts',
        status: 'inactive',
        lastSync: null,
        icon: '💬'
    }
]

export default function IntegrationsPage() {
    function formatDate(date: string | null): string {
        if (!date) return 'Never'
        return new Date(date).toLocaleString('en-US')
    }

    return (
        <div className="space-y-6">
            <PageHeader title="Integrations" subtitle="Connected services and APIs" />
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Integrations</CardTitle>
                            <CardDescription>
                                Manage connections with external services
                            </CardDescription>
                        </div>
                        <Button>
                            <Plug className="h-4 w-4 mr-2" />
                            New Integration
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {integrations.map(integration => (
                            <div
                                key={integration.name}
                                className={`flex items-center justify-between p-4 border rounded-lg ${integration.status === 'active' ? 'bg-white dark:bg-black' : 'bg-gray-50 dark:bg-gray-900'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="text-3xl">{integration.icon}</div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{integration.name}</span>
                                            {integration.status === 'active' ? (
                                                <Badge className="bg-green-100 text-green-800 gap-1">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    Connected
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="gap-1">
                                                    <XCircle className="h-3 w-3" />
                                                    Disconnected
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {integration.description}
                                        </p>
                                        {integration.lastSync && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Last sync: {formatDate(integration.lastSync)}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {integration.status === 'active' ? (
                                        <>
                                            <Button variant="outline" size="sm">
                                                <RefreshCw className="h-4 w-4 mr-1" />
                                                Sync
                                            </Button>
                                            <Button variant="ghost" size="sm">
                                                <Settings className="h-4 w-4" />
                                            </Button>
                                        </>
                                    ) : (
                                        <Button size="sm">
                                            <ExternalLink className="h-4 w-4 mr-1" />
                                            Connect
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>API Keys</CardTitle>
                    <CardDescription>
                        Manage API keys for programmatic access
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <Plug className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No API keys configured</p>
                        <Button variant="outline" className="mt-4">
                            Generate API Key
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
