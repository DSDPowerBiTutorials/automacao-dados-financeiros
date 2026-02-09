import { NextRequest, NextResponse } from 'next/server';
import { getSections, createSection } from '@/lib/workstream-api';

export async function GET(req: NextRequest) {
    try {
        const projectId = req.nextUrl.searchParams.get('project_id');
        if (!projectId) {
            return NextResponse.json({ success: false, error: 'project_id is required' }, { status: 400 });
        }
        const data = await getSections(projectId);
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch sections';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        if (!body.project_id || !body.title?.trim()) {
            return NextResponse.json({ success: false, error: 'project_id and title are required' }, { status: 400 });
        }
        const data = await createSection(body);
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create section';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
