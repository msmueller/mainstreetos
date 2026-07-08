/**
 * MainStreetOS · Public "Start NDA" client form (Build Spec v1.0 §6)
 *
 * Rendered by app/nda/[slug]/page.tsx (server component). Presents the NDA +
 * Buyer Profile to an unauthenticated prospect and drives the two anti-abuse
 * gates before signing:
 *
 *   1. Identify + Turnstile → request a 6-digit email code (POST request-otp).
 *   2. Enter the code, fill the profile, consent, acknowledge, type a
 *      signature → sign (POST submit). The server mints + completes the
 *      envelope via the shared completion core.
 *
 * Visual language matches the token signing page (/sign/[token]) so a buyer
 * arriving via the public link sees the same serious legal artifact.
 */

'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import SignaturePad from '@/components/SignaturePad';

type FieldSpec = {
  name: string;
  role: 'broker' | 'buyer' | 'seller';
  type: string;
  required?: boolean;
  options?: string[];
  label?: string;
};

type Props = {
  slug: string;
  businessName: string;
  listingTitle: string;
  omLink: string;
  blurb: string;
  templateSource: any;
  fieldsSchema: FieldSpec[];
  disclosure: { versionLabel: string; text: string };
  turnstileSiteKey: string;
};

// Identity fields are collected in the dedicated top block, not the profile grid.
const IDENTITY_FIELDS = new Set(['buyer_name', 'buyer_email', 'buyer_phone']);

declare global {
  interface Window { turnstile?: any; }
}

