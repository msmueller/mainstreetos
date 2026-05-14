/**
 * MainStreetOS · GET /api/sign/load?token={token}
 *
 * Called when the signing page mounts. Returns everything the signing UI
 * needs to render the document and its disclosure.
 *
 * This endpoint is deliberately conservative about what it returns:
 * - It does NOT return the raw token
 * - It does NOT return information about other signers
 * - It does NOT return audit log contents
 *
 * Place at: app/api/sign/load/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hashSigningToken, isWellFormedToken, sha256Hex } from '@/lib/signing-tokens';
import { logEvent, attributionFromRequest } from '@/lib/audit-log';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const attribution = attributionFromRequest(req);

  if (!token || !isWellFormedToken(token)) {
    return json({ error: 'invalid signing link' }, 400);
  }

  const tokenHash = hashSigningToken(token);

  const { data: signer, error } = await supabase
    .from('sign_signers')
    .select(`
      id, envelope_id, role, email, name, status,
      token_expires_at, token_consumed_at, first_opened_at,
      sign_envelopes!inner (
        id, envelope_number, status, template_id, template_version,
        filled_values, listing_business_name, notion_listing_id,
        sign_templates!inner (
          id, source, source_sha256, fields_schema, disclosure_version_id,
          sign_disclosure_versions ( id, version_label, disclosure_text, text_sha256 )
        )
      )
    `)
    .eq('token_sha256', tokenHash)
    .single();

  if (error || !signer) {
    return json({ error: 'invalid or expired signing link' }, 401);
  }

  const env: any = (signer as any).sign_envelopes;
  const tpl: any = env.sign_templates;
  // Disclosure is embedded under sign_templates (it has the FK), not under sign_envelopes.
  // Fall back to a direct fetch if the embed returned null for any reason.
  const disclosure: any = tpl.sign_disclosure_versions ?? (await fetchDisclosure(tpl.disclosure_version_id));

  // Token expiry check
  if (signer.token_expires_at && new Date(signer.token_expires_at) < new Date()) {
    await logEvent({
      envelopeId: env.id, signerId: signer.id,
      eventType: 'security.token_expired', attribution,
    });
    return json({ error: 'this signing link has expired' }, 410);
  }
  if (signer.token_consumed_at) {
    return json({ error: 'this document has already been signed' }, 409);
  }
  if (env.status !== 'sent' && env.status !== 'partially_signed') {
    return json({ error: `envelope is ${env.status}` }, 409);
  }

  // First-open logging (only if first time)
  if (!signer.first_opened_at) {
    await supabase.from('sign_signers')
      .update({ first_opened_at: new Date().toISOString(), last_opened_at: new Date().toISOString(), status: 'opened' })
      .eq('id', signer.id);
    await logEvent({
      envelopeId: env.id, signerId: signer.id,
      eventType: 'envelope.opened', attribution,
      payload: { first_open: true },
    });
  } else {
    await supabase.from('sign_signers')
      .update({ last_opened_at: new Date().toISOString() })
      .eq('id', signer.id);
    await logEvent({
      envelopeId: env.id, signerId: signer.id,
      eventType: 'signer.opened', attribution,
      payload: { first_open: false },
    });
  }

  // Compute the canonical document hash that signing will validate against
  const documentSha256 = sha256Hex(JSON.stringify({
    template: sortKeys(tpl.source),
    values:   sortKeys(env.filled_values),
  }));

  // Resolve listing context (cheap fields only — full listing data is in env.filled_values)
  const listing = {
    businessName: env.filled_values.business_name,
    industry:     env.filled_values.industry,
    location:     env.filled_values.location,
  };

  return json({
    envelopeId:      env.id,
    envelopeNumber:  env.envelope_number,
    templateKey:     'NDA_BuyerProfile',
    templateVersion: env.template_version,
    templateSource:  tpl.source,
    filledValues:    env.filled_values,
    fieldsSchema:    tpl.fields_schema,
    documentSha256,
    disclosure: {
      versionLabel: disclosure.version_label,
      text:         disclosure.disclosure_text,
      sha256:       disclosure.text_sha256,
    },
    signer: {
      id:    signer.id,
      role:  signer.role,
      email: signer.email,
      name:  signer.name,
    },
    listing,
  });
}

async function fetchDisclosure(id: string) {
  const { data } = await supabase
    .from('sign_disclosure_versions')
    .select('id, version_label, disclosure_text, text_sha256')
    .eq('id', id)
    .single();
  return data;
}

function sortKeys(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (typeof obj !== 'object') return obj;
  const sorted: any = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = sortKeys(obj[k]);
  return sorted;
}

function json(body: any, status = 200) {
  return NextResponse.json(body, { status });
}
