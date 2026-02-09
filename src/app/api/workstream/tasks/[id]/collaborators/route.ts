import { NextRequest, NextResponse } from 'next/server';
import { getTaskCollaborators, addTaskCollaborator, removeTaskCollaborator, createWSNotification, getTask } from '@/lib/workstream-api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const data = await getTaskCollaborators(parseInt(id));
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch collaborators';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const taskId = parseInt(id);

        if (!body.user_id) {
            return NextResponse.json({ success: false, error: 'user_id is required' }, { status: 400 });
        }

        const data = await addTaskCollaborator(taskId, body.user_id, body.added_by);

        // Send notification to the new collaborator
        if (body.added_by && body.added_by !== body.user_id) {
            try {
                const task = await getTask(taskId);
                await createWSNotification({
                    userId: body.user_id,
                    type: 'task_assigned',
                    title: 'Você foi adicionado como colaborador',
                    message: `Você foi adicionado como colaborador na tarefa "${task.title}"`,
                    triggeredBy: body.added_by,
                    referenceType: 'task',
                    referenceUrl: `/workstream/${task.project_id}?task=${taskId}`,
                    metadata: { task_id: taskId, task_title: task.title },
                });
            } catch { /* non-blocking */ }
        }

        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to add collaborator';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('user_id');

        if (!userId) {
            return NextResponse.json({ success: false, error: 'user_id is required' }, { status: 400 });
        }

        await removeTaskCollaborator(parseInt(id), userId);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to remove collaborator';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
