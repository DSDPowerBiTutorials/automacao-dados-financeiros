import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * API temporária para criar o primeiro usuário admin
 * ATENÇÃO: Esta rota deve ser removida após o setup inicial
 * ou protegida com autenticação forte
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password, name, department } = body;

        // Validação básica
        if (!email || !password || !name) {
            return NextResponse.json(
                { error: 'Email, password e name são obrigatórios' },
                { status: 400 }
            );
        }

        // PASSO 1: Criar usuário no Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirmar email
            user_metadata: {
                name,
                department: department || 'Finance',
            },
        });

        if (authError) {
            console.error('Erro ao criar usuário no auth:', authError);
            return NextResponse.json(
                { error: `Erro ao criar usuário: ${authError.message}` },
                { status: 500 }
            );
        }

        if (!authData.user) {
            return NextResponse.json(
                { error: 'Usuário não foi criado no auth' },
                { status: 500 }
            );
        }

        // PASSO 2: Criar perfil na tabela users
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .insert({
                id: authData.user.id,
                email: email,
                name: name,
                role: 'admin',
                company_code: 'GLOBAL',
                department: department || 'Finance',
                is_active: true,
            })
            .select()
            .single();

        if (userError) {
            console.error('Erro ao criar perfil do usuário:', userError);

            // Tentar deletar o usuário do auth se falhar a criação do perfil
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

            return NextResponse.json(
                { error: `Erro ao criar perfil: ${userError.message}` },
                { status: 500 }
            );
        }

        // PASSO 3: Log de auditoria
        await supabaseAdmin
            .from('audit_log')
            .insert({
                user_id: authData.user.id,
                action: 'user_created',
                resource_type: 'user',
                resource_id: authData.user.id,
                details: {
                    created_by: 'setup_script',
                    name: name,
                    role: 'admin',
                    department: department || 'Finance',
                },
            });

        return NextResponse.json({
            success: true,
            message: 'Usuário admin criado com sucesso!',
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
        console.error('Erro inesperado ao criar usuário:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}

/**
 * Endpoint de teste para verificar se a API está funcionando
 */
export async function GET() {
    return NextResponse.json({
        message: 'API de setup de admin está ativa',
        warning: 'Esta rota deve ser removida após o setup inicial',
        usage: 'POST /api/setup-admin com body: { email, password, name, department }',
    });
}
