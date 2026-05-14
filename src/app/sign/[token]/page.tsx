/**
 * MainStreetOS · Buyer-facing Signing Page
 *
 * Route: /sign/[token]/page.tsx (Next.js App Router)
 *
 * This is THE page where buyers actually sign NDAs. Design priorities:
 *   1. Trust — looks like a serious legal document, not a marketing page
 *   2. Clarity — every field labeled, every required indicator visible
 *   3. Friction-appropriate — easy to fill, but the consent + signature steps
 *      ARE deliberately distinct affirmative actions
 *   4. Audit visibility — events fire to /api/sign/event throughout
 *
 * Design direction: editorial / refined / serif typography for the doc body,
 * sans-serif for UI controls. Heavy negative space. Single accent color (deep
 * navy 'CRE blue'). Mobile-responsive but optimized for desktop signing
 * (most buyers will sign on a laptop, not a phone).
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SignaturePad from '@/components/SignaturePad';

// ============================================================================
// Types
// ============================================================================

type FieldSpec = {
  name: string;
  role: 'broker' | 'buyer' | 'seller';
  type: string;
  readonly?: boolean;
  required?: boolean;
  prefilled?: boolean;
  options?: string[];
};

type EnvelopeData = {
  envelopeId: string;
  envelopeNumber: number;
  templateKey: string;
  templateVersion: number;
  templateSource: any;
  filledValues: Record<string, any>;
  fieldsSchema: FieldSpec[];
  documentSha256: string;
  disclosure: {
    versionLabel: string;
    text: string;
    sha256: string;
  };
  signer: {
    id: string;
    role: string;
    email: string;
    name?: string;
  };
  listing: {
    businessName?: string;
    industry?: string;
    location?: string;
  };
};

type SigningState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; data: EnvelopeData }
  | { phase: 'submitting' }
  | { phase: 'completed'; signedPdfUrl: string };

// ============================================================================
// Component
// ============================================================================

export default function SigningPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [state, setState] = useState<SigningState>({ phase: 'loading' });
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [consent, setConsent] = useState(false);
  const [consentEventId, setConsentEventId] = useState<number | null>(null);
  const [scrollMilestones, setScrollMilestones] = useState({ 25: false, 50: false, 75: false, 100: false });
  const [typedSignature, setTypedSignature] = useState('');
  const [drawnSignatureSvg, setDrawnSignatureSvg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const sessionIdRef = useRef<string>(generateSessionId());
  const documentRef = useRef<HTMLDivElement>(null);

  // ---- Load envelope data on mount ----------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/sign/load?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (!cancelled) {
            setState({ phase: 'error', message: err.error ?? 'Could not load this signing link' });
          }
          return;
        }
        const data: EnvelopeData = await res.json();
        if (!cancelled) {
          setState({ phase: 'ready', data });
          // Initialize field values with any pre-existing buyer values (resumed session)
          const initial: Record<string, any> = {};
          data.fieldsSchema
            .filter((f) => f.role === 'buyer')
            .forEach((f) => { initial[f.name] = data.filledValues[f.name] ?? ''; });
          // Pre-fill buyer email/name from invite
          if (data.signer.email && !initial.buyer_email) initial.buyer_email = data.signer.email;
          if (data.signer.name && !initial.buyer_name) initial.buyer_name = data.signer.name;
          setFieldValues(initial);

          // Log opened event
          logEvent(data.envelopeId, data.signer.id, 'envelope.opened', { sessionId: sessionIdRef.current });
        }
      } catch (err: any) {
        if (!cancelled) {
          setState({ phase: 'error', message: 'Network error loading document' });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // ---- Scroll milestone tracking ------------------------------------------
  useEffect(() => {
    if (state.phase !== 'ready') return;

    function onScroll() {
      const el = documentRef.current;
      if (!el) return;
      const totalHeight = el.scrollHeight - el.clientHeight;
      if (totalHeight <= 0) return;
      const pct = (el.scrollTop / totalHeight) * 100;

      [25, 50, 75, 100].forEach((m) => {
        if (pct >= m && !scrollMilestones[m as 25 | 50 | 75 | 100]) {
          setScrollMilestones((prev) => ({ ...prev, [m]: true }));
          if (state.phase === 'ready') {
            logEvent(state.data.envelopeId, state.data.signer.id, `scroll.${m}` as any, {
              sessionId: sessionIdRef.current,
            });
          }
        }
      });
    }

    const el = documentRef.current;
    el?.addEventListener('scroll', onScroll, { passive: true });
    return () => el?.removeEventListener('scroll', onScroll);
  }, [state, scrollMilestones]);

  // ---- Field change handler with debounced event log -----------------------
  const handleFieldChange = useCallback((name: string, value: any) => {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
    if (state.phase === 'ready') {
      logEvent(state.data.envelopeId, state.data.signer.id, 'field.changed', {
        sessionId: sessionIdRef.current,
        payload: { field: name },
      });
    }
  }, [state]);

  // ---- Consent handler -----------------------------------------------------
  const handleConsentChange = useCallback(async (checked: boolean) => {
    setConsent(checked);
    if (state.phase !== 'ready') return;
    if (checked) {
      const eventId = await logEvent(
        state.data.envelopeId,
        state.data.signer.id,
        'consent.given',
        {
          sessionId: sessionIdRef.current,
          disclosureSha256: state.data.disclosure.sha256,
        }
      );
      setConsentEventId(eventId);
    } else {
      await logEvent(state.data.envelopeId, state.data.signer.id, 'consent.withdrawn', {
        sessionId: sessionIdRef.current,
      });
      setConsentEventId(null);
    }
  }, [state]);

  // ---- Submit handler ------------------------------------------------------
  const handleSubmit = async () => {
    if (state.phase !== 'ready') return;
    setSubmitError(null);
    setState({ phase: 'submitting' });

    try {
      const res = await fetch('/api/sign/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          fieldValues,
          consentChecked: consent,
          consentGivenEventId: consentEventId,
          documentSha256ShownToSigner: state.data.documentSha256,
          disclosureSha256ShownToSigner: state.data.disclosure.sha256,
          scrollCompleted: scrollMilestones[100],
          signatureMethod: drawnSignatureSvg ? 'typed_and_drawn' : 'typed',
          typedSignature,
          drawnSignatureSvg,
          sessionId: sessionIdRef.current,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? 'Signing failed');

      setState({ phase: 'completed', signedPdfUrl: result.signedPdfUrl });
    } catch (err: any) {
      setSubmitError(err.message);
      setState({ phase: 'ready', data: (state as any).data });
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (state.phase === 'loading') {
    return <LoadingScreen />;
  }

  if (state.phase === 'error') {
    return <ErrorScreen message={state.message} />;
  }

  if (state.phase === 'completed') {
    return <CompletedScreen pdfUrl={state.signedPdfUrl} />;
  }

  const isSubmitting = state.phase === 'submitting';
  const data: EnvelopeData = state.phase === 'ready' ? state.data : (state as any).data;

  // Validation gate for the Sign button
  const buyerFields = data.fieldsSchema.filter((f) => f.role === 'buyer');
  const requiredMissing = buyerFields
    .filter((f) => f.required && !fieldValues[f.name])
    .map((f) => f.name);
  const hasTypedSignature = typedSignature.trim().length >= 2;
  const canSign =
    requiredMissing.length === 0 &&
    consent &&
    scrollMilestones[100] &&
    hasTypedSignature &&
    !isSubmitting;

  return (
    <div className="signing-root">
      <style>{styles}</style>

      <header className="masthead">
        <div className="masthead-inner">
          <div className="brand">
            <div className="brand-mark">CRE</div>
            <div className="brand-text">
              <div className="brand-name">CRE Resources, LLC</div>
              <div className="brand-tag">Business Broker · M&A Advisor</div>
            </div>
          </div>
          <div className="envelope-id">No. {data.envelopeNumber}</div>
        </div>
      </header>

      <main className="page">
        {/* Document panel — scrollable */}
        <section className="document-panel" ref={documentRef}>
          <DocumentRenderer
            templateSource={data.templateSource}
            filledValues={data.filledValues}
            fieldsSchema={data.fieldsSchema}
            buyerValues={fieldValues}
            onFieldChange={handleFieldChange}
          />

          {/* Scroll completion indicator */}
          {!scrollMilestones[100] && (
            <div className="scroll-hint">
              ↓ Please scroll through the entire document before signing
            </div>
          )}
        </section>

        {/* Sign panel — sticky on desktop */}
        <aside className="sign-panel">
          <div className="sign-card">
            <h2 className="sign-title">Sign this Agreement</h2>

            {/* Listing context */}
            {data.listing.businessName && (
              <div className="listing-context">
                <div className="listing-label">Regarding</div>
                <div className="listing-name">{data.listing.businessName}</div>
                {data.listing.location && (
                  <div className="listing-meta">{data.listing.location}</div>
                )}
              </div>
            )}

            {/* ESIGN consent disclosure */}
            <details className="disclosure" open>
              <summary>Electronic Signature Disclosure</summary>
              <div className="disclosure-text">
                {data.disclosure.text.split('\n\n').map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </details>

            <label className="consent-row">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => handleConsentChange(e.target.checked)}
              />
              <span>I have read the disclosure above and consent to electronic signing.</span>
            </label>

            {/* Typed signature field */}
            <div className="sig-section">
              <label className="sig-label">
                Type your full legal name to sign
                <span className="required-mark">*</span>
              </label>
              <input
                className="sig-input"
                type="text"
                placeholder="John Smith"
                value={typedSignature}
                onChange={(e) => setTypedSignature(e.target.value)}
                autoComplete="name"
              />
              <div className="sig-preview">
                {typedSignature && (
                  <span className="sig-preview-text">/s/ {typedSignature}</span>
                )}
              </div>
            </div>

            {/* Optional drawn signature */}
            <details className="drawn-sig">
              <summary>Or draw your signature (optional)</summary>
              <SignaturePad onChange={setDrawnSignatureSvg} />
            </details>

            {/* Validation status */}
            <div className="validation-status">
              <Check ok={requiredMissing.length === 0}>All required fields filled</Check>
              <Check ok={scrollMilestones[100]}>Scrolled through the document</Check>
              <Check ok={consent}>Consent given</Check>
              <Check ok={hasTypedSignature}>Signature provided</Check>
            </div>

            {submitError && (
              <div className="submit-error">{submitError}</div>
            )}

            <button
              type="button"
              className="sign-button"
              disabled={!canSign}
              onClick={handleSubmit}
            >
              {isSubmitting ? 'Recording signature…' : 'Sign and Submit'}
            </button>

            <p className="sign-footnote">
              Signing now is binding. By clicking the button above, you are
              executing this Agreement. The exact text of this disclosure
              and the document are recorded as part of your signature.
            </p>
          </div>
        </aside>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span>Envelope No. {data.envelopeNumber}</span>
          <span>·</span>
          <span>Document hash: {data.documentSha256.slice(0, 16)}…</span>
          <span>·</span>
          <span>Disclosure: {data.disclosure.versionLabel}</span>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// Subcomponents
