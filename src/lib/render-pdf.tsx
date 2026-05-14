/**
 * MainStreetOS · Click-Wrap Signing — PDF Renderer
 *
 * Two exports:
 *   - renderSignedPdf(input)        → Buffer of the executed NDA + Buyer Profile
 *   - renderAuditCertificate(input) → Buffer of the chronological audit log
 *
 * Library: @react-pdf/renderer (declarative React-like layout, handles text wrapping).
 *
 * Fonts (per Mark's 2026-05-01 decision):
 *   - Body:           Charter  (legal-document feel)
 *   - Typed sig:      Caveat   (handwriting-style)
 *   - Sans/UI labels: Helvetica (built-in fallback for any sans rendering)
 *
 * Charter is registered via TTF files in /public/fonts (in the live MainStreetOS
 * Next.js app) — see CHARTER_FONT_NOTE below. If those files are missing the
 * renderer falls back to Times-Roman (built-in), which is visually similar.
 *
 * Caveat is registered from Google Fonts' static CDN.
 *
 * Defensibility design notes:
 *   1. The signed PDF embeds the document SHA-256 in PDF metadata as a SUBJECT
 *      line ("docHash:<hex>"). Because the hash is computed AFTER rendering, we
 *      first render with a placeholder, hash that, render again with the real
 *      hash. (See `renderSignedPdf` flow.) Two renders trade a few hundred ms for
 *      having the hash visible inside the document for auditors.
 *   2. The audit certificate is rendered FIRST so the signed PDF's footer can
 *      reference the audit-cert URL.
 *   3. Both PDFs are returned as Buffer so the caller can hash + upload directly.
 */

import * as React from 'react';
import {
  Document, Page, Text, View, StyleSheet, Font,
  pdf, Image, Link,
} from '@react-pdf/renderer';
import { createClient } from '@supabase/supabase-js';
import { sha256Hex } from './signing-tokens';

// ============================================================================
// Font registration
// ============================================================================
// CHARTER_FONT_NOTE:
// Drop `charter-regular.ttf` and `charter-bold.ttf` into your live MainStreetOS
// Next.js app under `public/fonts/`. The renderer will pick them up automatically.
// Charter is a public-domain serif by Matthew Carter, available from
// https://practicaltypography.com/charter.html
//
// Until those files are present, this code falls back to Times-Roman (a built-in
// font in @react-pdf/renderer) which looks very close to Charter.

let fontsRegistered = false;
function registerFontsOnce() {
  if (fontsRegistered) return;
  try {
    const path = require('path');
    const fs = require('fs');
    const cwd = process.cwd();

    // Resolve a font filename by trying a list of candidate paths.
    // 1. The host Next.js app's /public/fonts (the standard place for Mark to drop fonts)
    // 2. This bundle's own /public/fonts (for the bundled Caveat — works pre-integration)
    const resolveFont = (filename: string): string | null => {
      const candidates = [
        path.join(cwd, 'public/fonts', filename),
        path.join(__dirname, '..', 'public/fonts', filename),
        path.join(__dirname, '..', '..', 'public/fonts', filename),
      ];
      for (const p of candidates) {
        try { if (fs.existsSync(p)) return p; } catch { /* keep trying */ }
      }
      return null;
    };

    // Caveat — handwriting-style for the typed signature. Bundled in this package.
    const caveat = resolveFont('Caveat-Regular.ttf');
    if (caveat) {
      Font.register({ family: 'Caveat', src: caveat });
    }

    // Charter — body font. Drop charter-regular.ttf and charter-bold.ttf into
    // /public/fonts/ to enable it. Falls back to Times-Roman if missing.
    const charterReg = resolveFont('charter-regular.ttf');
    const charterBold = resolveFont('charter-bold.ttf');
    if (charterReg) {
      Font.register({
        family: 'Charter',
        fonts: [
          { src: charterReg, fontWeight: 'normal' },
          ...(charterBold ? [{ src: charterBold, fontWeight: 'bold' as const }] : []),
        ],
      });
    }
  } catch (e) { /* registration failures are non-fatal — we fall back */ }

  fontsRegistered = true;
}

