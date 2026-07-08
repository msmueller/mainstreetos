/**
 * MainStreetOS · Shared signing-completion core
 *
 * The "record the signature" sequence, factored out of /api/sign/execute so
 * that BOTH entry points run byte-for-byte identical completion logic:
 *
 *   1. /api/sign/execute        — token-based buyer signing (the /sign/[token] page)
 *   2. /api/nda-public-start    — per-listing public "Start NDA" page (no token;
 *                                 envelope + signer are minted server-side at
 *                                 submit, then completed in one shot)
 *
 * Keeping this in one place is a legal-integrity requirement, not just DRY:
 * the signed PDF, the audit certificate, the hash chain, and the Notion
 * write-back must be produced the same way regardless of how the buyer arrived,
 * or the two paths would drift and a dispute could turn on which door was used.
 *
 * This module assumes ALL validation gates have already passed. Callers own
 * their own gate logic (token checks, captcha/OTP, consent, scroll, hashes) and
 * hand this function a fully-resolved, already-authorized signing context.
 *
 * Behavior is preserved verbatim from the 2026-05..2026-07 execute route,
 * including: storage paths, event taxonomy, the Build A Notion-sync guard
 * (notion_lead_id present AND notion_synced_at null; stamped only on ok:true),
 * and the awaited (never fire-and-forget) buyer + broker emails.
 */

import { createClient } from '@supabase/supabase-js';
import { sha256Hex, buildDurableDownloadUrl } from './signing-tokens';
import { logEvent, type AttributionContext } from './audit-log';
import { renderSignedPdf, renderAuditCertificate } from './render-pdf';
import { syncCompletedSignatureToNotion } from './notion-sync-clickwrap';
import { sendSignedCopy, sendBrokerNotification } from './email';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// Types
// ============================================================================

/** The minimal envelope shape the completion core needs. Both entry points
 *  resolve (execute) or mint (public) an envelope row into this shape. */
export type CompletionEnvelope = {
  id: string;
  envelope_number: number;
  template_key: string;
  template_version: number;
  /** Broker-prefilled values captured at mint time (may be empty for the
   *  public path, where the buyer fills everything). */
  filled_values: Record<string, any>;
  notion_lead_id?: string | null;
  notion_listing_id?: string | null;
  notion_synced_at?: string | null;
  listing_business_name?: string | null;
};

export type CompletionSigner = {
  id: string;
  email: string;
};

export type CompletionTemplate = {
  id: string;
  /** The template's canonical `source` document (from sign_templates.source). */
  source: any;
};

export type CompletionDisclosure = {
  id: string;
  text_sha256: string;
};

export type CompleteSigningInput = {
  envelope: CompletionEnvelope;
  signer: CompletionSigner;
  template: CompletionTemplate;
  disclosure: CompletionDisclosure;

  /** Values used to RENDER the signed PDF: broker prefill merged with the
   *  buyer's submitted values. In execute this is
   *  `{ ...envelope.filled_values, ...body.fieldValues }`. */
  mergedValues: Record<string, any>;

  /** The buyer's OWN submitted values, passed straight to the Notion mapper.
   *  In execute this is `body.fieldValues` (NOT merged with broker prefill). */
  buyerFieldValues: Record<string, any>;

  signatureMethod: 'typed' | 'drawn' | 'typed_and_drawn';
  typedSignature: string;
  drawnSignatureSvg?: string;
  sessionId?: string;

  /** Event ids threaded into the sign_signatures row + signer.signed payload,
   *  exactly as execute records them. Either may be null when a path doesn't
   *  produce a discrete consent/validation event. */
  consentEventId?: number | null;
  validationEventId?: number | null;

  attribution: AttributionContext;

  /** Name written to Notion + broker email. Defaults to typedSignature
   *  (matches execute, which passes body.typedSignature as signerName). */
  signerName?: string;
};

export type CompleteSigningResult = {
  envelopeNumber: number;
  signedPdfUrl?: string;
  auditPdfUrl?: string;
  signedPdfHash: string;
  auditPdfHash: string;
};

// ============================================================================
// The completion core
// ============================================================================

/**
 * Record a signature: render the signed PDF + audit certificate, hash and
 * upload both, write the sign_signatures row, flip the signer + envelope to
 * signed/completed, log the signing events, sync to Notion (Build A, guarded),
 * and email the buyer + broker.
 *
 * Throws on any hard failure (PDF render, storage upload, DB write). Callers
 * should run this inside their try/catch and log a `validation.failed`
 * recording-error event, matching execute's existing error path.
 */
