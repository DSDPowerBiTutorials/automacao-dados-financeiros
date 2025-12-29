"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Users, Globe, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface OverviewCardsProps {
    data: {
        totalPayables: number;
        totalReceivables: number;
        reconciledPercentage: number;
        activeEntities: number;
        activeUsers: number;
        lastSync: string;
    };
}

export function OverviewCards({ data }: OverviewCardsProps) {
    const cards = [
        {
            title: 'Total Payables',
            value: formatCurrency(data.totalPayables, 'EUR'),
            icon: TrendingDown,
            color: 'text-red-600',
            bgColor: 'bg-red-50',
            description: 'Outstanding liabilities',
        },
        {
            title: 'Total Receivables',
            value: formatCurrency(data.totalReceivables, 'EUR'),
            icon: TrendingUp,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
            description: 'Expected revenues',
        },
        {
            title: 'Reconciliation Rate',
            value: `${data.reconciledPercentage}%`,
            icon: DollarSign,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            description: 'Payment matching accuracy',
        },
        {
            title: 'Active Entities',
            value: data.activeEntities.toString(),
            icon: Globe,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            description: 'Spain, USA',
        },
        {
            title: 'Active Users',
            value: data.activeUsers.toString(),
            icon: Users,
            color: 'text-amber-600',
            bgColor: 'bg-amber-50',
            description: 'System users',
        },
        {
            title: 'Last Sync',
            value: new Date(data.lastSync).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            }),
            icon: Calendar,
            color: 'text-gray-600',
            bgColor: 'bg-gray-50',
            description: 'Data synchronization',
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card, index) => {
                const Icon = card.icon;
                return (
                    <Card key={index} className="hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-gray-600">
                                {card.title}
                            </CardTitle>
                            <div className={`${card.bgColor} p-2 rounded-lg`}>
                                <Icon className={`h-4 w-4 ${card.color}`} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-gray-900">
                                {card.value}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                {card.description}
                            </p>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
