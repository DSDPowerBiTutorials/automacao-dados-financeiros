import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
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

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
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

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('user-uploads')
            .upload(filePath, file, {
                contentType: file.type,
                upsert: true,
            });

        if (uploadError) {
            console.error('Error uploading file:', uploadError);
            return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('user-uploads')
            .getPublicUrl(filePath);

        // Update user profile with new avatar URL
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ avatar_url: publicUrl })
            .eq('id', user.id);

        if (updateError) {
            console.error('Error updating avatar URL:', updateError);
            return NextResponse.json({ error: 'Failed to update avatar URL' }, { status: 500 });
        }

        return NextResponse.json({
            avatar_url: publicUrl,
            message: 'Avatar uploaded successfully'
        });
    } catch (error) {
        console.error('Error in POST /api/profile/upload-avatar:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
