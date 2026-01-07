// =====================================================
// Sync Metadata API Route
// Retorna metadata de sincronização para o frontend
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const source = searchParams.get('source');

        if (!source) {
            return NextResponse.json(
                { error: 'Source parameter is required' },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseAdmin
            .from('sync_metadata')
            .select('*')
            .eq('source', source)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // Not found - retornar valores default
                return NextResponse.json({
                    source,
                    last_api_sync: null,
                    last_webhook_received: null,
                    last_record_date: null,
                    total_records: 0,
                    last_sync_status: 'success',
                    last_sync_error: null,
                });
            }

            console.error('[Sync Metadata API] Error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch sync metadata' },
                { status: 500 }
            );
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('[Sync Metadata API] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
