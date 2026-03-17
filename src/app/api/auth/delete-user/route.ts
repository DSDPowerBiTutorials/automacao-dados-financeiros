import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
    try {
        // Validate caller is authenticated admin
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token);
        if (authErr || !caller) {
            return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
        }

        // Check caller is admin
        const { data: callerProfile } = await supabaseAdmin
            .from('users')
            .select('role, is_active')
            .eq('id', caller.id)
            .single();

        if (!callerProfile || callerProfile.role !== 'admin' || !callerProfile.is_active) {
            return NextResponse.json({ error: 'Apenas admins podem excluir usuários' }, { status: 403 });
        }

        const body = await request.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
        }

        // Prevent self-deletion
        if (userId === caller.id) {
            return NextResponse.json({ error: 'Não é possível excluir a própria conta' }, { status: 400 });
        }

        // Get user info before deletion for audit
        const { data: targetUser } = await supabaseAdmin
            .from('users')
            .select('email, name, role')
            .eq('id', userId)
            .single();

        // Step 1: Delete from users table
        const { error: deleteProfileError } = await supabaseAdmin
            .from('users')
            .delete()
            .eq('id', userId);

        if (deleteProfileError) {
            console.error('Erro ao excluir perfil:', deleteProfileError);
            return NextResponse.json(
                { error: `Erro ao excluir perfil: ${deleteProfileError.message}` },
                { status: 500 }
            );
        }

        // Step 2: Delete from Supabase Auth
        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteAuthError) {
            console.error('Erro ao excluir auth user:', deleteAuthError);
            // Profile already deleted, log the inconsistency
        }

        // Step 3: Audit log
        await supabaseAdmin
            .from('audit_log')
            .insert({
                user_id: caller.id,
                action: 'user_deleted',
                resource_type: 'user',
                resource_id: userId,
                details: {
                    deleted_email: targetUser?.email,
                    deleted_name: targetUser?.name,
                    deleted_role: targetUser?.role,
                },
            });

        return NextResponse.json({
            success: true,
            message: 'Usuário excluído com sucesso',
        });
    } catch (error) {
        console.error('Erro inesperado ao excluir usuário:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