// ============================================================================

function DocumentRenderer({
  templateSource, filledValues, fieldsSchema, buyerValues, onFieldChange,
}: {
  templateSource: any;                  // JSONB from sign_templates.source — intentionally any
  filledValues: Record<string, any>;    // merged broker + buyer values — values are dynamic
  fieldsSchema: FieldSpec[];
  buyerValues: Record<string, any>;     // matches fieldValues state at line 82
  onFieldChange: (name: string, value: any) => void;
}) {
  // In a full implementation this walks templateSource.blocks and renders each
  // block type (header, listing_summary, buyer_profile_section, nda_clauses,
  // signature_block). For brevity here we render a representative structure.
  // The full DocumentRenderer is in components/DocumentRenderer.tsx.

  return (
    <article className="document">
      <header className="doc-letterhead">
        <div className="doc-broker-line">
          <strong>{filledValues.broker_company}</strong> | {filledValues.broker_name}
        </div>
        <div className="doc-broker-meta">
          {filledValues.broker_address} · {filledValues.broker_phone} · {filledValues.broker_email}
        </div>
      </header>

      <div className="doc-listing-strip">
        <span><strong>Date:</strong> {filledValues.effective_date}</span>
        <span><strong>Business:</strong> {filledValues.business_name}</span>
        <span><strong>Listing Ref. #:</strong> {filledValues.listing_ref_number}</span>
      </div>

      <h1 className="doc-title">Buyer Profile & Non-Disclosure Agreement</h1>

      <section className="doc-section">
        <h2>Buyer Profile</h2>
        {fieldsSchema.filter((f: FieldSpec) => f.role === 'buyer' && !f.type.includes('signature'))
          .map((f: FieldSpec) => (
            <BuyerField
              key={f.name}
              field={f}
              value={buyerValues[f.name] ?? ''}
              onChange={(v: string) => onFieldChange(f.name, v)}
            />
          ))}
      </section>

      <section className="doc-section">
        <h2>Non-Disclosure Agreement</h2>
        {/* In production: render NDA clauses from templateSource.blocks */}
        <p className="doc-note">
          [The full NDA clauses are rendered here from the versioned template source.
          See architecture document section 4.4 for retention.]
        </p>
      </section>

      <section className="doc-section doc-broker-signature">
        <h2>Broker</h2>
        <div className="broker-sig-line">
          {filledValues.broker_signature && (
            <img src={filledValues.broker_signature} alt="" className="broker-sig-img" />
          )}
          <div className="broker-sig-text">
            <div><strong>{filledValues.broker_name}</strong></div>
            <div>{filledValues.broker_title}</div>
            <div>{filledValues.broker_company}</div>
            <div className="broker-sig-date">Signed: {filledValues.effective_date}</div>
          </div>
        </div>
      </section>
    </article>
  );
}

