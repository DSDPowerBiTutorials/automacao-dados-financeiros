import { NextRequest, NextResponse } from 'next/server';
import { getLabels, createLabel, deleteLabel } from '@/lib/workstream-api';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get('project_id');
        if (!projectId) {
            return NextResponse.json({ success: false, error: 'project_id is required' }, { status: 400 });
        }
        const data = await getLabels(projectId);
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch labels';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        if (!body.project_id || !body.name?.trim()) {
            return NextResponse.json({ success: false, error: 'project_id and name are required' }, { status: 400 });
        }
        const data = await createLabel({
            project_id: body.project_id,
            name: body.name.trim(),
            color: body.color || '#6366f1',
        });
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create label';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
        }
        await deleteLabel(parseInt(id));
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to delete label';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
