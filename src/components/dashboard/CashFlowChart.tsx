"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CashFlowChartProps {
    data: Array<{
        month: string;
        inflow: number;
        outflow: number;
        net: number;
    }>;
}

export function CashFlowChart({ data }: CashFlowChartProps) {
    const formatValue = (value: number) => {
        return `€${(value / 1000).toFixed(0)}K`;
    };

    return (
        <Card className="col-span-full">
            <CardHeader>
                <CardTitle>Cash Flow Evolution</CardTitle>
                <CardDescription>
                    12-month trend of cash inflows and outflows
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                            dataKey="month"
                            stroke="#888"
                            style={{ fontSize: '12px' }}
                        />
                        <YAxis
                            stroke="#888"
                            style={{ fontSize: '12px' }}
                            tickFormatter={formatValue}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '12px'
                            }}
                            formatter={(value: number) => [`€${value.toLocaleString()}`, '']}
                        />
                        <Legend
                            wrapperStyle={{ paddingTop: '20px' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="inflow"
                            stroke="#10b981"
                            strokeWidth={2}
                            name="Cash Inflow"
                            dot={{ fill: '#10b981', r: 4 }}
                            activeDot={{ r: 6 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="outflow"
                            stroke="#ef4444"
                            strokeWidth={2}
                            name="Cash Outflow"
                            dot={{ fill: '#ef4444', r: 4 }}
                            activeDot={{ r: 6 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="net"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            name="Net Cash Flow"
                            dot={{ fill: '#3b82f6', r: 5 }}
                            activeDot={{ r: 7 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
