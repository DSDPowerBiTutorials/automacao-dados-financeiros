import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side admin client for API routes
function getAdminClient() {
    return createClient(supabaseUrl, supabaseServiceKey);
}

// ============================================================
// Projects
// ============================================================

export async function getProjects(includeArchived = false) {
    const sb = getAdminClient();
    let query = sb.from('ws_projects').select('*').order('created_at', { ascending: false });
    if (!includeArchived) query = query.eq('is_archived', false);
    const { data, error } = await query;
    if (error) throw error;
    return data;
}

export async function getProject(id: string) {
    const sb = getAdminClient();
    const { data, error } = await sb.from('ws_projects').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
}

export async function createProject(project: { name: string; description?: string; color?: string; icon?: string; project_type?: string; owner_id?: string }) {
    const sb = getAdminClient();
    const { data, error } = await sb.from('ws_projects').insert(project).select().single();
    if (error) throw error;
    return data;
}

export async function updateProject(id: string, updates: Record<string, unknown>) {
    const sb = getAdminClient();
    const { data, error } = await sb.from('ws_projects').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
}

export async function deleteProject(id: string) {
    const sb = getAdminClient();
    const { error } = await sb.from('ws_projects').delete().eq('id', id);
    if (error) throw error;
}

// ============================================================
// Sections
// ============================================================

export async function getSections(projectId: string) {
    const sb = getAdminClient();
    const { data, error } = await sb.from('ws_sections').select('*').eq('project_id', projectId).order('position');
    if (error) throw error;
    return data;
}

export async function createSection(section: { project_id: string; title: string; position?: number; color?: string }) {
    const sb = getAdminClient();
    const { data, error } = await sb.from('ws_sections').insert(section).select().single();
    if (error) throw error;
    return data;
}

export async function updateSection(id: number, updates: Record<string, unknown>) {
    const sb = getAdminClient();
    const { data, error } = await sb.from('ws_sections').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
}

export async function deleteSection(id: number) {
    const sb = getAdminClient();
    const { error } = await sb.from('ws_sections').delete().eq('id', id);
    if (error) throw error;
}

// ============================================================
// Tasks
// ============================================================

export async function getTasks(projectId: string) {
    const sb = getAdminClient();
    const { data, error } = await sb.from('ws_tasks').select('*').eq('project_id', projectId).order('position');
    if (error) throw error;
    return data;
}

export async function getTask(id: number) {
    const sb = getAdminClient();
    const { data, error } = await sb.from('ws_tasks').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
}

export async function createTask(task: { title: string; section_id: number; project_id: string; status?: string; priority?: string; assignee_id?: string; due_date?: string; start_date?: string; description?: string; position?: number; created_by?: string; parent_task_id?: number }) {
    const sb = getAdminClient();
    const { data, error } = await sb.from('ws_tasks').insert(task).select().single();
    if (error) throw error;
    return data;
}

export async function updateTask(id: number, updates: Record<string, unknown>) {
    const sb = getAdminClient();
    const { data, error } = await sb.from('ws_tasks').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
}

export async function deleteTask(id: number) {
    const sb = getAdminClient();
    const { error } = await sb.from('ws_tasks').delete().eq('id', id);
    if (error) throw error;
}

// ============================================================
// Custom Fields
// ============================================================

export async function getCustomFields(projectId: string) {
    const sb = getAdminClient();
    const { data, error } = await sb.from('ws_custom_fields').select('*').eq('project_id', projectId).order('position');
    if (error) throw error;
    return data;
}

export async function createCustomField(field: { project_id: string; field_name: string; field_key: string; field_type: string; field_options?: unknown[]; is_required?: boolean; position?: number }) {
    const sb = getAdminClient();
    const { data, error } = await sb.from('ws_custom_fields').insert(field).select().single();
    if (error) throw error;
    return data;
}

export async function updateCustomField(id: number, updates: Record<string, unknown>) {
    const sb = getAdminClient();
    const { data, error } = await sb.from('ws_custom_fields').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
}

export async function deleteCustomField(id: number) {
    const sb = getAdminClient();
    const { error } = await sb.from('ws_custom_fields').delete().eq('id', id);
    if (error) throw error;
}

// ============================================================
// Comments
// ============================================================

export async function getComments(taskId: number) {
    const sb = getAdminClient();
    const { data, error } = await sb.from('ws_comments').select('*').eq('task_id', taskId).order('created_at', { ascending: true });
    if (error) throw error;
    return data;
}

