import { NextRequest, NextResponse } from 'next/server';
import { getActivityLog } from '@/lib/workstream-api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const data = await getActivityLog(parseInt(id));
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch activity';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
