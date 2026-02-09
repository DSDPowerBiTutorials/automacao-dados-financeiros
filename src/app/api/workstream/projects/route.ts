import { NextRequest, NextResponse } from 'next/server';
import { getProjects, createProject } from '@/lib/workstream-api';

export async function GET() {
    try {
        const data = await getProjects();
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch projects';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        if (!body.name?.trim()) {
            return NextResponse.json({ success: false, error: 'Project name is required' }, { status: 400 });
        }
        const data = await createProject(body);
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create project';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
