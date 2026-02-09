// ============================================================
// DSD Workstream — TypeScript Types
// ============================================================

export type ProjectType = 'general' | 'financial' | 'engineering' | 'marketing' | 'operations' | 'hr';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type CustomFieldType = 'text' | 'number' | 'currency' | 'date' | 'select' | 'url' | 'checkbox';

export interface WSProject {
    id: string;
    name: string;
    description: string;
    color: string;
    icon: string;
    project_type: ProjectType;
    owner_id: string | null;
    section_order: number[];
    is_archived: boolean;
    is_favorite: boolean;
    created_at: string;
    updated_at: string;
}

export interface WSSection {
    id: number;
    project_id: string;
    title: string;
    task_order: number[];
    color: string | null;
    position: number;
    created_at: string;
}

export interface WSTask {
    id: number;
    section_id: number;
    project_id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    assignee_id: string | null;
    due_date: string | null;
    completed_at: string | null;
    position: number;
    tags: string[];
    custom_data: Record<string, unknown>;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface WSCustomField {
    id: number;
    project_id: string;
    field_name: string;
    field_key: string;
    field_type: CustomFieldType;
    field_options: unknown[];
    is_required: boolean;
    position: number;
    created_at: string;
}

export interface WSComment {
    id: number;
    task_id: number;
    user_id: string | null;
    content: string;
    created_at: string;
    // Joined field
    user_email?: string;
    user_name?: string;
}

export interface WSUser {
    id: string;
    email: string;
    name: string;
    avatar_url?: string;
    role: string;
    is_active: boolean;
}

export interface WSProjectMember {
    id: number;
    project_id: string;
    user_id: string;
    role: string;
    joined_at: string;
    // Joined fields
    user_name?: string;
    user_email?: string;
    user_avatar?: string;
}

export interface WSActivityLog {
    id: number;
    task_id: number | null;
    project_id: string | null;
    user_id: string | null;
    action: string;
    field_name: string | null;
    old_value: string | null;
    new_value: string | null;
    created_at: string;
    // Joined field
    user_email?: string;
}

// View toggle
export type ViewMode = 'board' | 'list';

// Project with hydrated sections/tasks
export interface WSProjectFull extends WSProject {
    sections: WSSection[];
    tasks: WSTask[];
    custom_fields: WSCustomField[];
}

// Status display config
export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string; border: string }> = {
    todo: { label: 'To Do', color: 'text-gray-400', bg: 'bg-gray-900/30', border: 'border-gray-700' },
    in_progress: { label: 'In Progress', color: 'text-blue-400', bg: 'bg-blue-900/30', border: 'border-blue-700' },
    review: { label: 'Review', color: 'text-yellow-400', bg: 'bg-yellow-900/30', border: 'border-yellow-700' },
    done: { label: 'Done', color: 'text-green-400', bg: 'bg-green-900/30', border: 'border-green-700' },
    blocked: { label: 'Blocked', color: 'text-red-400', bg: 'bg-red-900/30', border: 'border-red-700' },
};

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; border: string }> = {
    low: { label: 'Low', color: 'text-gray-400', bg: 'bg-gray-900/30', border: 'border-gray-700' },
    medium: { label: 'Medium', color: 'text-blue-400', bg: 'bg-blue-900/30', border: 'border-blue-700' },
    high: { label: 'High', color: 'text-orange-400', bg: 'bg-orange-900/30', border: 'border-orange-700' },
    urgent: { label: 'Urgent', color: 'text-red-400', bg: 'bg-red-900/30', border: 'border-red-700' },
};

export const PROJECT_TYPE_CONFIG: Record<ProjectType, { label: string; icon: string }> = {
    general: { label: 'General', icon: 'folder' },
    financial: { label: 'Financial', icon: 'dollar-sign' },
    engineering: { label: 'Engineering', icon: 'code' },
    marketing: { label: 'Marketing', icon: 'megaphone' },
    operations: { label: 'Operations', icon: 'settings' },
    hr: { label: 'Human Resources', icon: 'users' },
};
