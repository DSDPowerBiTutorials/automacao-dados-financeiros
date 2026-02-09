import { NextRequest, NextResponse } from 'next/server';
import { getComments, createComment } from '@/lib/workstream-api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const data = await getComments(parseInt(id));
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch comments';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        if (!body.content?.trim() || !body.user_id) {
            return NextResponse.json({ success: false, error: 'content and user_id are required' }, { status: 400 });
        }
        const data = await createComment({ task_id: parseInt(id), user_id: body.user_id, content: body.content });
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create comment';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