export default function PublicNdaClient(props: Props) {
  const {
    slug, businessName, listingTitle, omLink, blurb,
    templateSource, fieldsSchema, disclosure, turnstileSiteKey,
  } = props;

  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [consent, setConsent] = useState(false);
  const [acknowledgedAll, setAcknowledgedAll] = useState(false);
  const [typedSignature, setTypedSignature] = useState('');
  const [drawnSignatureSvg, setDrawnSignatureSvg] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState<null | { signedPdfUrl?: string; alreadySigned?: boolean; envelopeNumber?: number }>(null);

  const sessionIdRef = useRef<string>('ses_' + Math.random().toString(36).slice(2) + Date.now().toString(36));
  const documentRef = useRef<HTMLDivElement>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);

  const buyerFields = useMemo(
    () => fieldsSchema.filter((f) => f.role === 'buyer'),
    [fieldsSchema]
  );

  const setField = useCallback((name: string, value: any) => {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const email = String(fieldValues.buyer_email ?? '').trim();
  const buyerName = String(fieldValues.buyer_name ?? '').trim();

  // ---- Turnstile explicit render -------------------------------------------
  useEffect(() => {
    if (!turnstileSiteKey) return;
    const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    let widgetId: string | undefined;

    function render() {
      if (!window.turnstile || !turnstileRef.current || turnstileRef.current.childElementCount > 0) return;
      widgetId = window.turnstile.render(turnstileRef.current, {
        sitekey: turnstileSiteKey,
        callback: (token: string) => setTurnstileToken(token),
        'error-callback': () => setTurnstileToken(null),
        'expired-callback': () => setTurnstileToken(null),
      });
    }

    if (window.turnstile) {
      render();
    } else if (!document.querySelector(`script[src="${SCRIPT}"]`)) {
      const s = document.createElement('script');
      s.src = SCRIPT; s.async = true; s.defer = true;
      s.onload = render;
      document.head.appendChild(s);
    } else {
      const t = setInterval(() => { if (window.turnstile) { render(); clearInterval(t); } }, 200);
      return () => clearInterval(t);
    }
    return () => { if (widgetId && window.turnstile) try { window.turnstile.remove(widgetId); } catch {} };
  }, [turnstileSiteKey]);

  // ---- Scroll-through gate --------------------------------------------------
  useEffect(() => {
    const el = documentRef.current;
    if (!el) return;
    function onScroll() {
      const node = documentRef.current;
      if (!node) return;
      const total = node.scrollHeight - node.clientHeight;
      if (total <= 0) { setScrolled(true); return; }
      if ((node.scrollTop / total) * 100 >= 98) setScrolled(true);
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // ---- Request OTP ----------------------------------------------------------
  async function requestOtp() {
    setNotice(null);
    if (!emailValid) { setNotice('Enter a valid email address first.'); return; }
    if (!buyerName) { setNotice('Enter your name first.'); return; }
    if (turnstileSiteKey && !turnstileToken) { setNotice('Please complete the bot check first.'); return; }

    setSendingOtp(true);
    try {
      const res = await fetch('/api/nda-public-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-turnstile-token': turnstileToken ?? '' },
        body: JSON.stringify({ action: 'request-otp', slug, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error ?? 'Could not send the verification code.');
        if (window.turnstile && turnstileRef.current) { try { window.turnstile.reset(); } catch {} setTurnstileToken(null); }
        return;
      }
      setOtpSent(true);
      setNotice(`We emailed a 6-digit code to ${email}. Enter it below to sign.`);
    } catch {
      setNotice('Network error requesting the code. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  }

  // ---- Required-field validation (mirror of the server gate) ----------------
  const effectiveValues = useMemo<Record<string, any>>(() => ({
    ...fieldValues,
    buyer_typed_signature: typedSignature,
    buyer_acknowledgment: acknowledgedAll ? '__YES__' : '',
  }), [fieldValues, typedSignature, acknowledgedAll]);

  const requiredMissing = useMemo(
    () => buyerFields
      .filter((f) => f.required && !f.type.includes('signature'))
      .filter((f) => {
        const v = effectiveValues[f.name];
        return v === undefined || v === null || v === '';
      })
      .map((f) => f.name),
    [buyerFields, effectiveValues]
  );

  const hasSignature = typedSignature.trim().length >= 2;
  const canSubmit =
    requiredMissing.length === 0 &&
    otpSent && otpCode.trim().length >= 4 &&
    consent && acknowledgedAll && hasSignature && scrolled && !submitting;

  // ---- Submit ---------------------------------------------------------------
  async function submit() {
    setNotice(null);
    setSubmitting(true);
    try {
      const payload = {
        action: 'submit',
        slug,
        buyer: { email, name: buyerName, phone: fieldValues.buyer_phone ?? undefined },
        fieldValues: { ...fieldValues, buyer_acknowledgment: acknowledgedAll ? '__YES__' : '__NO__' },
        otpCode: otpCode.trim(),
        consent,
        acknowledgedAllClauses: acknowledgedAll,
        typedSignature: typedSignature.trim(),
        drawnSignatureSvg: drawnSignatureSvg ?? undefined,
        sessionId: sessionIdRef.current,
      };
      const res = await fetch('/api/nda-public-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error ?? 'Signing failed. Please review and try again.');
        return;
      }
      setDone({ signedPdfUrl: data.signedPdfUrl, alreadySigned: data.alreadySigned, envelopeNumber: data.envelopeNumber });
    } catch {
      setNotice('Network error while signing. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Completed screen -----------------------------------------------------
  if (done) {
    return (
      <div className="centered-screen">
        <style>{styles}</style>
        <div className="completed-mark">✓</div>
        <h1>{done.alreadySigned ? 'Already on file' : 'Signature recorded'}</h1>
        <p>
          {done.alreadySigned
            ? `Our records show this NDA is already completed for ${email}. No new signature was created.`
            : 'Thank you. A copy of your signed agreement has been emailed to you. Mark will follow up with the confidential materials shortly.'}
        </p>
        {done.signedPdfUrl && (
          <a href={done.signedPdfUrl} className="download-link" target="_blank" rel="noopener">Download a copy now</a>
        )}
      </div>
    );
  }

  // ---- Main render ----------------------------------------------------------
  return (
    <div className="signing-root">
      <style>{styles}</style>

      <header className="masthead">
        <div className="masthead-inner">
          <div className="brand">
            <div className="brand-text">
              <div className="brand-name">CRE Resources, LLC — Mark S. Mueller<span className="brand-credential">, CAIBVS™</span></div>
              <div className="brand-tag">Business Broker · M&amp;A Advisor · <a href="https://creresources.biz" target="_blank" rel="noopener noreferrer" className="brand-link">creresources.biz</a></div>
            </div>
          </div>
          <div className="brand-right"><div className="envelope-id">Confidential</div></div>
        </div>
      </header>

      <main className="page">
        {/* Document panel */}
        <section className="document-panel" ref={documentRef}>
          <article className="document">
            <header className="doc-letterhead">
              <div className="doc-broker-line"><strong>CRE Resources, LLC</strong> | Mark S. Mueller, CAIBVS™</div>
              <div className="doc-broker-meta">Titusville, NJ 08560 · 856.745.9706 · markm@creresources.biz</div>
            </header>

            <div className="doc-listing-strip">
              <span><strong>Business:</strong> {businessName}</span>
              {listingTitle && <span><strong>Opportunity:</strong> {listingTitle}</span>}
              {omLink && <span><a href={omLink} target="_blank" rel="noopener noreferrer" className="brand-link">View overview →</a></span>}
            </div>

            {blurb && <p className="doc-paragraph">{blurb}</p>}

            <h1 className="doc-title">Buyer Profile &amp; Non-Disclosure Agreement</h1>

            <section className="doc-section">
              <h2>Buyer Profile</h2>
              {buyerFields
                .filter((f) => !f.type.includes('signature') && !IDENTITY_FIELDS.has(f.name))
                .map((f) => (
                  <BuyerField key={f.name} field={f} value={fieldValues[f.name] ?? ''} onChange={(v) => setField(f.name, v)} />
                ))}
            </section>

            <section className="doc-section">
              <h2>{templateSource?.nda_section?.title ?? 'Non-Disclosure Agreement'}</h2>
              {templateSource?.nda_section?.preamble && (
                <p className="doc-paragraph">{templateSource.nda_section.preamble}</p>
              )}
              {(templateSource?.nda_section?.clauses ?? []).map(
                (c: { number: number | string; heading: string; text: string }, i: number) => (
                  <p key={i} className="doc-paragraph doc-clause">
                    <strong>§{c.number} {c.heading}.</strong> {c.text}
                  </p>
                )
              )}
            </section>
          </article>

          {!scrolled && <div className="scroll-hint">↓ Please scroll through the entire document before signing</div>}
        </section>

        {/* Sign panel */}
        <aside className="sign-panel">
          <div className="sign-card">
            <h2 className="sign-title">Start your NDA</h2>

            <div className="listing-context">
              <div className="listing-label">Regarding</div>
              <div className="listing-name">{businessName}</div>
            </div>

            {/* Step 1: identity + bot check + code */}
            <div className="sig-section">
              <label className="sig-label">Your name<span className="required-mark">*</span></label>
              <input className="text-input" type="text" autoComplete="name" value={buyerName}
                onChange={(e) => setField('buyer_name', e.target.value)} placeholder="Jane Q. Buyer" />
            </div>
            <div className="sig-section">
              <label className="sig-label">Your email<span className="required-mark">*</span></label>
              <input className="text-input" type="email" autoComplete="email" value={email}
                onChange={(e) => setField('buyer_email', e.target.value)} placeholder="jane@example.com" disabled={otpSent} />
            </div>

            {turnstileSiteKey && !otpSent && (
              <div className="turnstile-wrap" ref={turnstileRef} />
            )}

            {!otpSent ? (
              <button type="button" className="secondary-button" onClick={requestOtp}
                disabled={sendingOtp || !emailValid || !buyerName || (!!turnstileSiteKey && !turnstileToken)}>
                {sendingOtp ? 'Sending code…' : 'Email me a verification code'}
              </button>
            ) : (
              <div className="sig-section">
                <label className="sig-label">6-digit code<span className="required-mark">*</span></label>
                <input className="text-input otp-input" inputMode="numeric" maxLength={6} value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••" />
                <button type="button" className="link-button" onClick={requestOtp} disabled={sendingOtp}>
                  Resend code
                </button>
              </div>
            )}

            {/* ESIGN disclosure + consent */}
            <details className="disclosure" open>
              <summary>Electronic Signature Disclosure</summary>
              <div className="disclosure-text">
                {disclosure.text.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </details>

            <label className="consent-row">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>I have read the disclosure above and consent to electronic signing (ESIGN/UETA).</span>
            </label>

            <label className="consent-row">
              <input type="checkbox" checked={acknowledgedAll} onChange={(e) => setAcknowledgedAll(e.target.checked)} />
              <span>I have read and agree to all provisions of the Non-Disclosure Agreement above, and the information I provide is true and complete.</span>
            </label>

            {/* Typed signature */}
            <div className="sig-section">
              <label className="sig-label">Type your full legal name to sign<span className="required-mark">*</span></label>
              <input className="sig-input" type="text" placeholder="Jane Q. Buyer" value={typedSignature}
                onChange={(e) => setTypedSignature(e.target.value)} autoComplete="name" />
              <div className="sig-preview">{typedSignature && <span className="sig-preview-text">/s/ {typedSignature}</span>}</div>
            </div>

            <details className="drawn-sig">
              <summary>Or draw your signature (optional)</summary>
              <SignaturePad onChange={setDrawnSignatureSvg} />
            </details>

            {/* Validation status */}
            <div className="validation-status">
              <Check ok={requiredMissing.length === 0}>All required fields filled</Check>
              <Check ok={scrolled}>Scrolled through the document</Check>
              <Check ok={otpSent && otpCode.trim().length >= 4}>Email verified</Check>
              <Check ok={consent && acknowledgedAll}>Consent &amp; acknowledgment</Check>
              <Check ok={hasSignature}>Signature provided</Check>
            </div>

            {notice && <div className="notice">{notice}</div>}

            <button type="button" className="sign-button" disabled={!canSubmit} onClick={submit}>
              {submitting ? 'Recording signature…' : 'Sign and Submit'}
            </button>

            <p className="sign-footnote">
              Signing now is binding. By clicking the button above you are executing this Agreement.
              The exact text of this disclosure and the document are recorded as part of your signature.
            </p>
          </div>
        </aside>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span>{businessName}</span><span>·</span>
          <span>Disclosure: {disclosure.versionLabel}</span><span>·</span>
          <span>Powered by MainStreetOS</span>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// Field renderer (mirrors /sign/[token] BuyerField)
// ============================================================================

function BuyerField({ field, value, onChange }: { field: FieldSpec; value: string; onChange: (v: string) => void; }) {
  const id = `field-${field.name}`;
  const label = field.label ?? humanize(field.name);

  if (field.type === 'section_header') {
    return <h3 className="doc-section-header">{label}</h3>;
  }

  if (field.type === 'multi_select') {
    let selected: string[] = [];
    try { selected = value ? JSON.parse(value) : []; } catch { selected = []; }
    const toggle = (opt: string) => {
      const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt];
      onChange(JSON.stringify(next));
    };
    return (
      <div className="field-row" style={{ display: 'block' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>{label}{field.required && <span className="required-mark">*</span>}</label>
        <div className="multi-select-group">
          {field.options?.map((opt) => (
            <label key={opt} className="ms-opt">
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

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
          {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  if (field.type === 'checkbox') {
    const isChecked = value === '__YES__';
    return (
      <div className="field-row field-row-checkbox">
        <label htmlFor={id} className="checkbox-label">
          <input id={id} type="checkbox" checked={isChecked} onChange={(e) => onChange(e.target.checked ? '__YES__' : '__NO__')} />
          <span>{label}{field.required && <span className="required-mark">*</span>}</span>
        </label>
      </div>
    );
  }
  return (
    <div className="field-row">
      <label htmlFor={id}>{label}{field.required && <span className="required-mark">*</span>}</label>
      <input id={id}
        type={field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
        value={value} onChange={(e) => onChange(e.target.value)} />
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

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================================
// Styles (adapted from /sign/[token])
// ============================================================================

const styles = `
  :root {
    --ink:#0a1929; --ink-soft:#2c3e50; --paper:#fdfcf8; --paper-warm:#f7f4ec;
    --rule:#d8d2c4; --accent:#1e3a5f; --warning:#b8542e; --success:#2d5a3d;
    --serif:'Charter','Georgia','Cambria',serif; --sans:'IBM Plex Sans','Inter',system-ui,sans-serif;
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--paper-warm); color:var(--ink); font-family:var(--sans); }
  .signing-root { min-height:100vh; display:flex; flex-direction:column; }
  .masthead { background:var(--ink); color:var(--paper); padding:1rem 2rem; }
  .masthead-inner { max-width:1400px; margin:0 auto; display:flex; justify-content:space-between; align-items:center; }
  .brand-text { display:flex; flex-direction:column; gap:0.125rem; }
  .brand-name { font-family:var(--serif); font-size:1.05rem; }
  .brand-credential { font-size:0.78em; opacity:0.85; }
  .brand-tag { font-size:0.75rem; opacity:0.75; letter-spacing:0.05em; text-transform:uppercase; }
  .brand-link { color:var(--accent); text-decoration:underline; }
  .masthead .brand-link { color:var(--paper); opacity:0.85; }
  .brand-right { display:flex; align-items:center; gap:1rem; }
  .envelope-id { font-family:var(--serif); font-size:0.875rem; opacity:0.85; letter-spacing:0.08em; text-transform:uppercase; }

  .page { flex:1; max-width:1400px; margin:0 auto; padding:2rem; display:grid; grid-template-columns:1fr 400px; gap:2rem; }
  @media (max-width:900px){ .page { grid-template-columns:1fr; } }

  .document-panel { background:var(--paper); padding:3rem; border:1px solid var(--rule); max-height:calc(100vh - 120px); overflow-y:auto; position:relative; box-shadow:0 1px 3px rgba(0,0,0,0.05); }
  .document { font-family:var(--serif); line-height:1.65; color:var(--ink); }
  .doc-letterhead { padding-bottom:1rem; border-bottom:1.5px solid var(--ink); margin-bottom:1.5rem; }
  .doc-broker-line { font-size:1.05rem; }
  .doc-broker-meta { font-size:0.85rem; color:var(--ink-soft); margin-top:0.25rem; font-family:var(--sans); }
  .doc-listing-strip { display:flex; gap:1.5rem; flex-wrap:wrap; padding:0.75rem 0; border-bottom:1px solid var(--rule); margin-bottom:2rem; font-size:0.875rem; font-family:var(--sans); }
  .doc-title { font-size:1.75rem; text-align:center; margin:2rem 0 1.5rem; letter-spacing:-0.01em; }
  .doc-section h2 { font-size:1.25rem; margin:2rem 0 1rem; padding-bottom:0.25rem; border-bottom:1px solid var(--rule); }
  .doc-section-header { margin:1.5rem 0 0.5rem; padding-top:0.75rem; border-top:2px solid var(--ink-soft); font-size:1.05rem; font-weight:600; color:var(--ink-soft); }
  .doc-paragraph { font-size:0.9375rem; line-height:1.6; margin:0.5rem 0 0.75rem; text-align:justify; }
  .doc-clause strong { font-weight:600; }

  .field-row { margin:1rem 0; font-family:var(--sans); }
  .field-row label { display:block; font-size:0.8125rem; color:var(--ink-soft); margin-bottom:0.25rem; text-transform:uppercase; letter-spacing:0.04em; font-weight:500; }
  .field-row input, .field-row select, .field-row textarea { width:100%; padding:0.5rem 0.75rem; border:1px solid var(--rule); background:var(--paper); font-family:var(--serif); font-size:1rem; }
  .field-row input:focus, .field-row select:focus, .field-row textarea:focus { outline:2px solid var(--accent); outline-offset:-1px; }
  .field-row-checkbox .checkbox-label { display:flex; align-items:flex-start; gap:0.5rem; cursor:pointer; text-transform:none; letter-spacing:normal; font-weight:normal; font-size:0.9375rem; color:var(--ink); }
  .field-row-checkbox input { width:1rem; height:1rem; margin-top:0.15rem; flex-shrink:0; }
  .multi-select-group { display:flex; flex-direction:column; gap:0.4rem; align-items:flex-start; }
  .ms-opt { display:flex; align-items:center; gap:0.6rem; font-weight:400; cursor:pointer; text-transform:none; letter-spacing:normal; }
  .ms-opt input { width:1rem; height:1rem; margin:0; }
  .required-mark { color:var(--warning); margin-left:0.25rem; }

  .scroll-hint { position:sticky; bottom:1rem; background:var(--ink); color:var(--paper); padding:0.75rem; text-align:center; font-size:0.875rem; margin:1rem -3rem -3rem; }

  .sign-panel { position:sticky; top:1rem; align-self:start; }
  .sign-card { background:var(--paper); border:1px solid var(--rule); padding:1.5rem; }
  .sign-title { font-family:var(--serif); font-size:1.25rem; margin:0 0 1rem; padding-bottom:0.75rem; border-bottom:1px solid var(--rule); }
  .listing-context { padding:0.75rem; background:var(--paper-warm); margin-bottom:1rem; }
  .listing-label { font-size:0.7rem; text-transform:uppercase; letter-spacing:0.06em; color:var(--ink-soft); }
  .listing-name { font-family:var(--serif); font-size:1rem; font-weight:600; margin-top:0.125rem; }

  .text-input { width:100%; padding:0.625rem 0.75rem; border:1px solid var(--rule); background:var(--paper); font-family:var(--serif); font-size:1rem; }
  .text-input:focus { outline:2px solid var(--accent); outline-offset:-1px; }
  .otp-input { letter-spacing:0.5em; font-size:1.25rem; text-align:center; font-family:'Courier New',monospace; }
  .turnstile-wrap { margin:0.75rem 0; min-height:65px; }

  .sig-section { margin:1rem 0; }
  .sig-label { display:block; font-size:0.8125rem; color:var(--ink-soft); margin-bottom:0.375rem; text-transform:uppercase; letter-spacing:0.04em; }
  .sig-input { width:100%; padding:0.625rem 0.75rem; border:1px solid var(--rule); background:var(--paper); font-family:'Caveat',cursive; font-size:1.5rem; }
  .sig-preview { min-height:1.5rem; margin-top:0.5rem; padding-top:0.5rem; border-top:1px dashed var(--rule); }
  .sig-preview-text { font-family:'Caveat',cursive; font-size:1.25rem; color:var(--accent); }

  .disclosure { margin:1rem 0; border:1px solid var(--rule); }
  .disclosure summary { padding:0.625rem 0.75rem; background:var(--paper-warm); cursor:pointer; font-size:0.875rem; font-weight:500; }
  .disclosure-text { padding:0.75rem; max-height:240px; overflow-y:auto; font-size:0.78125rem; line-height:1.55; color:var(--ink-soft); }
  .disclosure-text p { margin:0 0 0.625rem; }

  .consent-row { display:flex; gap:0.5rem; align-items:flex-start; padding:0.75rem; background:var(--paper-warm); margin:0.75rem 0; cursor:pointer; font-size:0.875rem; }
  .consent-row input { margin-top:0.2rem; flex-shrink:0; }

  .drawn-sig { margin:0.75rem 0; }
  .drawn-sig summary { font-size:0.8125rem; cursor:pointer; color:var(--ink-soft); }

  .validation-status { padding:0.75rem; background:var(--paper-warm); margin:1rem 0; font-size:0.8125rem; }
  .check { display:flex; gap:0.5rem; padding:0.125rem 0; }
  .check.ok { color:var(--success); }
  .check.pending { color:var(--ink-soft); }
  .check-icon { width:1.25rem; text-align:center; }

  .notice { padding:0.75rem; background:#fbeae2; border-left:3px solid var(--warning); color:var(--warning); font-size:0.875rem; margin:0.75rem 0; }

  .sign-button { width:100%; padding:1rem; background:var(--accent); color:var(--paper); border:0; font-family:var(--sans); font-size:1rem; font-weight:500; letter-spacing:0.02em; cursor:pointer; transition:background 0.15s; }
  .sign-button:hover:not(:disabled) { background:var(--ink); }
  .sign-button:disabled { background:var(--rule); color:var(--ink-soft); cursor:not-allowed; }
  .secondary-button { width:100%; padding:0.75rem; background:var(--paper-warm); color:var(--accent); border:1px solid var(--accent); font-family:var(--sans); font-size:0.9375rem; font-weight:500; cursor:pointer; margin-top:0.25rem; }
  .secondary-button:disabled { color:var(--ink-soft); border-color:var(--rule); cursor:not-allowed; }
  .link-button { background:none; border:0; color:var(--accent); font-size:0.8125rem; text-decoration:underline; cursor:pointer; padding:0.5rem 0 0; }
  .sign-footnote { font-size:0.75rem; color:var(--ink-soft); margin-top:0.75rem; line-height:1.4; }

  .footer { background:var(--ink); color:var(--paper); padding:1rem 2rem; font-size:0.75rem; opacity:0.85; }
  .footer-inner { max-width:1400px; margin:0 auto; display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap; font-family:var(--sans); letter-spacing:0.04em; }

  .centered-screen { min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1rem; padding:2rem; text-align:center; background:var(--paper-warm); font-family:var(--sans); color:var(--ink); }
  .centered-screen h1 { font-family:var(--serif); font-size:1.75rem; }
  .completed-mark { width:4rem; height:4rem; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:2rem; background:var(--success); color:var(--paper); }
  .download-link { padding:0.75rem 1.5rem; background:var(--accent); color:var(--paper); text-decoration:none; font-size:0.875rem; }
`;
