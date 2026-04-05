import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAgent5 } from '@/lib/agents/agent5-report-generation'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { valuation_id } = body

    if (!valuation_id) {
      return NextResponse.json({ error: 'valuation_id is required' }, { status: 400 })
    }

    // Verify the user owns this valuation
    const { data: valuation } = await supabase
      .from('valuations')
      .select('id, user_id, status')
      .eq('id', valuation_id)
      .eq('user_id', user.id)
      .single()

    if (!valuation) {
      return NextResponse.json({ error: 'Valuation not found' }, { status: 404 })
    }

    if (valuation.status !== 'review') {
      return NextResponse.json(
        { error: `Report can only be generated for valuations in "review" status. Current: "${valuation.status}".` },
        { status: 400 }
      )
    }

    // Run Agent 5: Report Generation
    const result = await runAgent5(valuation_id)

    // Return the DOCX as a downloadable file
    return new NextResponse(new Uint8Array(result.report_buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'X-Report-URL': result.report_url || '',
      },
    })
  } catch (error) {
    console.error('Report generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Report generation failed' },
      { status: 500 }
    )
  }
}
