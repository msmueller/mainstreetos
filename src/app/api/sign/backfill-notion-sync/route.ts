/**
 * MainStreetOS · POST /api/sign/backfill-notion-sync
 *
 * One-time backfill (Build A, 2026-07-02): pushes the Notion LEAD write-back
 * for HISTORICAL completed envelopes that carry a notion_lead_id but were
 * signed before the sync was reliable (e.g. Royal Silk envelope 19).
 *
 * Selection (mirrors the completion-path idempotency guard):
 *   status='completed' AND notion_lead_id IS NOT NULL AND notion_synced_at IS NULL
 *
 * For each: re-sign the stored PDFs, rebuild the durable download URL, run
 * syncCompletedSignatureToNotion (same code path as live completion), and
 * stamp notion_synced_at only on success. Safe to re-run — already-stamped
 * envelopes are excluded by the query.
 *
 * Auth:  x-router-secret header === ROUTER_SECRET (same pattern as the Lead
 *        Router server-to-server endpoints).
 * Flag:  respects NDA_NOTION_SYNC via the sync itself — with the flag off,
 *        each envelope reports skipped:'flag_off' and nothing is stamped.
 * Query: ?dry_run=true lists candidates without calling Notion or stamping.
 *
 * Usage:
 *   curl -X POST 'https://www.mainstreetos.biz/api/sign/backfill-notion-sync?dry_run=true' \
 *        -H "x-router-secret: $ROUTER_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildDurableDownloadUrl } from '@/lib/signing-tokens';
import {
  syncCompletedSignatureToNotion,
  ndaNotionSyncEnabled,
} from '@/lib/notion-sync-clickwrap';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  // ----- Auth ----------------------------------------------------------------
  const auth = req.headers.get('x-router-secret');
  if (!process.env.ROUTER_SECRET || auth !== process.env.ROUTER_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const dryRun = new URL(req.url).searchParams.get('dry_run') === 'true';

  // ----- Candidates ------------------------------------------------------------
  const { data: envelopes, error } = await supabase
    .from('sign_envelopes')
    .select(`
      id, envelope_number, template_key, filled_values, completed_at,
      notion_lead_id, signed_pdf_path, signed_pdf_sha256, audit_pdf_path
    `)
    .eq('status', 'completed')
    .not('notion_lead_id', 'is', null)
    .is('notion_synced_at', null)
    .order('completed_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'query failed', detail: error.message }, { status: 500 });
  }

  if (dryRun) {
    return NextResponse.json({
      dry_run: true,
      flag_enabled: ndaNotionSyncEnabled(),
      candidates: (envelopes ?? []).map((e) => ({
        envelope_number: e.envelope_number,
        id: e.id,
        template_key: e.template_key,
        notion_lead_id: e.notion_lead_id,
        completed_at: e.completed_at,
      })),
    });
  }

  // ----- Backfill ----------------------------------------------------------------
  const results: any[] = [];

  for (const envelope of envelopes ?? []) {
    try {
      // Buyer signer for name/email attribution in the Notion comment.
      const { data: buyerSigner } = await supabase
        .from('sign_signers')
        .select('email, name')
        .eq('envelope_id', envelope.id)
        .eq('role', 'buyer')
        .maybeSingle();

      const [{ data: signedUrl }, { data: auditUrl }] = await Promise.all([
        supabase.storage.from('signed-documents').createSignedUrl(envelope.signed_pdf_path, 60 * 60 * 24 * 365),
        supabase.storage.from('audit-certificates').createSignedUrl(envelope.audit_pdf_path, 60 * 60 * 24 * 365),
      ]);

      const syncResult = await syncCompletedSignatureToNotion({
        notionPageId: envelope.notion_lead_id,
        templateKey:  envelope.template_key,
        // Backfill note: filled_values holds the broker prefill (buyer-typed
        // values were not persisted onto the envelope pre-Build A). The core
        // patch (Completed NDA / date / Status / Pipeline Stage / URLs) does
        // not depend on them; buyer fields are written only when present.
        fieldValues:  envelope.filled_values ?? {},
        signedPdfUrl: signedUrl?.signedUrl ?? '',
        auditPdfUrl:  auditUrl?.signedUrl ?? '',
        signedNdaDurableUrl: envelope.signed_pdf_sha256
          ? buildDurableDownloadUrl({ envelopeId: envelope.id, doc: 'nda', sha256: envelope.signed_pdf_sha256 })
          : undefined,
        completedAt:  envelope.completed_at,
        signerEmail:  buyerSigner?.email ?? '',
        signerName:   buyerSigner?.name ?? buyerSigner?.email ?? 'Buyer',
      });

      if (syncResult.ok) {
        await supabase
          .from('sign_envelopes')
          .update({ notion_synced_at: new Date().toISOString() })
          .eq('id', envelope.id)
          .is('notion_synced_at', null);
      }

      results.push({ envelope_number: envelope.envelope_number, id: envelope.id, ...syncResult });
    } catch (err: any) {
      results.push({ envelope_number: envelope.envelope_number, id: envelope.id, ok: false, error: err.message });
    }
  }

  return NextResponse.json({
    flag_enabled: ndaNotionSyncEnabled(),
    processed: results.length,
    synced: results.filter((r) => r.ok).length,
    results,
  });
}
