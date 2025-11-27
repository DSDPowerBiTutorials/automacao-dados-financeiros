import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Criar cliente admin diretamente na API route para garantir que as env vars sejam lidas
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin not configured')
      console.error('URL:', supabaseUrl ? '✅ Configured' : '❌ Missing')
      console.error('Service Key:', supabaseServiceKey ? '✅ Configured' : '❌ Missing')
      
      return NextResponse.json(
        { 
          error: 'Supabase admin not configured',
          details: 'Please restart the development server to load environment variables'
        },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { rows, source } = body

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid rows data' },
        { status: 400 }
      )
    }

    // Inserir todas as linhas usando supabaseAdmin (bypassa RLS)
    const { data, error } = await supabaseAdmin
      .from('csv_rows')
      .insert(rows)
      .select()

    if (error) {
      console.error('Error inserting rows:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      count: data?.length || 0,
      data 
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { 
          error: 'Supabase admin not configured',
          details: 'Please restart the development server to load environment variables'
        },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { rows, source } = body

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid rows data' },
        { status: 400 }
      )
    }

    // Deletar todas as linhas existentes do source
    const { error: deleteError } = await supabaseAdmin
      .from('csv_rows')
      .delete()
      .eq('source', source)

    if (deleteError) {
      console.error('Error deleting old rows:', deleteError)
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      )
    }

    // Inserir todas as linhas atualizadas
    const { data, error: insertError } = await supabaseAdmin
      .from('csv_rows')
      .insert(rows)
      .select()

    if (insertError) {
      console.error('Error inserting rows:', insertError)
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      count: data?.length || 0,
      data 
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { 
          error: 'Supabase admin not configured',
          details: 'Please restart the development server to load environment variables'
        },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const source = searchParams.get('source')

    if (id) {
      // Deletar uma linha específica
      const { error } = await supabaseAdmin
        .from('csv_rows')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting row:', error)
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    } else if (source) {
      // Deletar todas as linhas de um source
      const { error } = await supabaseAdmin
        .from('csv_rows')
        .delete()
        .eq('source', source)

      if (error) {
        console.error('Error deleting rows:', error)
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: 'Missing id or source parameter' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
