import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchBbsEmails, getEmailContent } from '@/lib/gmail/client'
import { parseBbsEmail, splitName } from '@/lib/gmail/bbs-parser'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse optional request body for date filter
    let afterDate: string | undefined
    try {
      const body = await request.json()
      afterDate = body.afterDate // format: "2026/04/01"
    } catch {
      // No body — sync all
    }

    // 1. Get already-processed gmail message IDs to skip duplicates
    const { data: existingComms } = await supabase
      .from('communications')
      .select('gmail_message_id')
      .eq('logged_by', 'bbs_scrape')
      .not('gmail_message_id', 'is', null)

    const processedIds = new Set((existingComms || []).map(c => c.gmail_message_id))

    // 2. Search Gmail for BBS inquiry emails
    const messages = await searchBbsEmails(afterDate)

    let created = 0
    let skipped = 0
    let errors = 0
    const results: Array<{ name: string; email: string | null; type: string; listing: string | null }> = []

    for (const msg of messages) {
      if (!msg.id) continue

      // Skip already processed
      if (processedIds.has(msg.id)) {
        skipped++
        continue
      }

      try {
        // 3. Fetch full email content
        const email = await getEmailContent(msg.id)

        // 4. Parse the BBS email
        const parsed = parseBbsEmail(email.body, email.subject)
        if (!parsed || !parsed.contact_email) {
          skipped++
          continue
        }

        const { first, last } = splitName(parsed.contact_name)

        // 5. Upsert contact — match by email, create if new
        let contactId: string

        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('broker_id', user.id)
          .ilike('email', parsed.contact_email)
          .limit(1)
          .single()

        if (existingContact) {
          contactId = existingContact.id

          // Update fields if we have new data (don't overwrite existing)
          const updates: Record<string, unknown> = {}
          if (parsed.contact_phone) updates.phone = parsed.contact_phone
          if (parsed.able_to_invest) updates.liquid_cash = parsed.able_to_invest
          if (parsed.contact_zip) updates.zip = parsed.contact_zip

          if (Object.keys(updates).length > 0) {
            await supabase
              .from('contacts')
              .update(updates)
              .eq('id', contactId)
          }
        } else {
          // Create new contact
          const { data: newContact, error: insertErr } = await supabase
            .from('contacts')
            .insert({
              broker_id: user.id,
              first_name: first || parsed.contact_email.split('@')[0],
              last_name: last || '',
              email: parsed.contact_email,
              phone: parsed.contact_phone,
              zip: parsed.contact_zip,
              liquid_cash: parsed.able_to_invest,
              source: 'bizbuysell',
              is_active: true,
              proof_of_funds_received: false,
              notes: parsed.purchase_within ? `Purchase within: ${parsed.purchase_within}` : null,
            })
            .select('id')
            .single()

          if (insertErr || !newContact) {
            errors++
            continue
          }
          contactId = newContact.id
        }

        // 6. Try to match listing to a deal
        let dealId: string | null = null
        if (parsed.listing_name) {
          const { data: deal } = await supabase
            .from('deals')
            .select('id')
            .eq('broker_id', user.id)
            .ilike('listing_name', `%${parsed.listing_name.slice(0, 40)}%`)
            .limit(1)
            .single()

          if (deal) dealId = deal.id
        }

        // 7. Build subject line based on type
        let subject = ''
        if (parsed.email_type === 'listing_lead') {
          subject = `BBS Listing Lead: ${parsed.listing_name || 'Unknown'}`
        } else if (parsed.email_type === 'signed_nda') {
          subject = `BBS Signed NDA: ${parsed.listing_name || 'Unknown'}`
        } else {
          subject = 'BBS Broker Directory Inquiry'
        }

        // 8. Log communication
        await supabase
          .from('communications')
          .insert({
            broker_id: user.id,
            contact_id: contactId,
            deal_id: dealId,
            comm_type: 'email',
            direction: 'inbound',
            subject,
            body: parsed.comments || email.body.slice(0, 2000),
            summary: parsed.email_type === 'signed_nda'
              ? `NDA signed for ${parsed.listing_name || 'listing'}. ${parsed.comments || ''}`
              : parsed.comments?.slice(0, 120) || null,
            gmail_message_id: email.id,
            gmail_thread_id: email.threadId,
            from_address: parsed.contact_email,
            to_addresses: [user.email || ''],
            occurred_at: email.date ? new Date(email.date).toISOString() : new Date().toISOString(),
            logged_by: 'bbs_scrape',
          })

        // 9. If NDA signed, update or create deal_access
        if (parsed.nda_signed && dealId) {
          const { data: existingAccess } = await supabase
            .from('deal_access')
            .select('id')
            .eq('contact_id', contactId)
            .eq('deal_id', dealId)
            .limit(1)
            .single()

          if (existingAccess) {
            await supabase
              .from('deal_access')
              .update({ nda_signed: true, nda_signed_date: new Date().toISOString() })
              .eq('id', existingAccess.id)
          }
          // Note: we don't auto-create deal_access here — broker should review first
        }

        created++
        results.push({
          name: parsed.contact_name || 'Unknown',
          email: parsed.contact_email,
          type: parsed.email_type,
          listing: parsed.listing_name,
        })
      } catch (err) {
        console.error(`Error processing message ${msg.id}:`, err)
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      total: messages.length,
      created,
      skipped,
      errors,
      results,
    })
  } catch (err) {
    console.error('BBS sync error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
