"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface VendorChartProps {
    data: Array<{
        name: string;
        amount: number;
    }>;
}

export function VendorChart({ data }: VendorChartProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Top Vendors</CardTitle>
                <CardDescription>
                    Highest spending by provider
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                            dataKey="name"
                            stroke="#888"
                            style={{ fontSize: '11px' }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                        />
                        <YAxis
                            stroke="#888"
                            style={{ fontSize: '12px' }}
                            tickFormatter={(value) => `€${(value / 1000).toFixed(0)}K`}
                        />
                        <Tooltip
                            formatter={(value: number) => [`€${value.toLocaleString()}`, 'Amount']}
                            contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '12px'
                            }}
                        />
                        <Bar
                            dataKey="amount"
                            fill="#243140"
                            radius={[8, 8, 0, 0]}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