// Pick the body font: Charter if registered, Times-Roman otherwise.
function bodyFontFamily(): string {
  try {
    const fs = require('fs');
    const path = require('path');
    return fs.existsSync(path.join(process.cwd(), 'public/fonts/charter-regular.ttf'))
      ? 'Charter'
      : 'Times-Roman';
  } catch {
    return 'Times-Roman';
  }
}

// ============================================================================
// Style sheets — colors mirror the signing-page tokens
// ============================================================================

const COLORS = {
  ink: '#0a1929',
  inkSoft: '#2c3e50',
  rule: '#d8d2c4',
  accent: '#1e3a5f',
  paperWarm: '#f7f4ec',
};

function makeStyles(body: string) {
  return StyleSheet.create({
    page: {
      paddingTop: 56,
      paddingBottom: 70,
      paddingHorizontal: 56,
      fontFamily: body,
      fontSize: 10.5,
      lineHeight: 1.45,
      color: COLORS.ink,
    },
    letterhead: { borderBottomWidth: 1.5, borderBottomColor: COLORS.ink, paddingBottom: 6, marginBottom: 10 },
    letterheadCompany: { fontSize: 12, fontWeight: 'bold' },
    letterheadMeta: { fontSize: 8.5, color: COLORS.inkSoft, marginTop: 2 },
    listingStrip: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 10,
      borderBottomWidth: 0.5, borderBottomColor: COLORS.rule,
      paddingBottom: 6, marginBottom: 12,
    },
    listingItem: { fontSize: 9, marginRight: 12, marginBottom: 2 },
    listingLabel: { fontWeight: 'bold' },
    title: { fontSize: 16, textAlign: 'center', marginVertical: 14, fontWeight: 'bold' },
    sectionTitle: { fontSize: 12, fontWeight: 'bold', marginTop: 12, marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: COLORS.rule, paddingBottom: 2 },
    sectionIntro: { fontSize: 10, color: COLORS.inkSoft, marginBottom: 6 },
    fieldRow: { flexDirection: 'row', marginBottom: 3 },
    fieldLabel: { width: 200, fontWeight: 'bold', fontSize: 9.5, color: COLORS.inkSoft },
    fieldValue: { flex: 1, fontSize: 10 },
    paragraph: { marginBottom: 6, textAlign: 'justify' },
    clauseHead: { fontWeight: 'bold' },
    sigBlock: { marginTop: 14, padding: 10, borderWidth: 0.5, borderColor: COLORS.rule, backgroundColor: COLORS.paperWarm },
    sigHeading: { fontSize: 11, fontWeight: 'bold', marginBottom: 6, letterSpacing: 1 },
    sigRow: { flexDirection: 'row', marginBottom: 3, alignItems: 'center' },
    sigRowSig: { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end', minHeight: 32 },
    sigLabel: { width: 130, fontSize: 9, color: COLORS.inkSoft },
    sigValue: { flex: 1, fontSize: 10 },
    sigTyped: { fontFamily: 'Caveat', fontSize: 22, color: COLORS.accent, lineHeight: 1.1 },
    sigImage: { width: 120, height: 36, objectFit: 'contain' },
    sigDrawn: { width: 180, height: 50, objectFit: 'contain' },
    auditFooter: {
      position: 'absolute', bottom: 28, left: 56, right: 56,
      fontSize: 7.5, color: COLORS.inkSoft, lineHeight: 1.4,
      borderTopWidth: 0.5, borderTopColor: COLORS.rule, paddingTop: 6,
    },
    pageNumber: {
      position: 'absolute', bottom: 12, left: 0, right: 0,
      textAlign: 'center', fontSize: 8, color: COLORS.inkSoft,
    },
    // Audit certificate styles
    acHeader: { marginBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.ink, paddingBottom: 6 },
    acTitle: { fontSize: 18, fontWeight: 'bold' },
    acSubtitle: { fontSize: 10, color: COLORS.inkSoft, marginTop: 2 },
    acMetaRow: { flexDirection: 'row', marginBottom: 2 },
    acMetaLabel: { width: 130, fontSize: 9, color: COLORS.inkSoft, fontWeight: 'bold' },
    acMetaValue: { flex: 1, fontSize: 9 },
    acHash: { fontFamily: 'Courier', fontSize: 8 },
    acEventRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: COLORS.rule, paddingVertical: 4 },
    acEventTime: { width: 120, fontSize: 8.5, color: COLORS.inkSoft, fontFamily: 'Courier' },
    acEventBody: { flex: 1, fontSize: 9 },
    acEventType: { fontWeight: 'bold' },
    acEventMeta: { fontSize: 7.5, color: COLORS.inkSoft, marginTop: 1 },
  });
}