export async function completeSigning(
  input: CompleteSigningInput
): Promise<CompleteSigningResult> {
  const {
    envelope, signer, template, disclosure,
    mergedValues, buyerFieldValues,
    signatureMethod, typedSignature, drawnSignatureSvg, sessionId,
    consentEventId, validationEventId, attribution,
  } = input;
  const signerName = input.signerName ?? typedSignature;

  // ---- Render signed PDF ----------------------------------------------------
  const signedPdfBuffer = await renderSignedPdf({
    template:               template.source,
    filledValues:           mergedValues,
    buyerTypedSignature:    typedSignature,
    buyerDrawnSignatureSvg: drawnSignatureSvg,
    signedAt:               new Date(),
    signerEmail:            signer.email,
    signerIp:               attribution.ipAddress,
    envelopeNumber:         envelope.envelope_number,
  });
  const signedPdfHash = sha256Hex(signedPdfBuffer);

  // ---- Upload signed PDF ----------------------------------------------------
  const signedPdfPath = `${envelope.id}/${signedPdfHash.slice(0, 8)}_signed.pdf`;
  const { error: upErr } = await supabase.storage
    .from('signed-documents')
    .upload(signedPdfPath, signedPdfBuffer, { contentType: 'application/pdf' });
  if (upErr) throw new Error(`signed PDF upload failed: ${upErr.message}`);

  // ---- Render + upload audit certificate ------------------------------------
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

  // ---- Log the signing event (THE legal moment) -----------------------------
  const signingEventId = await logEvent({
    envelopeId:       envelope.id,
    signerId:         signer.id,
    eventType:        'signer.signed',
    documentSha256:   signedPdfHash,
    disclosureSha256: disclosure.text_sha256,
    attribution,
    payload: {
      method:              signatureMethod,
      typed_name:          typedSignature,
      has_drawn:           !!drawnSignatureSvg,
      consent_event_id:    consentEventId ?? null,
      validation_event_id: validationEventId ?? null,
    },
  });

  if (!signingEventId) {
    throw new Error('failed to log signing event');
  }

  // ---- Insert signature record ----------------------------------------------
  const { error: sigErr } = await supabase
    .from('sign_signatures')
    .insert({
      envelope_id:           envelope.id,
      signer_id:             signer.id,
      signature_method:      signatureMethod,
      typed_name:            typedSignature,
      drawn_signature_svg:   drawnSignatureSvg ?? null,
      document_sha256:       signedPdfHash,
      template_id:           template.id,
      template_version:      envelope.template_version,
      disclosure_version_id: disclosure.id,
      disclosure_sha256:     disclosure.text_sha256,
      consent_event_id:      consentEventId ?? null,
      signer_email:          signer.email,
      signer_ip:             attribution.ipAddress ?? null,
      signer_user_agent:     attribution.userAgent ?? null,
      signer_geolocation:    attribution.geolocation ?? null,
      signing_session_id:    sessionId ?? null,
      signing_event_id:      signingEventId,
    });

  if (sigErr) throw new Error(`signature insert failed: ${sigErr.message}`);

  // ---- Mark signer signed + consume token -----------------------------------
  const nowIso = new Date().toISOString();
  await supabase
    .from('sign_signers')
    .update({
      status:            'signed',
      signed_at:         nowIso,
      token_consumed_at: nowIso,
    })
    .eq('id', signer.id);

  // ---- Update envelope: completed -------------------------------------------
  await supabase
    .from('sign_envelopes')
    .update({
      status:            'completed',
      completed_at:      nowIso,
      signed_pdf_path:   signedPdfPath,
      signed_pdf_sha256: signedPdfHash,
      audit_pdf_path:    auditPdfPath,
      audit_pdf_sha256:  auditPdfHash,
    })
    .eq('id', envelope.id);

  // ---- Log envelope.signed --------------------------------------------------
  await logEvent({
    envelopeId:     envelope.id,
    eventType:      'envelope.signed',
    documentSha256: signedPdfHash,
    attribution,
    payload:        { audit_pdf_hash: auditPdfHash },
  });

  // ---- Signed URLs for downloads (1 year) -----------------------------------
  const { data: signedUrl } = await supabase.storage
    .from('signed-documents')
    .createSignedUrl(signedPdfPath, 60 * 60 * 24 * 365);

  const { data: auditUrl } = await supabase.storage
    .from('audit-certificates')
    .createSignedUrl(auditPdfPath, 60 * 60 * 24 * 365);

  // ---- Sync to Notion (Build A; feature-flagged, idempotent, non-fatal) -----
  // Guard: only when a lead is linked and it hasn't already been synced.
  // Stamp notion_synced_at ONLY on ok:true so the backfill/reconciler can
  // retry failures. Conditional (…IS NULL) stamp guards a racing reconciler.
  if (envelope.notion_lead_id && !envelope.notion_synced_at) {
    try {
      const syncResult = await syncCompletedSignatureToNotion({
        notionPageId:        envelope.notion_lead_id,
        templateKey:         envelope.template_key,
        fieldValues:         buyerFieldValues,
        signedPdfUrl:        signedUrl?.signedUrl ?? '',
        auditPdfUrl:         auditUrl?.signedUrl ?? '',
        signedNdaDurableUrl: buildDurableDownloadUrl({
          envelopeId: envelope.id,
          doc:        'nda',
          sha256:     signedPdfHash,
        }),
        completedAt:         new Date().toISOString(),
        signerEmail:         signer.email,
        signerName,
      });

      if (syncResult.ok) {
        await supabase
          .from('sign_envelopes')
          .update({ notion_synced_at: new Date().toISOString() })
          .eq('id', envelope.id)
          .is('notion_synced_at', null);
      }
    } catch (notionErr: any) {
      console.error('[complete-signing] notion sync failed (non-fatal):', notionErr.message);
    }
  }

  // ---- Email signed copy to buyer + notification to broker ------------------
  // MUST await — fire-and-forget Promises get killed when the Vercel
  // serverless function returns (2026-06-01 root-cause fix).
  await Promise.all([
    sendSignedCopy({
      to:           signer.email,
      signedPdfUrl: signedUrl?.signedUrl ?? '',
      businessName: envelope.listing_business_name ?? 'the listing',
    }).catch((e: any) => console.error('[complete-signing] buyer email failed:', e.message)),
    sendBrokerNotification({
      envelopeNumber: envelope.envelope_number,
      signerEmail:    signer.email,
      signerName,
      businessName:   envelope.listing_business_name ?? 'the listing',
      signedPdfUrl:   signedUrl?.signedUrl ?? '',
    }).catch((e: any) => console.error('[complete-signing] broker email failed:', e.message)),
  ]);

  return {
    envelopeNumber: envelope.envelope_number,
    signedPdfUrl:   signedUrl?.signedUrl,
    auditPdfUrl:    auditUrl?.signedUrl,
    signedPdfHash,
    auditPdfHash,
  };
}
