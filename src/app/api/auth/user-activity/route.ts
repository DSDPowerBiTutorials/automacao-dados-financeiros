import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token);
        if (authErr || !caller) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        // Check caller is admin
        const { data: callerProfile } = await supabaseAdmin
            .from('users')
            .select('role, is_active')
            .eq('id', caller.id)
            .single();

        if (!callerProfile || callerProfile.role !== 'admin' || !callerProfile.is_active) {
            return NextResponse.json({ error: 'Only admins can view user activity' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // Get target user info
        const { data: targetUser } = await supabaseAdmin
            .from('users')
            .select('id, email, name, role, last_login_at, created_at')
            .eq('id', userId)
            .single();

        if (!targetUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Get audit logs for this user
        const { data: logs, error: logsError } = await supabaseAdmin
            .from('audit_logs')
            .select('id, action, entity_type, entity_name, ip_address, created_at, metadata')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (logsError) {
            console.error('Error fetching audit logs:', logsError);
            return NextResponse.json({ error: 'Error fetching activity' }, { status: 500 });
        }

        // Compute stats
        const loginCount = (logs || []).filter(l => l.action === 'login').length;
        const totalActions = (logs || []).length;
        const lastAction = logs?.[0] || null;

        return NextResponse.json({
            user: targetUser,
            logs: logs || [],
            stats: {
                loginCount,
                totalActions,
                lastAction: lastAction ? {
                    action: lastAction.action,
                    date: lastAction.created_at,
                } : null,
            },
        });
    } catch (error) {
        console.error('Error in user-activity:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
