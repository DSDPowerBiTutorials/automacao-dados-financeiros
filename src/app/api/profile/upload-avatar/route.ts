import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    console.log('🔵 [AVATAR UPLOAD] Iniciando upload de avatar...');

    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader) {
            console.error('❌ [AVATAR UPLOAD] Sem header de autorização');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        console.log('🔵 [AVATAR UPLOAD] Verificando token...');

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            console.error('❌ [AVATAR UPLOAD] Erro de autenticação:', authError?.message);
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('✅ [AVATAR UPLOAD] Usuário autenticado:', user.id);

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            console.error('❌ [AVATAR UPLOAD] Nenhum arquivo fornecido');
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        console.log('📎 [AVATAR UPLOAD] Arquivo recebido:', {
            name: file.name,
            type: file.type,
            size: file.size
        });

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            console.error('❌ [AVATAR UPLOAD] Tipo de arquivo inválido:', file.type);
            return NextResponse.json({ error: 'Invalid file type. Only JPEG, PNG, WebP and GIF are allowed.' }, { status: 400 });
        }

        // Validate file size (max 2MB)
        const maxSize = 2 * 1024 * 1024; // 2MB
        if (file.size > maxSize) {
            return NextResponse.json({ error: 'File too large. Maximum size is 2MB.' }, { status: 400 });
        }

        // Generate unique file name
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        console.log(`📤 Uploading avatar for user ${user.id}: ${filePath}`);

        // Verificar se o bucket existe
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

        if (bucketsError) {
            console.error('Error listing buckets:', bucketsError);
            return NextResponse.json({
                error: 'Storage configuration error. Please contact administrator.',
                details: bucketsError.message
            }, { status: 500 });
        }

        const bucketExists = buckets?.some(b => b.name === 'user-uploads');

        if (!bucketExists) {
            console.error('❌ Bucket "user-uploads" does not exist!');
            return NextResponse.json({
                error: 'Storage bucket not configured. Please run PROFILE-SETUP.sql in Supabase.',
                hint: 'Execute: INSERT INTO storage.buckets (id, name, public) VALUES (\'user-uploads\', \'user-uploads\', true);'
            }, { status: 500 });
        }

        console.log('✅ Bucket exists, proceeding with upload');

        // Convert File to ArrayBuffer for Supabase upload
        console.log('📤 [AVATAR UPLOAD] Convertendo arquivo para upload...');
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log('📤 [AVATAR UPLOAD] Fazendo upload para Supabase Storage...');

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('user-uploads')
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: true,
            });

        if (uploadError) {
            console.error('❌ [AVATAR UPLOAD] Erro ao fazer upload:', {
                message: uploadError.message,
                statusCode: uploadError.statusCode,
                error: uploadError
            });
            return NextResponse.json({
                error: 'Failed to upload file',
                details: uploadError.message,
                hint: uploadError.message.includes('policy')
                    ? 'Storage policies not configured. Please run PROFILE-SETUP.sql in Supabase.'
                    : uploadError.message
            }, { status: 500 });
        }

        console.log('✅ [AVATAR UPLOAD] Upload concluído:', uploadData);

        // Get public URL
        console.log('🔗 [AVATAR UPLOAD] Gerando URL pública...');
        const { data: { publicUrl } } = supabase.storage
            .from('user-uploads')
            .getPublicUrl(filePath);

        console.log('✅ [AVATAR UPLOAD] URL pública gerada:', publicUrl);

        // Update user profile with new avatar URL
        console.log('💾 [AVATAR UPLOAD] Atualizando perfil do usuário...');
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ avatar_url: publicUrl })
            .eq('id', user.id);

        if (updateError) {
            console.error('❌ [AVATAR UPLOAD] Erro ao atualizar perfil:', updateError);
            return NextResponse.json({
                error: 'Failed to update avatar URL',
                details: updateError.message
            }, { status: 500 });
        }

        console.log('✅ [AVATAR UPLOAD] Perfil atualizado com sucesso!');

        return NextResponse.json({
            avatar_url: publicUrl,
            message: 'Avatar uploaded successfully'
        });
    } catch (error: any) {
        console.error('❌ [AVATAR UPLOAD] ERRO INESPERADO:', {
            message: error?.message,
            stack: error?.stack,
            error: error
        });
        return NextResponse.json({
            error: 'Internal server error',
            details: error?.message || 'Unknown error'
        }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get current avatar URL
        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('avatar_url')
            .eq('id', user.id)
            .single();

        // Remove avatar URL from profile
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ avatar_url: null })
            .eq('id', user.id);

        if (updateError) {
            console.error('Error removing avatar URL:', updateError);
            return NextResponse.json({ error: 'Failed to remove avatar' }, { status: 500 });
        }

        // Try to delete file from storage (optional, don't fail if it doesn't exist)
        if (profile?.avatar_url) {
            const filePath = profile.avatar_url.split('/').slice(-2).join('/');
            await supabase.storage.from('user-uploads').remove([filePath]);
        }

        return NextResponse.json({ message: 'Avatar removed successfully' });
    } catch (error) {
        console.error('Error in DELETE /api/profile/upload-avatar:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
