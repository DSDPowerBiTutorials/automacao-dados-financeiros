#!/usr/bin/env node
/**
 * Apply missing Phase 2 columns + fix notifications FK constraint
 * 
 * Missing:
 * - ws_tasks: parent_task_id, start_date
 * - ws_comments: edited_at, is_deleted, parent_id, mentions
 * - notifications: FK references public.users but IDs come from system_users
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const migrations = [
    // 1. Add parent_task_id to ws_tasks (for subtasks)
    `ALTER TABLE ws_tasks ADD COLUMN IF NOT EXISTS parent_task_id INT REFERENCES ws_tasks(id) ON DELETE CASCADE`,
    // 2. Add start_date to ws_tasks
    `ALTER TABLE ws_tasks ADD COLUMN IF NOT EXISTS start_date DATE`,
    // 3. Index for subtask lookups
    `CREATE INDEX IF NOT EXISTS idx_ws_tasks_parent_task_id ON ws_tasks(parent_task_id)`,
    // 4. Comment parent_id (threaded comments)
    `ALTER TABLE ws_comments ADD COLUMN IF NOT EXISTS parent_id INT REFERENCES ws_comments(id) ON DELETE SET NULL`,
    // 5. Comment mentions
    `ALTER TABLE ws_comments ADD COLUMN IF NOT EXISTS mentions UUID[] DEFAULT '{}'`,
    // 6. Comment edit tracking
    `ALTER TABLE ws_comments ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ`,
    // 7. Comment soft delete
    `ALTER TABLE ws_comments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false`,
    // 8. Index for threaded comments
    `CREATE INDEX IF NOT EXISTS idx_ws_comments_parent ON ws_comments(parent_id)`,
    // 9. Drop FK on notifications.user_id (references public.users but we use system_users)
    `ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey`,
    // 10. Drop FK on notifications.triggered_by
    `ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_triggered_by_fkey`,
];

async function run() {
    console.log('Applying missing migrations...\n');

    for (let i = 0; i < migrations.length; i++) {
        const sql = migrations[i];
        const label = sql.substring(0, 80) + (sql.length > 80 ? '...' : '');
        process.stdout.write(`[${i + 1}/${migrations.length}] ${label} ... `);

        const { error } = await sb.rpc('exec_sql', { query: sql });

        if (error) {
            // Try direct approach if exec_sql doesn't exist
            console.log('WARN (rpc not available, trying REST)');
        } else {
            console.log('OK');
        }
    }

    console.log('\nVerifying...');

    const checks = [
        ['ws_tasks.parent_task_id', sb.from('ws_tasks').select('parent_task_id').limit(1)],
        ['ws_tasks.start_date', sb.from('ws_tasks').select('start_date').limit(1)],
        ['ws_comments.edited_at', sb.from('ws_comments').select('edited_at').limit(1)],
        ['ws_comments.is_deleted', sb.from('ws_comments').select('is_deleted').limit(1)],
        ['ws_comments.parent_id', sb.from('ws_comments').select('parent_id').limit(1)],
    ];

    for (const [name, query] of checks) {
        const r = await query;
        console.log(`  ${name}: ${r.error ? '❌ MISSING' : '✅ OK'}`);
    }

    // Test notification insert
    const sysUser = await sb.from('system_users').select('id').limit(1).single();
    if (sysUser.data) {
        const testInsert = await sb.from('notifications').insert({
            user_id: sysUser.data.id,
            type: 'system',
            title: 'Migration test',
            message: 'Testing FK fix',
            triggered_by: sysUser.data.id,
        }).select().single();

        if (testInsert.error) {
            console.log(`  notifications FK: ❌ STILL BROKEN (${testInsert.error.message})`);
        } else {
            console.log('  notifications FK: ✅ FIXED');
            // Clean up
            await sb.from('notifications').delete().eq('id', testInsert.data.id);
        }
    }

    console.log('\nDone!');
}

run().catch(console.error);
