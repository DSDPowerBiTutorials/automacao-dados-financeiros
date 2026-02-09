import { NextRequest, NextResponse } from 'next/server';
import { updateCustomField, deleteCustomField } from '@/lib/workstream-api';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const data = await updateCustomField(parseInt(id), body);
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update custom field';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await deleteCustomField(parseInt(id));
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to delete custom field';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
