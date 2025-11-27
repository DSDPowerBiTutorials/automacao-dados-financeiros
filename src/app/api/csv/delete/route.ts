import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function DELETE(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { success: false, error: 'Supabase admin não configurado' },
      { status: 500 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const rowId = searchParams.get('rowId')
    const fileName = searchParams.get('fileName')
    const source = searchParams.get('source')
    const deleteAll = searchParams.get('deleteAll') === 'true'

    if (deleteAll) {
      // Deletar TODAS as linhas
      const { error: rowsError } = await supabaseAdmin
        .from('csv_rows')
        .delete()
        .neq('id', '')

      if (rowsError) throw rowsError

      // Deletar TODOS os arquivos
      const { error: filesError } = await supabaseAdmin
        .from('csv_files')
        .delete()
        .neq('id', '')

      if (filesError) throw filesError

      return NextResponse.json({ success: true })
    }

    if (rowId) {
      // Deletar linha específica
      const { error } = await supabaseAdmin
        .from('csv_rows')
        .delete()
        .eq('id', rowId)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (fileName && source) {
      // Deletar arquivo e suas linhas
      const { error: rowsError } = await supabaseAdmin
        .from('csv_rows')
        .delete()
        .eq('file_name', fileName)
        .eq('source', source)

      if (rowsError) throw rowsError

      const { error: fileError } = await supabaseAdmin
        .from('csv_files')
        .delete()
        .eq('name', fileName)
        .eq('source', source)

      if (fileError) throw fileError

      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { success: false, error: 'Parâmetros inválidos' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in delete API:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
