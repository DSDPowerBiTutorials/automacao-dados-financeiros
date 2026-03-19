import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveAuthToSystemUser } from '@/lib/workstream-api';

/**
 * Resolve both auth UID and system_users ID for the authenticated user.
 * Returns [authUid, systemUserId?] for querying notifications created under either ID.
 */
async function resolveUserIds(req: NextRequest): Promise<{ authUid: string; userIds: string[] } | null> {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return null;

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;

    const authUid = user.id;
    const sysUser = await resolveAuthToSystemUser(authUid);
    const userIds = [authUid];
    if (sysUser && sysUser.id !== authUid) userIds.push(sysUser.id);

    return { authUid, userIds };
}

// GET /api/notifications — fetch notifications for authenticated user
export async function GET(req: NextRequest) {
    try {
        const resolved = await resolveUserIds(req);
        if (!resolved) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50');

        const { data, error } = await supabaseAdmin
            .from('notifications')
            .select('*')
            .in('user_id', resolved.userIds)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        // Enrich triggered_by with system_users data, falling back to auth users table
        const triggerIds = [...new Set((data || []).map(n => n.triggered_by).filter(Boolean))];
        let usersMap: Record<string, { id: string; name: string; avatar_url: string | null }> = {};

        if (triggerIds.length > 0) {
            // Try system_users first
            const { data: sysUsers } = await supabaseAdmin
                .from('system_users')
                .select('id, name, avatar_url')
                .in('id', triggerIds);
            for (const u of (sysUsers || [])) {
                usersMap[u.id] = u;
            }

            // Fallback: any triggerIds not found in system_users → try auth users table
            const missingIds = triggerIds.filter(id => !usersMap[id]);
            if (missingIds.length > 0) {
                const { data: authUsers } = await supabaseAdmin
                    .from('users')
                    .select('id, email, raw_user_meta_data')
                    .in('id', missingIds);
                for (const au of (authUsers || [])) {
                    const meta = (au.raw_user_meta_data || {}) as Record<string, unknown>;
                    const name = (meta.full_name || meta.name || au.email || 'Unknown') as string;
                    usersMap[au.id] = { id: au.id, name, avatar_url: (meta.avatar_url as string) || null };
                }
            }
        }

        const enriched = (data || []).map(n => ({
            ...n,
            triggered_by_user: n.triggered_by ? usersMap[n.triggered_by] || null : null,
        }));

        return NextResponse.json({ success: true, data: enriched, userIds: resolved.userIds });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch notifications';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// PATCH /api/notifications — mark notification(s) as read
export async function PATCH(req: NextRequest) {
    try {
        const resolved = await resolveUserIds(req);
        if (!resolved) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { id, markAllRead } = body;

        if (markAllRead) {
            const { error } = await supabaseAdmin
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .in('user_id', resolved.userIds)
                .eq('is_read', false);
            if (error) throw error;
        } else if (id) {
            const { error } = await supabaseAdmin
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', id);
            if (error) throw error;
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update notification';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// DELETE /api/notifications — delete single or all notifications
export async function DELETE(req: NextRequest) {
    try {
        const resolved = await resolveUserIds(req);
        if (!resolved) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const id = req.nextUrl.searchParams.get('id');
        const clearAll = req.nextUrl.searchParams.get('all') === 'true';

        if (clearAll) {
            const { error } = await supabaseAdmin
                .from('notifications')
                .delete()
                .in('user_id', resolved.userIds);
            if (error) throw error;
        } else if (id) {
            const { error } = await supabaseAdmin
                .from('notifications')
                .delete()
                .eq('id', id);
            if (error) throw error;
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to delete notification';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
