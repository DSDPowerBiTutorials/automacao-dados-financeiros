import { NextRequest, NextResponse } from 'next/server';
import { getTaskDependencies, addTaskDependency, removeTaskDependency } from '@/lib/workstream-api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const data = await getTaskDependencies(parseInt(id));
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch dependencies';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const taskId = parseInt(id);

        if (!body.blocking_task_id && !body.dependent_task_id) {
            return NextResponse.json({ success: false, error: 'blocking_task_id or dependent_task_id is required' }, { status: 400 });
        }

        // If blocking_task_id is provided, this task depends on that task
        // If dependent_task_id is provided, that task depends on this task
        const blockingId = body.blocking_task_id || taskId;
        const dependentId = body.dependent_task_id || taskId;

        if (blockingId === dependentId) {
            return NextResponse.json({ success: false, error: 'A task cannot depend on itself' }, { status: 400 });
        }

        const data = await addTaskDependency(blockingId, dependentId, body.dependency_type || 'finish_to_start');
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to add dependency';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const depId = searchParams.get('dependency_id');
        if (!depId) {
            return NextResponse.json({ success: false, error: 'dependency_id is required' }, { status: 400 });
        }
        await removeTaskDependency(parseInt(depId));
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to remove dependency';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
