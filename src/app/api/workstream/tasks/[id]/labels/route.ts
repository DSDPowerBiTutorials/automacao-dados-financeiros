import { NextRequest, NextResponse } from 'next/server';
import { getTaskLabels, addTaskLabel, removeTaskLabel } from '@/lib/workstream-api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const data = await getTaskLabels(parseInt(id));
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch task labels';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        if (!body.label_id) {
            return NextResponse.json({ success: false, error: 'label_id is required' }, { status: 400 });
        }
        const data = await addTaskLabel(parseInt(id), body.label_id);
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to add label';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const labelId = searchParams.get('label_id');
        if (!labelId) {
            return NextResponse.json({ success: false, error: 'label_id is required' }, { status: 400 });
        }
        await removeTaskLabel(parseInt(id), parseInt(labelId));
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to remove label';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