function BuyerField({ field, value, onChange }: {
  field: FieldSpec;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `field-${field.name}`;
  const label = humanize(field.name);

  if (field.type === 'textarea') {
    return (
      <div className="field-row">
        <label htmlFor={id}>{label}{field.required && <span className="required-mark">*</span>}</label>
        <textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  if (field.type === 'select') {
    return (
      <div className="field-row">
        <label htmlFor={id}>{label}{field.required && <span className="required-mark">*</span>}</label>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Select —</option>
          {field.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  return (
    <div className="field-row">
      <label htmlFor={id}>{label}{field.required && <span className="required-mark">*</span>}</label>
      <input
        id={id}
        type={field.type === 'currency' ? 'text' : (field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : 'text')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className={`check ${ok ? 'ok' : 'pending'}`}>
      <span className="check-icon">{ok ? '✓' : '○'}</span>
      <span>{children}</span>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="centered-screen">
      <style>{styles}</style>
      <div className="loading-mark">CRE</div>
      <p>Loading your document…</p>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="centered-screen">
      <style>{styles}</style>
      <div className="error-mark">!</div>
      <h1>This signing link cannot be used</h1>
      <p>{message}</p>
      <p className="error-help">
        If you believe this is an error, please contact Mark Mueller at{' '}
        <a href="mailto:markm@creresources.biz">markm@creresources.biz</a>.
      </p>
    </div>
  );
}

function CompletedScreen({ pdfUrl }: { pdfUrl: string }) {
  return (
    <div className="centered-screen">
      <style>{styles}</style>
      <div className="completed-mark">✓</div>
      <h1>Signature recorded</h1>
      <p>Thank you. A copy of your signed agreement has been emailed to you.</p>
      {pdfUrl && (
        <a href={pdfUrl} className="download-link" target="_blank" rel="noopener">
          Download a copy now
        </a>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function generateSessionId(): string {
  return 'ses_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function logEvent(
  envelopeId: string,
  signerId: string,
  eventType: string,
  extra: { sessionId: string; payload?: any; disclosureSha256?: string } = { sessionId: '' }
): Promise<number | null> {
  try {
    const res = await fetch('/api/sign/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-MainStreetOS-Session': extra.sessionId },
      body: JSON.stringify({ envelopeId, signerId, eventType, ...extra }),
    });
    const data = await res.json();
    return data.eventId ?? null;
  } catch {
    return null;
  }
}

// ============================================================================
// Styles — refined editorial / serif body, sans UI, single accent
// ============================================================================

const styles = `
  :root {
    --ink: #0a1929;
    --ink-soft: #2c3e50;
    --paper: #fdfcf8;
    --paper-warm: #f7f4ec;
    --rule: #d8d2c4;
    --accent: #1e3a5f;
    --accent-soft: #4a6b8a;
    --warning: #b8542e;
    --success: #2d5a3d;
    --serif: 'Charter', 'Georgia', 'Cambria', serif;
    --sans: 'IBM Plex Sans', 'Inter', system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper-warm); color: var(--ink); font-family: var(--sans); }
  .signing-root { min-height: 100vh; display: flex; flex-direction: column; }
  .masthead { background: var(--ink); color: var(--paper); padding: 1rem 2rem; }
  .masthead-inner { max-width: 1400px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
  .brand { display: flex; align-items: center; gap: 0.75rem; }
  .brand-mark { width: 2.5rem; height: 2.5rem; border: 1.5px solid var(--paper); display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-weight: 600; letter-spacing: 0.05em; font-size: 0.85rem; }
  .brand-name { font-family: var(--serif); font-size: 1.05rem; }
  .brand-tag { font-size: 0.75rem; opacity: 0.75; letter-spacing: 0.05em; text-transform: uppercase; }
  .envelope-id { font-family: var(--serif); font-size: 0.875rem; opacity: 0.85; }

  .page { flex: 1; max-width: 1400px; margin: 0 auto; padding: 2rem; display: grid; grid-template-columns: 1fr 380px; gap: 2rem; }
  @media (max-width: 900px) { .page { grid-template-columns: 1fr; } }

  .document-panel { background: var(--paper); padding: 3rem; border: 1px solid var(--rule); max-height: calc(100vh - 200px); overflow-y: auto; position: relative; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  .document { font-family: var(--serif); line-height: 1.65; color: var(--ink); }
  .doc-letterhead { padding-bottom: 1rem; border-bottom: 1.5px solid var(--ink); margin-bottom: 1.5rem; }
  .doc-broker-line { font-size: 1.05rem; }
  .doc-broker-meta { font-size: 0.85rem; color: var(--ink-soft); margin-top: 0.25rem; font-family: var(--sans); }
  .doc-listing-strip { display: flex; gap: 1.5rem; flex-wrap: wrap; padding: 0.75rem 0; border-bottom: 1px solid var(--rule); margin-bottom: 2rem; font-size: 0.875rem; font-family: var(--sans); }
  .doc-title { font-size: 1.75rem; text-align: center; margin: 2rem 0 1.5rem; letter-spacing: -0.01em; }
  .doc-section h2 { font-size: 1.25rem; margin: 2rem 0 1rem; padding-bottom: 0.25rem; border-bottom: 1px solid var(--rule); }
  .doc-note { color: var(--ink-soft); font-style: italic; padding: 1rem; background: var(--paper-warm); border-left: 3px solid var(--accent); }

  .field-row { margin: 1rem 0; font-family: var(--sans); }
  .field-row label { display: block; font-size: 0.8125rem; color: var(--ink-soft); margin-bottom: 0.25rem; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 500; }
  .field-row input, .field-row select, .field-row textarea { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--rule); background: var(--paper); font-family: var(--serif); font-size: 1rem; }
  .field-row input:focus, .field-row select:focus, .field-row textarea:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
  .required-mark { color: var(--warning); margin-left: 0.25rem; }

  .broker-sig-line { display: flex; align-items: center; gap: 1.5rem; padding: 1rem; background: var(--paper-warm); border: 1px solid var(--rule); }
  .broker-sig-img { max-height: 60px; max-width: 200px; }
  .broker-sig-text { font-size: 0.95rem; }
  .broker-sig-date { color: var(--ink-soft); font-size: 0.8125rem; margin-top: 0.5rem; font-family: var(--sans); }

  .scroll-hint { position: sticky; bottom: 1rem; left: 0; right: 0; background: var(--ink); color: var(--paper); padding: 0.75rem; text-align: center; font-size: 0.875rem; margin: 1rem -3rem -3rem; }

  .sign-panel { position: sticky; top: 1rem; align-self: start; }
  .sign-card { background: var(--paper); border: 1px solid var(--rule); padding: 1.5rem; }
  .sign-title { font-family: var(--serif); font-size: 1.25rem; margin: 0 0 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--rule); }

  .listing-context { padding: 0.75rem; background: var(--paper-warm); margin-bottom: 1rem; }
  .listing-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-soft); }
  .listing-name { font-family: var(--serif); font-size: 1rem; font-weight: 600; margin-top: 0.125rem; }
  .listing-meta { font-size: 0.8125rem; color: var(--ink-soft); }

  .disclosure { margin: 1rem 0; border: 1px solid var(--rule); }
  .disclosure summary { padding: 0.625rem 0.75rem; background: var(--paper-warm); cursor: pointer; font-size: 0.875rem; font-weight: 500; }
  .disclosure-text { padding: 0.75rem; max-height: 240px; overflow-y: auto; font-size: 0.78125rem; line-height: 1.55; color: var(--ink-soft); }
  .disclosure-text p { margin: 0 0 0.625rem; }

  .consent-row { display: flex; gap: 0.5rem; align-items: flex-start; padding: 0.75rem; background: var(--paper-warm); margin: 0.75rem 0; cursor: pointer; font-size: 0.875rem; }
  .consent-row input { margin-top: 0.2rem; flex-shrink: 0; }

  .sig-section { margin: 1rem 0; }
  .sig-label { display: block; font-size: 0.8125rem; color: var(--ink-soft); margin-bottom: 0.375rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .sig-input { width: 100%; padding: 0.625rem 0.75rem; border: 1px solid var(--rule); background: var(--paper); font-family: 'Caveat', cursive; font-size: 1.5rem; }
  .sig-preview { min-height: 1.5rem; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed var(--rule); }
  .sig-preview-text { font-family: 'Caveat', cursive; font-size: 1.25rem; color: var(--accent); }

  .drawn-sig { margin: 0.75rem 0; }
  .drawn-sig summary { font-size: 0.8125rem; cursor: pointer; color: var(--ink-soft); }
  /* .signature-pad and .signature-pad-canvas styles removed — the standalone
     SignaturePad component at src/components/SignaturePad.tsx is self-styled
     via inline styles. */

  .validation-status { padding: 0.75rem; background: var(--paper-warm); margin: 1rem 0; font-size: 0.8125rem; }
  .check { display: flex; gap: 0.5rem; padding: 0.125rem 0; }
  .check.ok { color: var(--success); }
  .check.pending { color: var(--ink-soft); }
  .check-icon { width: 1.25rem; text-align: center; }

  .submit-error { padding: 0.75rem; background: #fbeae2; border-left: 3px solid var(--warning); color: var(--warning); font-size: 0.875rem; margin: 0.75rem 0; }

  .sign-button { width: 100%; padding: 1rem; background: var(--accent); color: var(--paper); border: 0; font-family: var(--sans); font-size: 1rem; font-weight: 500; letter-spacing: 0.02em; cursor: pointer; transition: background 0.15s; }
  .sign-button:hover:not(:disabled) { background: var(--ink); }
  .sign-button:disabled { background: var(--rule); color: var(--ink-soft); cursor: not-allowed; }
  .sign-footnote { font-size: 0.75rem; color: var(--ink-soft); margin-top: 0.75rem; line-height: 1.4; }

  .footer { background: var(--ink); color: var(--paper); padding: 1rem 2rem; font-size: 0.75rem; opacity: 0.85; }
  .footer-inner { max-width: 1400px; margin: 0 auto; display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; font-family: var(--sans); letter-spacing: 0.04em; }

  .centered-screen { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; padding: 2rem; text-align: center; background: var(--paper-warm); font-family: var(--sans); color: var(--ink); }
  .centered-screen h1 { font-family: var(--serif); font-size: 1.75rem; }
  .loading-mark, .error-mark, .completed-mark { width: 4rem; height: 4rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 1.5rem; font-weight: 600; }
  .loading-mark { background: var(--ink); color: var(--paper); }
  .error-mark { background: var(--warning); color: var(--paper); }
  .completed-mark { background: var(--success); color: var(--paper); font-size: 2rem; }
  .download-link { padding: 0.75rem 1.5rem; background: var(--accent); color: var(--paper); text-decoration: none; font-size: 0.875rem; }
  .error-help { color: var(--ink-soft); font-size: 0.875rem; }
`;
