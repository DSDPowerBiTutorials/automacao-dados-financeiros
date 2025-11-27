import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { success: false, error: 'Supabase admin não configurado' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()
    const { row } = body

    const { error } = await supabaseAdmin
      .from('csv_rows')
      .update({
        category: row.category,
        classification: row.classification,
        deposit_account: row.depositAccount,
        payment_method: row.paymentMethod,
        order_numbers: row.orderNumbers || [],
        reconciled: row.reconciled || false,
        matched_with: row.matchedWith,
        custom_data: row,
        updated_at: new Date().toISOString()
      })
      .eq('id', row.id)

    if (error) {
      console.error('Error updating row:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in update API:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
