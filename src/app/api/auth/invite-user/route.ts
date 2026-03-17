import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.dsdfinancehub.com';
const VALID_ROLES = ['admin', 'finance_manager', 'analyst', 'viewer'];

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
            return NextResponse.json({ error: 'Apenas admins podem convidar usuários' }, { status: 403 });
        }

        const body = await request.json();
        const { email, name, role, department, phone, company_code } = body;

        if (!email || !name) {
            return NextResponse.json(
                { error: 'Email e nome são obrigatórios' },
                { status: 400 }
            );
        }

        if (role && !VALID_ROLES.includes(role)) {
            return NextResponse.json(
                { error: `Role inválido. Usar: ${VALID_ROLES.join(', ')}` },
                { status: 400 }
            );
        }

        // Check if email already exists in users table
        const { data: existingUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (existingUser) {
            return NextResponse.json(
                { error: 'Já existe um usuário com este email' },
                { status: 409 }
            );
        }

        // Step 1: Invite user via Supabase Auth (sends invitation email automatically)
        const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: {
                name,
                department: department || '',
            },
            redirectTo: `${SITE_URL}/auth/callback`,
        });

        if (inviteError) {
            console.error('Erro ao convidar usuário:', inviteError);
            return NextResponse.json(
                { error: `Erro ao convidar: ${inviteError.message}` },
                { status: 500 }
            );
        }

        if (!authData.user) {
            return NextResponse.json(
                { error: 'Usuário não foi criado no auth' },
                { status: 500 }
            );
        }

        // Step 2: Create profile in users table
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .insert({
                id: authData.user.id,
                email,
                name,
                role: role || 'viewer',
                company_code: company_code || 'GLOBAL',
                department: department || null,
                phone: phone || null,
                is_active: true,
            })
            .select()
            .single();

        if (userError) {
            console.error('Erro ao criar perfil:', userError);
            // Rollback: delete auth user
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            return NextResponse.json(
                { error: `Erro ao criar perfil: ${userError.message}` },
                { status: 500 }
            );
        }

        // Step 3: Audit log
        await supabaseAdmin
            .from('audit_log')
            .insert({
                user_id: caller.id,
                action: 'user_invited',
                resource_type: 'user',
                resource_id: authData.user.id,
                details: {
                    invited_email: email,
                    invited_name: name,
                    role: role || 'viewer',
                    company_code: company_code || 'GLOBAL',
                },
            });

        return NextResponse.json({
            success: true,
            message: 'Convite enviado com sucesso!',
            user: {
                id: userData.id,
                email: userData.email,
                name: userData.name,
                role: userData.role,
                company_code: userData.company_code,
                department: userData.department,
            },
        });
    } catch (error) {
        console.error('Erro inesperado ao convidar usuário:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
