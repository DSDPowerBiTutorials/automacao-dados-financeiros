import { NextRequest, NextResponse } from 'next/server';
import { getUsers } from '@/lib/workstream-api';

export async function GET() {
    try {
        const data = await getUsers();
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch users';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