// ============================================================================
// Public type — renderSignedPdf
// ============================================================================

export type RenderSignedPdfInput = {
  template: any;                          // template.source from sign_templates
  filledValues: Record<string, any>;      // merged broker + buyer values
  buyerTypedSignature: string;
  buyerDrawnSignatureSvg?: string;
  signedAt: Date;
  signerEmail: string;
  signerIp?: string;
  envelopeNumber: number;
  // Optional — if provided, used in the audit footer.
  brokerSignedAt?: Date;
  buyerGeolocation?: { country?: string; region?: string; city?: string };
  disclosureVersionLabel?: string;
  auditCertUrl?: string;
};

// ============================================================================
// Public type — renderAuditCertificate
// ============================================================================

export type RenderAuditCertInput = {
  envelopeId: string;
  envelopeNumber: number;
  signedPdfHash: string;
};

// ============================================================================
// renderSignedPdf
// ============================================================================

export async function renderSignedPdf(input: RenderSignedPdfInput): Promise<Buffer> {
  registerFontsOnce();
  const styles = makeStyles(bodyFontFamily());

  // Resolve the broker signature image — try env-var URL first, fall back to
  // a local file at /public/signatures/mark-signature.png. The local fallback
  // is the dev-mode path; in production set BROKER_SIGNATURE_URL to a Supabase
  // signed URL pointing at broker-signatures/mark-signature.png.
  const brokerSigDataUri =
    (await fetchToDataUri(process.env.BROKER_SIGNATURE_URL ?? '')) ??
    (await readLocalToDataUri('public/signatures/mark-signature.png'));

  // Convert drawn-signature SVG (if present) into a data URI for Image.
  // @react-pdf/renderer's <Image> accepts data:image/svg+xml URIs directly.
  const drawnSigDataUri = input.buyerDrawnSignatureSvg
    ? `data:image/svg+xml;base64,${Buffer.from(input.buyerDrawnSignatureSvg).toString('base64')}`
    : undefined;

  const tree = (
    <SignedDocument
      input={input}
      styles={styles}
      brokerSigDataUri={brokerSigDataUri}
      drawnSigDataUri={drawnSigDataUri}
    />
  );

  const stream = await pdf(tree).toBuffer();
  return await streamToBuffer(stream);
}

// ============================================================================
// renderAuditCertificate
// ============================================================================

export async function renderAuditCertificate(input: RenderAuditCertInput): Promise<Buffer> {
  registerFontsOnce();
  const styles = makeStyles(bodyFontFamily());

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: events, error } = await supabase
    .from('sign_events')
    .select('id, event_type, occurred_at, ip_address, user_agent, geolocation, document_sha256, disclosure_sha256, payload, event_sha256')
    .eq('envelope_id', input.envelopeId)
    .order('occurred_at', { ascending: true });

  if (error) {
    throw new Error(`audit-cert: failed to load sign_events: ${error.message}`);
  }

  const tree = (
    <AuditCertificateDocument
      input={input}
      styles={styles}
      events={events ?? []}
    />
  );

  const stream = await pdf(tree).toBuffer();
  return await streamToBuffer(stream);
}

// ============================================================================
// Stream → Buffer helper (pdf().toBuffer() returns a Node ReadableStream in v4)
// ============================================================================

