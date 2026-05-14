/**
 * MainStreetOS · POST /api/sign/execute
 *
 * THE LEGAL MOMENT OF SIGNING.
 *
 * Called when the buyer clicks "Sign and Submit" on the signing page. This
 * endpoint runs every validation gate from architecture section 7.2 before
 * recording the signature.
 *
 * Validation gates (ALL must pass):
 *   1. Token is well-formed
 *   2. Token exists in DB and matches a signer
 *   3. Token is not expired
 *   4. Token is not consumed (no prior signature)
 *   5. Envelope is in 'sent' or 'partially_signed' status
 *   6. All required fields populated
 *   7. Consent checkbox is checked
 *   8. Disclosure version hash matches a known active version
 *   9. Document hash matches canonical re-render of template+values
 *  10. Scroll completion event exists in audit log
 *  11. IP/UA reasonably consistent with envelope.opened event (warn, not block)
 *
 * If ALL gates pass:
 *   - Render the signed PDF (with buyer's typed/drawn signature)
 *   - Hash the PDF
 *   - Render the audit certificate PDF
 *   - Hash the audit certificate
 *   - Upload both to Supabase Storage
 *   - Insert sign_signatures row
 *   - Update envelope to 'completed'
 *   - Mark token consumed
 *   - Log envelope.signed event
 *   - Sync to Notion (lead status, attached PDF)
 *   - Email buyer their signed copy
 *   - Return success with download URL
 *
 * Place at: app/api/sign/execute/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hashSigningToken, isWellFormedToken, sha256Hex } from '@/lib/signing-tokens';
import { logEvent, attributionFromRequest } from '@/lib/audit-log';
import { renderSignedPdf, renderAuditCertificate } from '@/lib/render-pdf';
import { syncCompletedSignatureToNotion } from '@/lib/notion-sync-clickwrap';
import { sendSignedCopy, sendBrokerNotification } from '@/lib/email';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// Request shape
// ============================================================================

type ExecuteBody = {
  token:                  string;
  fieldValues:            Record<string, any>;     // all buyer-filled values
  consentChecked:         boolean;
  consentGivenEventId:    number;                   // the consent.given event id from logging
  documentSha256ShownToSigner: string;              // what the client says they saw
  disclosureSha256ShownToSigner: string;
  scrollCompleted:        boolean;
  signatureMethod:        'typed' | 'drawn' | 'typed_and_drawn';
  typedSignature:         string;
  drawnSignatureSvg?:     string;
  sessionId:              string;
};

// ============================================================================
// Route handler
// ============================================================================

export async function POST(req: NextRequest) {
  const attribution = attributionFromRequest(req);

  let body: ExecuteBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  // ----- Gate 1: Token well-formed ------------------------------------------
  if (!isWellFormedToken(body.token)) {
    return json({ error: 'invalid token format' }, 400);
  }

  // ----- Gate 2: Token exists, find signer + envelope -----------------------
  const tokenHash = hashSigningToken(body.token);
  const { data: signer, error: signerErr } = await supabase
    .from('sign_signers')
    .select(`
      id, envelope_id, role, email, name, status,
      token_expires_at, token_consumed_at,
      sign_envelopes!inner (
        id, status, template_id, template_version, filled_values,
        notion_lead_id, notion_listing_id, listing_business_name,
        sign_templates!inner ( id, source, source_sha256, fields_schema, disclosure_version_id )
      )
    `)
    .eq('token_sha256', tokenHash)
    .single();

  if (signerErr || !signer) {
    // Log security event without envelope context (we don't know it)
    console.warn('[sign/execute] invalid token presented:', tokenHash.slice(0, 8) + '...');
    return json({ error: 'invalid signing link' }, 401);
  }

  const envelope: any = (signer as any).sign_envelopes;
  const template: any = envelope.sign_templates;

  // ----- Gate 3: Token not expired ------------------------------------------
  if (signer.token_expires_at && new Date(signer.token_expires_at) < new Date()) {
    await logEvent({
      envelopeId: envelope.id,
      signerId:   signer.id,
      eventType:  'security.token_expired',
      attribution,
    });
    return json({ error: 'signing link expired' }, 410);
  }

  // ----- Gate 4: Token not consumed -----------------------------------------
  if (signer.token_consumed_at) {
    await logEvent({
      envelopeId: envelope.id,
      signerId:   signer.id,
      eventType:  'security.replay_attempt',
      attribution,
    });
    return json({ error: 'this document has already been signed' }, 409);
  }

  // ----- Gate 5: Envelope in valid state ------------------------------------
  if (!['sent', 'partially_signed'].includes(envelope.status)) {
    return json({ error: `envelope status '${envelope.status}' does not accept signatures` }, 409);
  }

  // ----- Gate 6: All required fields populated ------------------------------
  // Inject signature fields into fieldValues so validateRequiredFields can see them.
  // The signing page submits typedSignature/drawnSignatureSvg as top-level body
  // fields, but the schema lists buyer_typed_signature as required. Without this
  // merge, every real envelope would fail Gate 6. (Fix from 2026-05-01 scoping pass.)
  const fieldValuesForValidation = {
    ...body.fieldValues,
    buyer_typed_signature: body.typedSignature ?? body.fieldValues?.buyer_typed_signature ?? '',
    buyer_drawn_signature: body.drawnSignatureSvg ?? body.fieldValues?.buyer_drawn_signature ?? '',
  };
  const validation = validateRequiredFields(template.fields_schema, fieldValuesForValidation, signer.role);
  if (!validation.ok) {
    await logEvent({
      envelopeId: envelope.id,
      signerId:   signer.id,
      eventType:  'validation.failed',
      attribution,
      payload:    { reason: 'missing_required_fields', missing: validation.missing },
    });
    return json({ error: 'missing required fields', missing: validation.missing }, 400);
  }

  // ----- Gate 7: Consent checked --------------------------------------------
  if (!body.consentChecked) {
    return json({ error: 'consent is required' }, 400);
  }

  // ----- Gate 8: Disclosure version matches an active version ---------------
  const { data: disclosure, error: disErr } = await supabase
    .from('sign_disclosure_versions')
    .select('id, text_sha256, version_label')
    .eq('id', template.disclosure_version_id)
    .single();

  if (disErr || !disclosure) {
    return json({ error: 'disclosure version not found' }, 500);
  }
  if (disclosure.text_sha256 !== body.disclosureSha256ShownToSigner) {
    await logEvent({
      envelopeId: envelope.id,
      signerId:   signer.id,
      eventType:  'security.scroll_skipped', // closest fit; could add disclosure_mismatch
      attribution,
      payload: {
        expected: disclosure.text_sha256,
        received: body.disclosureSha256ShownToSigner,
      },
    });
    return json({ error: 'disclosure version mismatch — please reload and try again' }, 400);
  }

  // ----- Gate 9: Document hash matches re-render ----------------------------
  // Merge prefilled (broker) values with submitted (buyer) values.
  const mergedValues = { ...envelope.filled_values, ...body.fieldValues };
  const canonicalDocumentForHashing = canonicalizeDocumentInput(template.source, mergedValues);
  const expectedDocumentHash = sha256Hex(canonicalDocumentForHashing);

  if (expectedDocumentHash !== body.documentSha256ShownToSigner) {
    await logEvent({
      envelopeId: envelope.id,
      signerId:   signer.id,
      eventType:  'validation.failed',
      attribution,
      payload: {
        reason: 'document_hash_mismatch',
        expected: expectedDocumentHash,
        received: body.documentSha256ShownToSigner,
      },
    });
    return json({ error: 'document content has changed since you opened it' }, 409);
  }

  // ----- Gate 10: Scroll completion event exists ----------------------------
  if (!body.scrollCompleted) {
    await logEvent({
      envelopeId: envelope.id,
      signerId:   signer.id,
      eventType:  'security.scroll_skipped',
      attribution,
    });
    return json({ error: 'please scroll through the entire document before signing' }, 400);
  }

  const { data: scrollEvents } = await supabase
    .from('sign_events')
    .select('id')
    .eq('envelope_id', envelope.id)
    .eq('signer_id', signer.id)
    .eq('event_type', 'scroll.100')
    .limit(1);

  if (!scrollEvents || scrollEvents.length === 0) {
    await logEvent({
      envelopeId: envelope.id,
      signerId:   signer.id,
      eventType:  'security.scroll_skipped',
      attribution,
      payload:    { reason: 'no_scroll_100_event_in_log' },
    });
    return json({ error: 'scroll completion not recorded; please scroll through the document' }, 400);
  }

  // ----- Gate 11: IP/UA consistency (warn, don't block) ---------------------
  // Signers travel — they may open at the office and sign at home. Don't block,
  // but log if it changes so it's visible if disputed later.
  await checkAndLogIpUaChange(envelope.id, signer.id, attribution);

  // ===========================================================================
  // ALL GATES PASSED — RECORD THE SIGNATURE
  // ===========================================================================

  try {
    // Log validation passed
    const validationEventId = await logEvent({
      envelopeId:       envelope.id,
      signerId:         signer.id,
      eventType:        'validation.passed',
      documentSha256:   expectedDocumentHash,
      disclosureSha256: disclosure.text_sha256,
      attribution,
    });

    // Render signed PDF
    const signedPdfBuffer = await renderSignedPdf({
      template:          template.source,
      filledValues:      mergedValues,
      buyerTypedSignature: body.typedSignature,
      buyerDrawnSignatureSvg: body.drawnSignatureSvg,
      signedAt:          new Date(),
      signerEmail:       signer.email,
      signerIp:          attribution.ipAddress,
      envelopeNumber:    envelope.envelope_number,
    });
    const signedPdfHash = sha256Hex(signedPdfBuffer);

    // Upload signed PDF
    const signedPdfPath = `${envelope.id}/${signedPdfHash.slice(0, 8)}_signed.pdf`;
    const { error: upErr } = await supabase.storage
      .from('signed-documents')
      .upload(signedPdfPath, signedPdfBuffer, { contentType: 'application/pdf' });
    if (upErr) throw new Error(`signed PDF upload failed: ${upErr.message}`);

    // Render audit certificate (queries sign_events for full chronology)
    const auditPdfBuffer = await renderAuditCertificate({
      envelopeId:     envelope.id,
      envelopeNumber: envelope.envelope_number,
      signedPdfHash,
    });
    const auditPdfHash = sha256Hex(auditPdfBuffer);

    const auditPdfPath = `${envelope.id}/${auditPdfHash.slice(0, 8)}_audit.pdf`;
    const { error: auErr } = await supabase.storage
      .from('audit-certificates')
      .upload(auditPdfPath, auditPdfBuffer, { contentType: 'application/pdf' });
    if (auErr) throw new Error(`audit PDF upload failed: ${auErr.message}`);

    // Log the signing event (this is THE legal moment)
    const signingEventId = await logEvent({
      envelopeId:       envelope.id,
      signerId:         signer.id,
      eventType:        'signer.signed',
      documentSha256:   signedPdfHash,
      disclosureSha256: disclosure.text_sha256,
      attribution,
      payload: {
        method:           body.signatureMethod,
        typed_name:       body.typedSignature,
        has_drawn:        !!body.drawnSignatureSvg,
        consent_event_id: body.consentGivenEventId,
        validation_event_id: validationEventId,
      },
    });

    if (!signingEventId) {
      throw new Error('failed to log signing event');
    }

    // Insert signature record
    const { error: sigErr } = await supabase
      .from('sign_signatures')
      .insert({
        envelope_id:           envelope.id,
        signer_id:             signer.id,
        signature_method:      body.signatureMethod,
        typed_name:            body.typedSignature,
        drawn_signature_svg:   body.drawnSignatureSvg ?? null,
        document_sha256:       signedPdfHash,
        template_id:           template.id,
        template_version:      envelope.template_version,
        disclosure_version_id: disclosure.id,
        disclosure_sha256:     disclosure.text_sha256,
        consent_event_id:      body.consentGivenEventId,
        signer_email:          signer.email,
        signer_ip:             attribution.ipAddress ?? null,
        signer_user_agent:     attribution.userAgent ?? null,
        signer_geolocation:    attribution.geolocation ?? null,
        signing_session_id:    body.sessionId,
        signing_event_id:      signingEventId,
      });

    if (sigErr) throw new Error(`signature insert failed: ${sigErr.message}`);

    // Mark signer as signed, consume token
    await supabase
      .from('sign_signers')
      .update({
        status:            'signed',
        signed_at:         new Date().toISOString(),
        token_consumed_at: new Date().toISOString(),
      })
      .eq('id', signer.id);

    // Update envelope: completed (all signers signed)
    await supabase
      .from('sign_envelopes')
      .update({
        status:             'completed',
        completed_at:       new Date().toISOString(),
        signed_pdf_path:    signedPdfPath,
        signed_pdf_sha256:  signedPdfHash,
        audit_pdf_path:     auditPdfPath,
        audit_pdf_sha256:   auditPdfHash,
      })
      .eq('id', envelope.id);

    // Log envelope.signed
    await logEvent({
      envelopeId:     envelope.id,
      eventType:      'envelope.signed',
      documentSha256: signedPdfHash,
      attribution,
      payload:        { audit_pdf_hash: auditPdfHash },
    });

    // Get signed URLs for downloads (1 year)
    const { data: signedUrl } = await supabase.storage
      .from('signed-documents')
      .createSignedUrl(signedPdfPath, 60 * 60 * 24 * 365);

    const { data: auditUrl } = await supabase.storage
      .from('audit-certificates')
      .createSignedUrl(auditPdfPath, 60 * 60 * 24 * 365);

    // Sync to Notion (best-effort; don't block on failure)
    if (envelope.notion_lead_id) {
      try {
        await syncCompletedSignatureToNotion({
          notionPageId:    envelope.notion_lead_id,
          templateKey:     'NDA_BuyerProfile',
          fieldValues:     body.fieldValues,
          signedPdfUrl:    signedUrl?.signedUrl ?? '',
          auditPdfUrl:     auditUrl?.signedUrl ?? '',
          completedAt:     new Date().toISOString(),
          signerEmail:     signer.email,
          signerName:      body.typedSignature,
        });
      } catch (notionErr: any) {
        console.error('[sign/execute] notion sync failed (non-fatal):', notionErr.message);
      }
    }

    // Email signed copy to buyer + notification to broker
    Promise.all([
      sendSignedCopy({
        to:           signer.email,
        signedPdfUrl: signedUrl?.signedUrl ?? '',
        businessName: envelope.listing_business_name ?? 'the listing',
      }).catch((e: any) => console.error('[sign/execute] buyer email failed:', e.message)),
      sendBrokerNotification({
        envelopeNumber: envelope.envelope_number,
        signerEmail:    signer.email,
        signerName:     body.typedSignature,
        businessName:   envelope.listing_business_name ?? 'the listing',
        signedPdfUrl:   signedUrl?.signedUrl ?? '',
      }).catch((e: any) => console.error('[sign/execute] broker email failed:', e.message)),
    ]);

    return json({
      ok:             true,
      envelopeNumber: envelope.envelope_number,
      signedPdfUrl:   signedUrl?.signedUrl,
      auditPdfUrl:    auditUrl?.signedUrl,
    });
  } catch (err: any) {
    console.error('[sign/execute] signature recording failed:', err);
    await logEvent({
      envelopeId: envelope.id,
      signerId:   signer.id,
      eventType:  'validation.failed',
      attribution,
      payload:    { reason: 'recording_error', detail: err.message },
    });
    return json({ error: 'failed to record signature', detail: err.message }, 500);
  }
}

// ============================================================================
// Helpers
// ============================================================================

function json(body: any, status = 200) {
  return NextResponse.json(body, { status });
}

function validateRequiredFields(
  schema: any[],
  values: Record<string, any>,
  role: string
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const field of schema) {
    if (field.role !== role) continue;
    if (!field.required) continue;
    const v = values[field.name];
    if (v === undefined || v === null || v === '') {
      missing.push(field.name);
    }
  }
  return { ok: missing.length === 0, missing };
}

/** Produce the canonical bytes that get hashed to identify the document.
 *  Same template + same values → same hash, regardless of object key order. */
