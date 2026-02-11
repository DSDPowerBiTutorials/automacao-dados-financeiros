import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getAdminClient() {
    return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * GET /api/workstream/my-tasks?user_id=xxx&filter=upcoming|overdue|completed|all
 * 
 * Fetches all tasks assigned to the given user across all projects.
 */
export async function GET(req: NextRequest) {
    try {
        const userId = req.nextUrl.searchParams.get('user_id');
        const filter = req.nextUrl.searchParams.get('filter') || 'all';

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'user_id is required' },
                { status: 400 }
            );
        }

        const sb = getAdminClient();
        let query = sb
            .from('ws_tasks')
            .select('*, ws_projects!inner(id, name, color)')
            .eq('assignee_id', userId)
            .order('due_date', { ascending: true, nullsFirst: false });

        const now = new Date().toISOString().split('T')[0];

        switch (filter) {
            case 'upcoming':
                query = query
                    .not('status', 'eq', 'done')
                    .gte('due_date', now);
                break;
            case 'overdue':
                query = query
                    .not('status', 'eq', 'done')
                    .lt('due_date', now)
                    .not('due_date', 'is', null);
                break;
            case 'completed':
                query = query.eq('status', 'done');
                break;
            case 'incomplete':
                query = query.not('status', 'eq', 'done');
                break;
            default:
                // all
                break;
        }

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ success: true, data: data || [] });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch tasks';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