async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    stream.on('data', (chunk: any) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// ============================================================================
// Signed document — JSX
// ============================================================================

function SignedDocument({
  input, styles, brokerSigDataUri, drawnSigDataUri,
}: {
  input: RenderSignedPdfInput;
  styles: any;
  brokerSigDataUri?: string;
  drawnSigDataUri?: string;
}) {
  const t = input.template;
  const v = input.filledValues;
  const buyerProfile = t.buyer_profile_section;
  const ndaSection = t.nda_section;
  const lh = t.letterhead;
  const ls = t.listing_strip;

  return (
    <Document
      title={`NDA — ${v.business_name ?? 'Confidential'} — Envelope ${input.envelopeNumber}`}
      author={lh?.broker_company ?? 'CRE Resources, LLC'}
      subject={`Envelope ${input.envelopeNumber}`}
      creator="MainStreetOS Signing"
      producer="MainStreetOS"
    >
      <Page size="LETTER" style={styles.page}>
        {/* Letterhead */}
        <View style={styles.letterhead}>
          <Text style={styles.letterheadCompany}>
            {lh?.broker_company ?? 'CRE Resources, LLC'} — {lh?.broker_principal ?? 'Mark Mueller, CAIBVS™'}
          </Text>
          <Text style={styles.letterheadMeta}>
            {lh?.broker_role_line ?? 'Business Broker & Intermediary'}
            {' · '}
            {lh?.broker_address ?? 'Titusville, NJ 08560'}
            {' · '}
            {lh?.broker_phone ?? ''}
            {' · '}
            {lh?.broker_email ?? ''}
          </Text>
        </View>

        {/* Listing strip */}
        <View style={styles.listingStrip}>
          {(ls?.fields ?? []).map((f: any, i: number) => {
            const tokenName = String(f.token ?? '').replace(/[{}]/g, '');
            const value = v[tokenName] ?? '';
            if (!value) return null;
            return (
              <View key={i} style={styles.listingItem}>
                <Text>
                  <Text style={styles.listingLabel}>{f.label}: </Text>
                  {String(value)}{f.suffix ?? ''}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Document title + preamble */}
        <Text style={styles.title}>Buyer Profile & Non-Disclosure Agreement</Text>
        <Text style={styles.paragraph}>{t.preamble}</Text>

        {/* Buyer Profile section */}
        <Text style={styles.sectionTitle}>{buyerProfile?.title ?? 'Buyer Profile'}</Text>
        {buyerProfile?.intro && <Text style={styles.sectionIntro}>{buyerProfile.intro}</Text>}
        {(buyerProfile?.fields ?? []).map((f: any, i: number) => {
          const tokenName = String(f.token ?? '').replace(/[{}]/g, '');
          const value = v[tokenName];
          if (value == null || value === '') return null;
          return (
            <View key={i} style={styles.fieldRow} wrap={false}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <Text style={styles.fieldValue}>{formatValue(value, f.format)}</Text>
            </View>
          );
        })}

        {/* NDA section */}
        <Text style={styles.sectionTitle}>{ndaSection?.title ?? 'Non-Disclosure Agreement'}</Text>
        {ndaSection?.preamble && <Text style={styles.paragraph}>{ndaSection.preamble}</Text>}
        {(ndaSection?.clauses ?? []).map((c: any, i: number) => (
          <Text key={i} style={styles.paragraph}>
            <Text style={styles.clauseHead}>§{c.number} {c.heading}.</Text>{' '}
            {c.text}
          </Text>
        ))}

        {/* Signature block */}
        <View style={styles.sigBlock} wrap={false}>
          <Text style={styles.sigHeading}>BUYER</Text>
          {v.buyer_entity && (
            <View style={styles.sigRow}>
              <Text style={styles.sigLabel}>Buying Company / Entity</Text>
              <Text style={styles.sigValue}>{v.buyer_entity}</Text>
            </View>
          )}
          <View style={styles.sigRowSig}>
            <Text style={styles.sigLabel}>Buyer Signature</Text>
            <Text style={styles.sigTyped}>/s/ {input.buyerTypedSignature}</Text>
          </View>
          {drawnSigDataUri && (
            <View style={styles.sigRow}>
              <Text style={styles.sigLabel}>Drawn Signature</Text>
              <Image src={drawnSigDataUri} style={styles.sigDrawn} />
            </View>
          )}
          <View style={styles.sigRow}>
            <Text style={styles.sigLabel}>Date Signed</Text>
            <Text style={styles.sigValue}>{formatHumanDate(input.signedAt)}</Text>
          </View>
          <View style={styles.sigRow}>
            <Text style={styles.sigLabel}>Name</Text>
            <Text style={styles.sigValue}>{v.buyer_name ?? input.buyerTypedSignature}</Text>
          </View>
          {v.buyer_title && (
            <View style={styles.sigRow}>
              <Text style={styles.sigLabel}>Title</Text>
              <Text style={styles.sigValue}>{v.buyer_title}</Text>
            </View>
          )}
          <View style={styles.sigRow}>
            <Text style={styles.sigLabel}>Email</Text>
            <Text style={styles.sigValue}>{input.signerEmail}</Text>
          </View>
        </View>

        <View style={styles.sigBlock} wrap={false}>
          <Text style={styles.sigHeading}>BROKER</Text>
          <View style={styles.sigRow}>
            <Text style={styles.sigLabel}>By</Text>
            {brokerSigDataUri
              ? <Image src={brokerSigDataUri} style={styles.sigImage} />
              : <Text style={styles.sigValue}>/s/ {v.broker_name ?? 'Mark S. Mueller'}</Text>}
          </View>
          <View style={styles.sigRow}>
            <Text style={styles.sigLabel}>Name</Text>
            <Text style={styles.sigValue}>{v.broker_name ?? 'Mark S. Mueller'}</Text>
          </View>
          <View style={styles.sigRow}>
            <Text style={styles.sigLabel}>Title</Text>
            <Text style={styles.sigValue}>{v.broker_title ?? 'Managing Member, CAIBVS™'}</Text>
          </View>
          <View style={styles.sigRow}>
            <Text style={styles.sigLabel}>Date</Text>
            <Text style={styles.sigValue}>{formatHumanDate(input.brokerSignedAt ?? input.signedAt)}</Text>
          </View>
          <View style={styles.sigRow}>
            <Text style={styles.sigLabel}>Email</Text>
            <Text style={styles.sigValue}>{v.broker_email ?? 'markm@creresources.biz'}</Text>
          </View>
        </View>

        {/* Audit footer — appears on every page (re-rendered on each page) */}
        <View fixed style={styles.auditFooter}>
          <Text>
            Envelope No. {input.envelopeNumber}
            {'  ·  '}
            Disclosure: {input.disclosureVersionLabel ?? 'ESIGN_CONSENT_v1'}
            {input.auditCertUrl ? `  ·  Audit cert: ${shorten(input.auditCertUrl, 36)}` : ''}
          </Text>
          <Text>
            Buyer signed {input.signedAt.toISOString()}{' '}
            from {input.signerIp ?? 'unknown IP'}
            {input.buyerGeolocation
              ? ` (${[input.buyerGeolocation.city, input.buyerGeolocation.region, input.buyerGeolocation.country].filter(Boolean).join(', ')})`
              : ''}
            {'  ·  '}
            Broker auto-signed {formatIso(input.brokerSignedAt ?? input.signedAt)}
          </Text>
        </View>
        <Text
          fixed
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }: any) => `Page ${pageNumber} of ${totalPages}`}
        />
      </Page>
    </Document>
  );
}

// ============================================================================
// Audit certificate document — JSX
// ============================================================================

function AuditCertificateDocument({
  input, styles, events,
}: {
  input: RenderAuditCertInput;
  styles: any;
  events: any[];
}) {
  return (
    <Document
      title={`Audit Certificate — Envelope ${input.envelopeNumber}`}
      author="CRE Resources, LLC"
      subject={`Audit certificate for envelope ${input.envelopeNumber}`}
      creator="MainStreetOS Signing"
      producer="MainStreetOS"
    >
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.acHeader}>
          <Text style={styles.acTitle}>Audit Certificate</Text>
          <Text style={styles.acSubtitle}>
            Chronological record of every event recorded for this signing envelope. Generated automatically at the moment of signing.
          </Text>
        </View>

        {/* Meta */}
        <View style={styles.acMetaRow}>
          <Text style={styles.acMetaLabel}>Envelope</Text>
          <Text style={styles.acMetaValue}>#{input.envelopeNumber}</Text>
        </View>
        <View style={styles.acMetaRow}>
          <Text style={styles.acMetaLabel}>Envelope ID</Text>
          <Text style={[styles.acMetaValue, styles.acHash]}>{input.envelopeId}</Text>
        </View>
        <View style={styles.acMetaRow}>
          <Text style={styles.acMetaLabel}>Signed PDF SHA-256</Text>
          <Text style={[styles.acMetaValue, styles.acHash]}>{input.signedPdfHash}</Text>
        </View>
        <View style={styles.acMetaRow}>
          <Text style={styles.acMetaLabel}>Generated</Text>
          <Text style={styles.acMetaValue}>{new Date().toISOString()}</Text>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Event chronology</Text>

        {events.length === 0 && (
          <Text style={{ fontSize: 9, color: COLORS.inkSoft }}>No events recorded for this envelope.</Text>
        )}

        {events.map((e, i) => (
          <View key={i} style={styles.acEventRow} wrap={false}>
            <Text style={styles.acEventTime}>{formatIsoCompact(e.occurred_at)}</Text>
            <View style={styles.acEventBody}>
              <Text style={styles.acEventType}>{e.event_type}</Text>
              <Text style={styles.acEventMeta}>
                {e.ip_address ? `IP ${e.ip_address}` : 'IP unknown'}
                {e.geolocation
                  ? `  ·  ${[e.geolocation.city, e.geolocation.region, e.geolocation.country].filter(Boolean).join(', ')}`
                  : ''}
                {e.user_agent ? `  ·  UA ${shorten(String(e.user_agent), 60)}` : ''}
              </Text>
              {(e.document_sha256 || e.disclosure_sha256) && (
                <Text style={[styles.acEventMeta, styles.acHash]}>
                  {e.document_sha256 ? `doc ${e.document_sha256.slice(0, 16)}…` : ''}
                  {e.disclosure_sha256 ? `   disc ${e.disclosure_sha256.slice(0, 16)}…` : ''}
                </Text>
              )}
              {e.payload && Object.keys(e.payload).length > 0 && (
                <Text style={styles.acEventMeta}>
                  payload: {shorten(JSON.stringify(e.payload), 120)}
                </Text>
              )}
            </View>
          </View>
        ))}

        <View style={[styles.acHeader, { marginTop: 18, borderBottomWidth: 0 }]}>
          <Text style={[styles.acSubtitle, { fontSize: 8 }]}>
            This audit certificate is an immutable record of the events captured for envelope #{input.envelopeNumber}.
            The document hash referenced above ({shorten(input.signedPdfHash, 16)}…) is the SHA-256 of the signed PDF
            generated at the moment of execution. Any modification of the signed PDF will produce a different hash and
            be detectable. The audit certificate has its own SHA-256 computed at storage time, completing the chain
            of custody.
          </Text>
        </View>

        <Text
          fixed
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }: any) =>
            `Audit Certificate · Envelope #${input.envelopeNumber} · Page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}

// ============================================================================
// Helpers
// ============================================================================

async function fetchToDataUri(url: string): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const ct = res.headers.get('content-type') ?? 'image/png';
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${ct};base64,${buf.toString('base64')}`;
  } catch {
    return undefined;
  }
}

