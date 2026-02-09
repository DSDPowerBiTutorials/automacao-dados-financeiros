import { NextRequest, NextResponse } from 'next/server';
import { getProjectMembers, addProjectMember, removeProjectMember } from '@/lib/workstream-api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const data = await getProjectMembers(id);
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch members';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        if (!body.user_id) {
            return NextResponse.json({ success: false, error: 'user_id is required' }, { status: 400 });
        }
        const data = await addProjectMember(id, body.user_id, body.role || 'member');
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to add member';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('user_id');
        if (!userId) {
            return NextResponse.json({ success: false, error: 'user_id query param is required' }, { status: 400 });
        }
        await removeProjectMember(id, userId);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to remove member';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
