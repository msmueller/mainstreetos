/**
 * MainStreetOS · GET /api/sign/download/[envelopeId]/[doc]?k=<key>
 *
 * Durable download link for completed-envelope documents. This is the URL
 * written into the Notion LEAD "Signed NDA URL" property (Build A) — storage
 * signed URLs expire after at most 1 year, so Notion gets THIS route instead,
 * and each click re-signs the storage object for 1 hour and 302-redirects.
 *
 *   doc = 'nda'   → signed_pdf_path   (bucket: signed-documents)
 *   doc = 'audit' → audit_pdf_path    (bucket: audit-certificates)
 *
 * Access control: capability URL. The caller must present k = the first 16 hex
 * chars of the document's SHA-256 (signed_pdf_sha256 / audit_pdf_sha256).
 * Both the envelope UUID and the hash prefix are unguessable, and the storage
 * path itself is never exposed without a fresh signed URL (spec §7 security).
 *
 * Any failure returns 404 without detail — don't leak envelope existence.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from '@/lib/signing-tokens';
// URL construction lives in lib/signing-tokens.ts (buildDurableDownloadUrl) —
// route files may only export handlers.

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour per click

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ envelopeId: string; doc: string }> }
) {
  const { envelopeId, doc } = await context.params;
  const key = new URL(req.url).searchParams.get('k') ?? '';

  if (!/^[0-9a-f-]{36}$/i.test(envelopeId)) return notFound();
  if (doc !== 'nda' && doc !== 'audit') return notFound();
  if (!/^[0-9a-f]{16}$/i.test(key)) return notFound();

  const { data: envelope } = await supabase
    .from('sign_envelopes')
    .select('id, status, signed_pdf_path, signed_pdf_sha256, audit_pdf_path, audit_pdf_sha256')
    .eq('id', envelopeId)
    .eq('status', 'completed')
    .maybeSingle();

  if (!envelope) return notFound();

  const path   = doc === 'nda' ? envelope.signed_pdf_path   : envelope.audit_pdf_path;
  const sha256 = doc === 'nda' ? envelope.signed_pdf_sha256 : envelope.audit_pdf_sha256;
  const bucket = doc === 'nda' ? 'signed-documents' : 'audit-certificates';

  if (!path || !sha256) return notFound();
  if (!timingSafeEqual(key.toLowerCase(), String(sha256).slice(0, 16))) return notFound();

  const { data: signed } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (!signed?.signedUrl) return notFound();

  return NextResponse.redirect(signed.signedUrl, 302);
}

function notFound() {
  return NextResponse.json({ error: 'not found' }, { status: 404 });
}
