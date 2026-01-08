import { NextRequest, NextResponse } from 'next/server';
import { getSyncMetadataBySource } from '@/lib/sync-metadata';

export async function GET(
    request: NextRequest,
    { params }: { params: { source: string } }
) {
    try {
        const source = params.source;

        if (!source) {
            return NextResponse.json(
                { error: 'Source parameter is required' },
                { status: 400 }
            );
        }

        const metadata = await getSyncMetadataBySource(source);

        if (!metadata) {
            return NextResponse.json(
                { error: 'Sync metadata not found for this source' },
                { status: 404 }
            );
        }

        return NextResponse.json(metadata);
    } catch (error: any) {
        console.error('[API] Error fetching sync metadata:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch sync metadata' },
            { status: 500 }
        );
    }
}
