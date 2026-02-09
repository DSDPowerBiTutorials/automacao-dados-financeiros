import { NextRequest, NextResponse } from 'next/server';
import { getTasks, createTask } from '@/lib/workstream-api';

export async function GET(req: NextRequest) {
    try {
        const projectId = req.nextUrl.searchParams.get('project_id');
        if (!projectId) {
            return NextResponse.json({ success: false, error: 'project_id is required' }, { status: 400 });
        }
        const data = await getTasks(projectId);
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch tasks';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        if (!body.title?.trim() || !body.section_id || !body.project_id) {
            return NextResponse.json({ success: false, error: 'title, section_id and project_id are required' }, { status: 400 });
        }
        const data = await createTask(body);
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create task';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