function canonicalizeDocumentInput(templateSource: any, mergedValues: Record<string, any>): string {
  return JSON.stringify({
    template: sortKeys(templateSource),
    values:   sortKeys(mergedValues),
  });
}

function sortKeys(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (typeof obj !== 'object') return obj;
  const sorted: any = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = sortKeys(obj[k]);
  return sorted;
}

async function checkAndLogIpUaChange(
  envelopeId: string,
  signerId: string,
  current: ReturnType<typeof attributionFromRequest>
): Promise<void> {
  const { data: openedEvent } = await supabase
    .from('sign_events')
    .select('ip_address, user_agent')
    .eq('envelope_id', envelopeId)
    .eq('signer_id', signerId)
    .eq('event_type', 'envelope.opened')
    .order('occurred_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!openedEvent) return;

  if (openedEvent.ip_address && openedEvent.ip_address !== current.ipAddress) {
    await logEvent({
      envelopeId,
      signerId,
      eventType:  'security.ip_changed',
      attribution: current,
      payload: { from: openedEvent.ip_address, to: current.ipAddress },
    });
  }
  if (openedEvent.user_agent && openedEvent.user_agent !== current.userAgent) {
    await logEvent({
      envelopeId,
      signerId,
      eventType:  'security.ua_changed',
      attribution: current,
      payload: { from: openedEvent.user_agent, to: current.userAgent },
    });
  }
}
