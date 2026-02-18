'use client';

import { useState } from 'react';
import {
    Target,
    Plus,
    TrendingUp,
    Calendar,
    Users,
    CheckCircle2,
    Circle,
    ChevronRight,
} from 'lucide-react';

interface Goal {
    id: string;
    title: string;
    description: string;
    progress: number;
    status: 'on_track' | 'at_risk' | 'behind';
    owner: string;
    due_date: string;
    team: string;
}

// Static goals for now — will connect to database later
const SAMPLE_GOALS: Goal[] = [
    {
        id: '1',
        title: 'Complete Q1 Financial Reconciliation',
        description: 'Ensure all Q1 bank statements are reconciled across all payment channels',
        progress: 75,
        status: 'on_track',
        owner: 'Jorge',
        due_date: '2026-03-31',
        team: 'Finance',
    },
    {
        id: '2',
        title: 'Reduce Invoice Processing Time by 30%',
        description: 'Automate invoice approval workflows and reduce manual data entry',
        progress: 45,
        status: 'at_risk',
        owner: 'Fernando',
        due_date: '2026-06-30',
        team: 'Operations',
    },
    {
        id: '3',
        title: 'Onboard 3 New Payment Channels',
        description: 'Integrate new payment processors into the reconciliation system',
        progress: 33,
        status: 'on_track',
        owner: 'Jorge',
        due_date: '2026-06-30',
        team: 'Engineering',
    },
];

const statusConfig = {
    on_track: { label: 'On Track', color: 'text-green-400', bg: 'bg-green-500/10', barColor: 'bg-green-500' },
    at_risk: { label: 'At Risk', color: 'text-yellow-400', bg: 'bg-yellow-500/10', barColor: 'bg-yellow-500' },
    behind: { label: 'Behind', color: 'text-red-400', bg: 'bg-red-500/10', barColor: 'bg-red-500' },
};

export default function GoalsPage() {
    const [goals] = useState<Goal[]>(SAMPLE_GOALS);

    const onTrackCount = goals.filter(g => g.status === 'on_track').length;
    const atRiskCount = goals.filter(g => g.status === 'at_risk').length;
    const behindCount = goals.filter(g => g.status === 'behind').length;

    return (
        <div className="h-full overflow-y-auto bg-white dark:bg-[#1e1f21]">
            <div className="max-w-5xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Target className="h-6 w-6" />
                            Goals
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                            Track company and team goals
                        </p>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
                        <Plus className="h-4 w-4" />
                        Add Goal
                    </button>
                </div>

                {/* Status summary */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-gray-50 dark:bg-[#2a2b2d] border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">On Track</span>
                        </div>
                        <p className="text-2xl font-bold text-green-400">{onTrackCount}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-[#2a2b2d] border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">At Risk</span>
                        </div>
                        <p className="text-2xl font-bold text-yellow-400">{atRiskCount}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-[#2a2b2d] border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Behind</span>
                        </div>
                        <p className="text-2xl font-bold text-red-400">{behindCount}</p>
                    </div>
                </div>

                {/* Goals list */}
                <div className="space-y-3">
                    {goals.map((goal) => {
                        const config = statusConfig[goal.status];
                        return (
                            <div
                                key={goal.id}
                                className="bg-gray-50 dark:bg-[#2a2b2d] border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:bg-gray-100 dark:hover:bg-[#333435] transition-colors cursor-pointer"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0 pt-1">
                                        <Target className="h-5 w-5 text-gray-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">{goal.title}</h3>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${config.color} ${config.bg}`}>
                                                {config.label}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mb-3">{goal.description}</p>

                                        {/* Progress bar */}
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${config.barColor} rounded-full transition-all`}
                                                    style={{ width: `${goal.progress}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{goal.progress}%</span>
                                        </div>

                                        {/* Meta info */}
                                        <div className="flex items-center gap-4 text-[10px] text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <Users className="h-3 w-3" />
                                                {goal.owner}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                Due {new Date(goal.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <TrendingUp className="h-3 w-3" />
                                                {goal.team}
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-gray-600 flex-shrink-0 mt-1" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
