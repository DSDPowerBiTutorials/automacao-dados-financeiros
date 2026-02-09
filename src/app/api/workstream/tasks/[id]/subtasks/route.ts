import { NextRequest, NextResponse } from 'next/server';
import { getSubtasks, createTask } from '@/lib/workstream-api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const data = await getSubtasks(parseInt(id));
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch subtasks';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const parentTaskId = parseInt(id);

        if (!body.title?.trim()) {
            return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 });
        }

        const data = await createTask({
            title: body.title.trim(),
            section_id: body.section_id,
            project_id: body.project_id,
            parent_task_id: parentTaskId,
            status: 'todo',
            priority: 'medium',
            position: body.position || 0,
        } as Parameters<typeof createTask>[0] & { parent_task_id: number });

        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create subtask';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
