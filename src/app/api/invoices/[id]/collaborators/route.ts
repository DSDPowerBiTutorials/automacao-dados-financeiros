import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createWSNotification, resolveAuthToSystemUser } from '@/lib/workstream-api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const invoiceId = parseInt(id);

        const { data, error } = await supabaseAdmin
            .from('invoice_collaborators')
            .select('*')
            .eq('invoice_id', invoiceId)
            .order('added_at', { ascending: true });

        if (error) throw error;

        // Enrich with user info from system_users
        if (data && data.length > 0) {
            const userIds = data.map(c => c.user_id);
            const { data: users } = await supabaseAdmin
                .from('system_users')
                .select('id, name, email, avatar_url, role, department')
                .in('id', userIds);

            const userMap = new Map((users || []).map(u => [u.id, u]));
            const enriched = data.map(c => {
                const user = userMap.get(c.user_id);
                return {
                    ...c,
                    user_name: user?.name || null,
                    user_email: user?.email || null,
                    user_avatar: user?.avatar_url || null,
                    user_role: user?.role || null,
                    user_department: user?.department || null,
                };
            });
            return NextResponse.json({ success: true, data: enriched });
        }

        return NextResponse.json({ success: true, data: data || [] });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch collaborators';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const invoiceId = parseInt(id);

        if (!body.user_id) {
            return NextResponse.json({ success: false, error: 'user_id is required' }, { status: 400 });
        }

        // Resolve IDs: if user_id or added_by are auth UIDs, convert to system_users.id
        let resolvedUserId = body.user_id;
        let resolvedAddedBy = body.added_by || null;

        const userResolved = await resolveAuthToSystemUser(body.user_id);
        if (userResolved) resolvedUserId = userResolved.id;

        if (body.added_by) {
            const adderResolved = await resolveAuthToSystemUser(body.added_by);
            if (adderResolved) resolvedAddedBy = adderResolved.id;
        }

        const { data, error } = await supabaseAdmin
            .from('invoice_collaborators')
            .upsert(
                { invoice_id: invoiceId, user_id: resolvedUserId, added_by: resolvedAddedBy },
                { onConflict: 'invoice_id,user_id' }
            )
            .select()
            .single();

        if (error) throw error;

        // Send notification to new collaborator
        if (resolvedAddedBy && resolvedAddedBy !== resolvedUserId) {
            try {
                const adderResolved = await resolveAuthToSystemUser(body.added_by);
                const adderName = adderResolved?.name || 'Someone';

                await createWSNotification({
                    userId: resolvedUserId,
                    type: 'task_assigned',
                    title: `${adderName} added you as collaborator`,
                    message: `You were added as collaborator on a scheduled payment (Invoice #${invoiceId})`,
                    triggeredBy: resolvedAddedBy,
                    referenceType: 'invoice',
                    referenceUrl: `/accounts-payable/insights/schedule?invoice=${invoiceId}`,
                    metadata: { invoice_id: invoiceId },
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

        const { error } = await supabaseAdmin
            .from('invoice_collaborators')
            .delete()
            .eq('invoice_id', parseInt(id))
            .eq('user_id', userId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to remove collaborator';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
