import { NextRequest, NextResponse } from 'next/server';
import { getSubtasks, createTask, getTask } from '@/lib/workstream-api';

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

        // Fallback to parent task's section/project if not provided
        let sectionId = body.section_id;
        let projectId = body.project_id;
        if (!sectionId || !projectId) {
            const parentTask = await getTask(parentTaskId);
            sectionId = sectionId || parentTask.section_id;
            projectId = projectId || parentTask.project_id;
        }

        const data = await createTask({
            title: body.title.trim(),
            section_id: sectionId,
            project_id: projectId,
            parent_task_id: parentTaskId,
            status: 'todo',
            priority: 'medium',
            position: body.position || 0,
        });

        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create subtask';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
