import { NextRequest, NextResponse } from 'next/server';
import { getCustomFields, createCustomField } from '@/lib/workstream-api';

export async function GET(req: NextRequest) {
    try {
        const projectId = req.nextUrl.searchParams.get('project_id');
        if (!projectId) {
            return NextResponse.json({ success: false, error: 'project_id is required' }, { status: 400 });
        }
        const data = await getCustomFields(projectId);
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch custom fields';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        if (!body.project_id || !body.field_name?.trim() || !body.field_key?.trim() || !body.field_type) {
            return NextResponse.json({ success: false, error: 'project_id, field_name, field_key and field_type are required' }, { status: 400 });
        }
        const data = await createCustomField(body);
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create custom field';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