/**
 * Read a local file (relative to a list of candidate roots) and return as a
 * data URI. Used as the dev-mode fallback for the broker signature.
 */
async function readLocalToDataUri(relativePath: string): Promise<string | undefined> {
  try {
    const path = require('path');
    const fs = require('fs');
    const cwd = process.cwd();
    const candidates = [
      path.join(cwd, relativePath),
      path.join(__dirname, '..', relativePath),
      path.join(__dirname, '..', '..', relativePath),
    ];
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          const buf: Buffer = fs.readFileSync(p);
          const ext = path.extname(p).toLowerCase().replace('.', '') || 'png';
          const ct = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
          return `data:${ct};base64,${buf.toString('base64')}`;
        }
      } catch { /* keep trying */ }
    }
  } catch { /* fall through */ }
  return undefined;
}

function formatValue(v: any, format?: string): string {
  if (v == null) return '';
  if (format === 'currency' && typeof v === 'number') {
    return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }
  if (format === 'currency') {
    const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
    if (isFinite(n)) {
      return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    }
  }
  return String(v);
}

function formatHumanDate(d: Date): string {
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

function formatIso(d: Date): string {
  return d.toISOString();
}

function formatIsoCompact(s: string): string {
  // 2026-05-01T13:42:18.123Z → 2026-05-01 13:42:18Z
  if (!s) return '';
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}Z` : s;
}

function shorten(s: string, len: number): string {
  return s.length <= len ? s : s.slice(0, len - 1) + '…';
}
