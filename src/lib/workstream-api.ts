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

export async function createTask(task: { title: string; section_id: number; project_id: string; status?: string; priority?: string; assignee_id?: string; due_date?: string; description?: string; position?: number; created_by?: string }) {
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

export async function createComment(comment: { task_id: number; user_id: string; content: string }) {
    const sb = getAdminClient();
    const { data, error } = await sb.from('ws_comments').insert(comment).select().single();
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