export async function createComment(comment: { task_id: number; user_id: string | null; content: string }) {
    const sb = getAdminClient();
    const { data, error } = await sb.from('ws_comments').insert(comment).select().single();
    if (error) throw error;
    return data;
}

export async function updateComment(id: number, updates: { content?: string; edited_at?: string }) {
    const sb = getAdminClient();
    const { data, error } = await sb.from('ws_comments').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
}

export async function softDeleteComment(id: number) {
    const sb = getAdminClient();
    const { data, error } = await sb
        .from('ws_comments')
        .update({ is_deleted: true, content: '[This comment has been deleted]' })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

// ============================================================
// Activity Log
// ============================================================

export async function getActivityLog(taskId: number) {
    const sb = getAdminClient();
    const { data, error } = await sb.from('ws_activity_log').select('*').eq('task_id', taskId).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export async function logActivity(entry: { task_id?: number; project_id?: string; user_id?: string; action: string; field_name?: string; old_value?: string; new_value?: string }) {
    const sb = getAdminClient();
    const { error } = await sb.from('ws_activity_log').insert(entry);
    if (error) throw error;
}

// ============================================================
// Users (from system_users table)
// ============================================================

export async function getUsers() {
    const sb = getAdminClient();
    const { data, error } = await sb
        .from('system_users')
        .select('id, email, name, avatar_url, role, is_active')
        .eq('is_active', true)
        .order('name');
    if (error) throw error;
    return data;
}

// ============================================================
// Project Members
// ============================================================

export async function getProjectMembers(projectId: string) {
    const sb = getAdminClient();
    const { data, error } = await sb
        .from('ws_project_members')
        .select('*')
        .eq('project_id', projectId)
        .order('joined_at', { ascending: true });
    if (error) throw error;

    // Enrich with user info
    if (data && data.length > 0) {
        const userIds = data.map((m: Record<string, unknown>) => m.user_id as string);
        const { data: users } = await sb
            .from('system_users')
            .select('id, name, email, avatar_url')
            .in('id', userIds);

        const userMap = new Map((users || []).map((u: Record<string, unknown>) => [u.id, u]));
        return data.map((m: Record<string, unknown>) => {
            const user = userMap.get(m.user_id as string) as Record<string, unknown> | undefined;
            return {
                ...m,
                user_name: user?.name || null,
                user_email: user?.email || null,
                user_avatar: user?.avatar_url || null,
            };
        });
    }
    return data;
}

export async function addProjectMember(projectId: string, userId: string, role = 'member') {
    const sb = getAdminClient();
    const { data, error } = await sb
        .from('ws_project_members')
        .upsert({ project_id: projectId, user_id: userId, role }, { onConflict: 'project_id,user_id' })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function removeProjectMember(projectId: string, userId: string) {
    const sb = getAdminClient();
    const { error } = await sb
        .from('ws_project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);
    if (error) throw error;
}

// ============================================================
// Task Collaborators
// ============================================================

export async function getTaskCollaborators(taskId: number) {
    const sb = getAdminClient();
    const { data, error } = await sb
        .from('ws_task_collaborators')
        .select('*')
        .eq('task_id', taskId)
        .order('added_at', { ascending: true });
    if (error) throw error;

    // Enrich with user info
    if (data && data.length > 0) {
        const userIds = data.map((c: Record<string, unknown>) => c.user_id as string);
        const { data: users } = await sb
            .from('system_users')
            .select('id, name, email, avatar_url')
            .in('id', userIds);

        const userMap = new Map((users || []).map((u: Record<string, unknown>) => [u.id, u]));
        return data.map((c: Record<string, unknown>) => {
            const user = userMap.get(c.user_id as string) as Record<string, unknown> | undefined;
            return {
                ...c,
                user_name: user?.name || null,
                user_email: user?.email || null,
                user_avatar: user?.avatar_url || null,
            };
        });
    }
    return data;
}

export async function addTaskCollaborator(taskId: number, userId: string, addedBy?: string) {
    const sb = getAdminClient();
    const { data, error } = await sb
        .from('ws_task_collaborators')
        .upsert(
            { task_id: taskId, user_id: userId, added_by: addedBy || null },
            { onConflict: 'task_id,user_id' }
        )
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function removeTaskCollaborator(taskId: number, userId: string) {
    const sb = getAdminClient();
    const { error } = await sb
        .from('ws_task_collaborators')
        .delete()
        .eq('task_id', taskId)
        .eq('user_id', userId);
    if (error) throw error;
}

// ============================================================
// Workstream Attachments
// ============================================================

export async function getAttachments(entityType: string, entityId: number) {
    const sb = getAdminClient();
    const { data, error } = await sb
        .from('ws_attachments')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export async function createAttachmentRecord(attachment: {
    entity_type: string;
    entity_id: number;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    storage_path: string;
    kind: string;
    uploaded_by: string | null;
}) {
    const sb = getAdminClient();
    const { data, error } = await sb
        .from('ws_attachments')
        .insert(attachment)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteAttachmentRecord(id: string) {
    const sb = getAdminClient();
    const { data, error } = await sb
        .from('ws_attachments')
        .delete()
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

// ============================================================
// Workstream Notifications Helper
// ============================================================

export async function createWSNotification(params: {
    userId: string;
    type: string;
    title: string;
    message: string;
    triggeredBy: string;
    referenceType?: string;
    referenceUrl?: string;
    metadata?: Record<string, unknown>;
}) {
    const sb = getAdminClient();
    // Don't notify yourself
    if (params.userId === params.triggeredBy) return null;

    const { data, error } = await sb
        .from('notifications')
        .insert({
            user_id: params.userId,
            type: params.type,
            title: params.title,
            message: params.message,
            reference_type: params.referenceType || 'task',
            reference_url: params.referenceUrl || null,
            triggered_by: params.triggeredBy,
            metadata: params.metadata || {},
        })
        .select()
        .single();
    if (error) {
        console.error('Failed to create notification:', error);
        return null;
    }
    return data;
}

// ============================================================
// Subtasks
// ============================================================

export async function getSubtasks(parentTaskId: number) {
    const sb = getAdminClient();
    const { data, error } = await sb
        .from('ws_tasks')
        .select('*')
        .eq('parent_task_id', parentTaskId)
        .order('position');
    if (error) throw error;
    return data;
}

// ============================================================
// Task Dependencies
// ============================================================

export async function getTaskDependencies(taskId: number) {
    const sb = getAdminClient();
    // Get both directions: tasks blocking this one, and tasks this one blocks
    const { data: blocking, error: e1 } = await sb
        .from('ws_task_dependencies')
        .select('*')
        .eq('dependent_task_id', taskId);
    if (e1) throw e1;

    const { data: dependents, error: e2 } = await sb
        .from('ws_task_dependencies')
        .select('*')
        .eq('blocking_task_id', taskId);
    if (e2) throw e2;

    return { blockedBy: blocking || [], blocking: dependents || [] };
}

export async function addTaskDependency(blockingTaskId: number, dependentTaskId: number, dependencyType = 'finish_to_start') {
    const sb = getAdminClient();
    const { data, error } = await sb
        .from('ws_task_dependencies')
        .insert({ blocking_task_id: blockingTaskId, dependent_task_id: dependentTaskId, dependency_type: dependencyType })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function removeTaskDependency(id: number) {
    const sb = getAdminClient();
    const { error } = await sb.from('ws_task_dependencies').delete().eq('id', id);
    if (error) throw error;
}

// ============================================================
// Labels
// ============================================================

export async function getLabels(projectId: string) {
    const sb = getAdminClient();
    const { data, error } = await sb
        .from('ws_labels')
        .select('*')
        .eq('project_id', projectId)
        .order('name');
    if (error) throw error;
    return data;
}

export async function createLabel(label: { project_id: string; name: string; color: string }) {
    const sb = getAdminClient();
    const { data, error } = await sb.from('ws_labels').insert(label).select().single();
    if (error) throw error;
    return data;
}

export async function deleteLabel(id: number) {
    const sb = getAdminClient();
    const { error } = await sb.from('ws_labels').delete().eq('id', id);
    if (error) throw error;
}

export async function getTaskLabels(taskId: number) {
    const sb = getAdminClient();
    const { data, error } = await sb
        .from('ws_task_labels')
        .select('label_id, ws_labels(id, name, color)')
        .eq('task_id', taskId);
    if (error) throw error;
    return data;
}

export async function addTaskLabel(taskId: number, labelId: number) {
    const sb = getAdminClient();
    const { data, error } = await sb
        .from('ws_task_labels')
        .upsert({ task_id: taskId, label_id: labelId }, { onConflict: 'task_id,label_id' })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function removeTaskLabel(taskId: number, labelId: number) {
    const sb = getAdminClient();
    const { error } = await sb
        .from('ws_task_labels')
        .delete()
        .eq('task_id', taskId)
        .eq('label_id', labelId);
    if (error) throw error;
}
