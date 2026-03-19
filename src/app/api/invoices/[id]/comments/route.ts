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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const invoiceId = parseInt(id);

        const { data, error } = await supabaseAdmin
            .from('invoice_activities')
            .select('*')
            .eq('invoice_id', invoiceId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Enrich with user info from system_users (preferred) or users table
        const enriched = await Promise.all(
            (data || []).map(async (a: Record<string, unknown>) => {
                let avatar_url = null;
                let department = null;
                let role = null;

                if (a.user_id) {
                    // Try system_users first
                    const { data: su } = await supabaseAdmin
                        .from('system_users')
                        .select('avatar_url, department, role')
                        .eq('id', a.user_id as string)
                        .maybeSingle();

                    if (su) {
                        avatar_url = su.avatar_url;
                        department = su.department;
                        role = su.role;
                    } else {
                        // Fallback to auth users table
                        const { data: au } = await supabaseAdmin
                            .from('users')
                            .select('avatar_url')
                            .eq('id', a.user_id as string)
                            .maybeSingle();
                        if (au) avatar_url = au.avatar_url;
                    }
                }

                return { ...a, avatar_url, department, role };
            })
        );

        return NextResponse.json({ success: true, data: enriched });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load comments';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
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

        // Follow workstream pattern: use commentAuthorId (auth UID) as triggeredBy
        // Resolve only for display name and collaborator FK (needs system_users.id)
        const commentAuthorId = body.user_id;
        const authorSystemUser = commentAuthorId ? await resolveAuthToSystemUser(commentAuthorId) : null;
        const authorSystemId = authorSystemUser?.id;
        const authorName = authorSystemUser?.name || body.user_name || 'Someone';
        const referenceUrl = `/accounts-payable/insights/schedule?invoice=${invoiceId}`;

        // Auto-add comment author as collaborator (needs system_users.id for FK)
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
        // Guard with commentAuthorId (always present) — not authorSystemId (may be null)
        const effectiveTriggeredBy = authorSystemId || commentAuthorId;
        for (const mentionedId of mentionedIds) {
            if (effectiveTriggeredBy && effectiveTriggeredBy !== mentionedId) {
                await createWSNotification({
                    userId: mentionedId,
                    type: 'mention',
                    title: `${authorName} mentioned you`,
                    message: `${authorName} mentioned you in a comment on a scheduled payment (Invoice #${invoiceId})`,
                    triggeredBy: effectiveTriggeredBy,
                    referenceType: 'invoice',
                    referenceUrl,
                    metadata: { invoice_id: invoiceId, comment_id: data.id },
                });

                // Auto-add mentioned user as collaborator
                try {
                    await supabaseAdmin
                        .from('invoice_collaborators')
                        .upsert(
                            { invoice_id: invoiceId, user_id: mentionedId, added_by: authorSystemId || mentionedId },
                            { onConflict: 'invoice_id,user_id' }
                        );
                } catch { /* ignore */ }
            }
        }

        // Notify existing collaborators (except author and already-mentioned)
        const alreadyNotified = new Set([...mentionedIds, authorSystemId, commentAuthorId, effectiveTriggeredBy].filter(Boolean));
        try {
            const { data: collabs } = await supabaseAdmin
                .from('invoice_collaborators')
                .select('user_id')
                .eq('invoice_id', invoiceId);

            for (const collab of (collabs || [])) {
                if (!alreadyNotified.has(collab.user_id) && effectiveTriggeredBy) {
                    await createWSNotification({
                        userId: collab.user_id,
                        type: 'comment_reply',
                        title: `${authorName} commented on a payment you follow`,
                        message: `New comment on scheduled payment (Invoice #${invoiceId})`,
                        triggeredBy: effectiveTriggeredBy,
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
