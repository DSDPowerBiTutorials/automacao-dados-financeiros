import { NextRequest, NextResponse } from 'next/server';
import { getTask, updateTask, deleteTask, createWSNotification, getUsers } from '@/lib/workstream-api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const data = await getTask(parseInt(id));
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch task';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const taskId = parseInt(id);

        // Get previous task state for comparison
        const previousTask = await getTask(taskId);
        const data = await updateTask(taskId, body);

        // Notify on assignee change
        if (
            body.assignee_id !== undefined &&
            body.assignee_id !== previousTask.assignee_id &&
            body.assignee_id !== null
        ) {
            try {
                const triggeredBy = body.updated_by || previousTask.created_by;
                if (triggeredBy) {
                    const allUsers = await getUsers();
                    const triggerUser = allUsers?.find((u: { id: string }) => u.id === triggeredBy);
                    const triggerName = triggerUser?.name || 'Alguém';

                    await createWSNotification({
                        userId: body.assignee_id,
                        type: 'task_assigned',
                        title: `${triggerName} atribuiu uma tarefa a você`,
                        message: `Você foi atribuído à tarefa "${data.title}"`,
                        triggeredBy,
                        referenceType: 'task',
                        referenceUrl: `/workstream/${data.project_id}?task=${taskId}`,
                        metadata: { task_id: taskId, task_title: data.title },
                    });
                }
            } catch { /* non-blocking */ }
        }

        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update task';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await deleteTask(parseInt(id));
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to delete task';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
