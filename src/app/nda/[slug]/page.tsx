/**
 * MainStreetOS · Per-listing public "Start NDA" page (server component)
 *
 * Route: /nda/[slug]  (e.g. /nda/yogi-international, /nda/royal-silk)
 * Build Spec v1.0 §6.
 *
 * A reusable, listing-scoped public link. A non-BBS prospect self-identifies
 * (name + email), reads the NDA, fills the Buyer Profile, and signs — no
 * pre-minted per-buyer link. This server component:
 *   1. 404s unless NDA_PUBLIC_PAGE is on (ships dark).
 *   2. Reads the listing via the get_public_listing_by_slug RPC (whitelisted
 *      fields only — no anon access to base tables).
 *   3. Reads the active template source + fields schema + ESIGN disclosure
 *      server-side (service role) so the client can render the exact document.
 *   4. Hands everything to the client form, which posts to /api/nda-public-start.
 */

import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import PublicNdaClient from './PublicNdaClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function featureEnabled(): boolean {
  const v = (process.env.NDA_PUBLIC_PAGE ?? '').trim().toLowerCase();
  return v === 'on' || v === 'true' || v === '1';
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  if (!featureEnabled()) notFound();

  const { slug } = await params;

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // 1. Listing (via the public RPC — whitelisted fields only).
  const { data: rpcRows, error: rpcErr } = await supabase.rpc('get_public_listing_by_slug', { p_slug: slug });
  const listing = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
  if (rpcErr || !listing || !listing.template_key) notFound();

  // 2. Active template for this listing.
  const { data: template, error: tplErr } = await supabase
    .from('sign_templates')
    .select('template_key, version, source, fields_schema, disclosure_version_id')
    .eq('template_key', listing.template_key)
    .eq('active', true)
    .order('version', { ascending: false })
    .limit(1)
    .single();
  if (tplErr || !template) notFound();

  // 3. ESIGN disclosure text shown above the Sign button.
  const { data: disclosure } = await supabase
    .from('sign_disclosure_versions')
    .select('version_label, disclosure_text')
    .eq('id', template.disclosure_version_id)
    .single();

  return (
    <PublicNdaClient
      slug={slug}
      businessName={listing.business_name ?? 'this business'}
      listingTitle={listing.listing_title ?? ''}
      omLink={listing.om_link ?? ''}
      blurb={listing.blurb ?? ''}
      templateSource={template.source}
      fieldsSchema={(template.fields_schema ?? []) as any[]}
      disclosure={{
        versionLabel: disclosure?.version_label ?? 'ESIGN_CONSENT',
        text: disclosure?.disclosure_text ?? '',
      }}
      turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''}
    />
  );
}
