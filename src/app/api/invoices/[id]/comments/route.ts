import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getUsers, createWSNotification, resolveAuthToSystemUser } from '@/lib/workstream-api';

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
        const invoiceId = parseInt(id);

        if (!body.content?.trim()) {
            return NextResponse.json({ success: false, error: 'content is required' }, { status: 400 });
        }

        // Get all users for mention resolution
        const allUsers = await getUsers();
        const mentionedIds = extractMentionedUserIds(body.content, allUsers || []);

        // Insert comment into invoice_activities
        const { data, error } = await supabaseAdmin
            .from('invoice_activities')
            .insert({
                invoice_id: invoiceId,
                user_id: body.user_id || null,
                user_email: body.user_email || 'Unknown',
                user_name: body.user_name || 'Unknown',
                activity_type: 'comment',
                content: body.content,
                metadata: mentionedIds.length > 0 ? { mentions: mentionedIds } : {},
            })
            .select()
            .single();

        if (error) throw error;

        const commentAuthorId = body.user_id;
        // Resolve auth UID → system_users.id so triggeredBy is in the same space as mentionedIds
        const authorSystemUser = commentAuthorId ? await resolveAuthToSystemUser(commentAuthorId) : null;
        const authorSystemId = authorSystemUser?.id || commentAuthorId;
        const authorName = authorSystemUser?.name || body.user_name || 'Someone';
        const referenceUrl = `/accounts-payable/insights/schedule`;

        // Auto-add comment author as collaborator
        if (authorSystemId) {
            try {
                await supabaseAdmin
                    .from('invoice_collaborators')
                    .upsert(
                        { invoice_id: invoiceId, user_id: authorSystemId, added_by: authorSystemId },
                        { onConflict: 'invoice_id,user_id' }
                    );
            } catch { /* ignore */ }
        }

        // Process @mentions: notify + auto-add as collaborator
        for (const mentionedId of mentionedIds) {
            if (authorSystemId && authorSystemId !== mentionedId) {
                // Send notification
                await createWSNotification({
                    userId: mentionedId,
                    type: 'mention',
                    title: `${authorName} mentioned you`,
                    message: `${authorName} mentioned you in a comment on a scheduled payment (Invoice #${invoiceId})`,
                    triggeredBy: authorSystemId,
                    referenceType: 'invoice',
                    referenceUrl,
                    metadata: { invoice_id: invoiceId, comment_id: data.id },
                });

                // Auto-add as collaborator
                try {
                    await supabaseAdmin
                        .from('invoice_collaborators')
                        .upsert(
                            { invoice_id: invoiceId, user_id: mentionedId, added_by: authorSystemId },
                            { onConflict: 'invoice_id,user_id' }
                        );
                } catch { /* ignore */ }
            }
        }

        // Notify existing collaborators (except author and already-mentioned)
        const alreadyNotified = new Set([...mentionedIds, authorSystemId].filter(Boolean));
        try {
            const { data: collabs } = await supabaseAdmin
                .from('invoice_collaborators')
                .select('user_id')
                .eq('invoice_id', invoiceId);

            for (const collab of (collabs || [])) {
                if (!alreadyNotified.has(collab.user_id) && authorSystemId) {
                    await createWSNotification({
                        userId: collab.user_id,
                        type: 'comment_reply',
                        title: `${authorName} commented on a payment you follow`,
                        message: `New comment on scheduled payment (Invoice #${invoiceId})`,
                        triggeredBy: authorSystemId,
                        referenceType: 'invoice',
                        referenceUrl,
                        metadata: { invoice_id: invoiceId, comment_id: data.id },
                    });
                }
            }
        } catch { /* non-blocking */ }

        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to add comment';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
