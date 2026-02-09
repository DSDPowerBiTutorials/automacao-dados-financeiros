import { NextRequest, NextResponse } from 'next/server';
import {
    getComments,
    createComment,
    getTask,
    getUsers,
    getTaskCollaborators,
    addTaskCollaborator,
    addProjectMember,
    createWSNotification,
} from '@/lib/workstream-api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const data = await getComments(parseInt(id));
        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch comments';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

// Extract @mentioned user IDs from comment text
function extractMentionedUserIds(text: string, users: Array<{ id: string; name: string }>): string[] {
    const mentionRegex = /@(\w[\w\s]*?)(?=\s@|\s*$|[.,!?;])/g;
    const ids: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
        const name = match[1].trim();
        const user = users.find(u => u.name.toLowerCase() === name.toLowerCase());
        if (user) ids.push(user.id);
    }
    return [...new Set(ids)];
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const taskId = parseInt(id);

        if (!body.content?.trim()) {
            return NextResponse.json({ success: false, error: 'content is required' }, { status: 400 });
        }

        // Get all users for mention resolution
        const allUsers = await getUsers();
        const mentionedIds = extractMentionedUserIds(body.content, allUsers || []);

        // Create comment with mentions
        const data = await createComment({
            task_id: taskId,
            user_id: body.user_id || null,
            content: body.content,
        });

        // Get task info for notifications
        const task = await getTask(taskId);
        const commentAuthorId = body.user_id;
        const commentAuthorUser = allUsers?.find((u: { id: string }) => u.id === commentAuthorId);
        const authorName = commentAuthorUser?.name || 'Alguém';
        const referenceUrl = `/workstream/${task.project_id}?task=${taskId}`;

        // ===== NOTIFICATION LOGIC =====

        // 1. Notify @mentioned users
        for (const mentionedId of mentionedIds) {
            if (commentAuthorId) {
                // Create notification
                await createWSNotification({
                    userId: mentionedId,
                    type: 'mention',
                    title: `${authorName} mencionou você`,
                    message: `${authorName} mencionou você em um comentário na tarefa "${task.title}"`,
                    triggeredBy: commentAuthorId,
                    referenceType: 'task',
                    referenceUrl,
                    metadata: { task_id: taskId, task_title: task.title, comment_id: data.id },
                });

                // Auto-add as task collaborator
                try { await addTaskCollaborator(taskId, mentionedId, commentAuthorId); } catch { /* ignore */ }

                // Auto-add as project member
                if (task.project_id) {
                    try { await addProjectMember(task.project_id, mentionedId, 'member'); } catch { /* ignore */ }
                }
            }
        }

        // 2. Notify task assignee (comment_reply) if commenter is not assignee
        if (task.assignee_id && commentAuthorId && task.assignee_id !== commentAuthorId && !mentionedIds.includes(task.assignee_id)) {
            await createWSNotification({
                userId: task.assignee_id,
                type: 'comment_reply',
                title: `${authorName} comentou na sua tarefa`,
                message: `${authorName} comentou na tarefa "${task.title}"`,
                triggeredBy: commentAuthorId,
                referenceType: 'task',
                referenceUrl,
                metadata: { task_id: taskId, task_title: task.title, comment_id: data.id },
            });
        }

        // 3. Notify all task collaborators (except author and already notified)
        const alreadyNotified = new Set([...mentionedIds, task.assignee_id, commentAuthorId].filter(Boolean));
        try {
            const collaborators = await getTaskCollaborators(taskId);
            for (const collab of (collaborators || [])) {
                const collabId = (collab as Record<string, unknown>).user_id as string;
                if (!alreadyNotified.has(collabId) && commentAuthorId) {
                    await createWSNotification({
                        userId: collabId,
                        type: 'comment_reply',
                        title: `${authorName} comentou em uma tarefa que você segue`,
                        message: `Novo comentário na tarefa "${task.title}"`,
                        triggeredBy: commentAuthorId,
                        referenceType: 'task',
                        referenceUrl,
                        metadata: { task_id: taskId, task_title: task.title, comment_id: data.id },
                    });
                }
            }
        } catch { /* non-blocking */ }

        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create comment';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
