/**
 * MainStreetOS · SendNdaButton
 *
 * The button Mark clicks in MainStreetOS to fire an NDA at a buyer lead.
 * Replaces the deprecated DocuSeal version (which called /api/docuseal/send).
 *
 * Behavior:
 *   1. Renders a button. Disabled if NDA already executed, no listing linked,
 *      or no buyer email.
 *   2. On click, opens a confirm modal showing the buyer email/name/phone with
 *      editable fields — broker can fix typos before sending.
 *   3. POSTs to /api/sign/create with the new request shape.
 *   4. On success: shows confirmation toast with the envelope number, calls
 *      optional onSent prop so the parent CRM can refresh the lead.
 *   5. On error: shows error inline with the option to retry.
 *
 * The component is self-contained (own state, own modal, no external UI library).
 * Inline styles match the editorial look of the signing page so brand stays
 * consistent across the broker side and the buyer side.
 */

'use client';

import React, { useState } from 'react';

// ============================================================================
// Public types
// ============================================================================

export type Lead = {
  id: string;          // Notion lead page ID
  email?: string;
  name?: string;       // Lead Name (full)
  phone?: string;
  completedNda?: boolean;
};

export type Listing = {
  id: string;          // Notion listing page ID
  businessName?: string;
};

export type SendNdaButtonProps = {
  lead: Lead;
  listing: Listing;
  /** Optional override. When omitted, /api/sign/create derives the template
   *  from the lead's Buyer Type (Build B): Strategic Buyer / Private Equity →
   *  NDA_BuyerProfile_Corporate; everything else → NDA_BuyerProfile v2. */
  templateKey?: string;
  /** Called after a successful send, with the envelope number, so the parent can refresh. */
  onSent?: (envelopeNumber: number) => void;
  /** Override the button label. Default: "Send NDA". */
  label?: string;
};

// ============================================================================
// Component
// ============================================================================

export default function SendNdaButton({
  lead,
  listing,
  // Build B (2026-07-02): no more hardcoded 'NDA_BuyerProfile' default —
  // undefined lets the server pick the template from the lead's Buyer Type.
  templateKey,
  onSent,
  label = 'Send NDA',
}: SendNdaButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState(lead.email ?? '');
  const [name, setName] = useState(lead.name ?? '');
  const [phone, setPhone] = useState(lead.phone ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | { kind: 'idle' }
    | { kind: 'success'; envelopeNumber: number }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  // ----- Button-level disabled gates ----------------------------------------
  const disabledReason =
    lead.completedNda ? 'NDA already executed for this lead' :
    !listing.id ? 'No listing linked to this lead' :
    !lead.email && !email ? 'No buyer email on file' :
    null;

  const open = () => {
    setEmail(lead.email ?? '');
    setName(lead.name ?? '');
    setPhone(lead.phone ?? '');
    setResult({ kind: 'idle' });
    setModalOpen(true);
  };
  const close = () => {
    if (submitting) return;
    setModalOpen(false);
  };

  // ----- Modal-level send-button gates --------------------------------------
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSend = validEmail && !submitting;

  const send = async () => {
    setSubmitting(true);
    setResult({ kind: 'idle' });
    try {
      const res = await fetch('/api/sign/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Only sent when explicitly overridden; otherwise the server derives
          // it from the lead's Buyer Type (spec §5 mapping).
          ...(templateKey ? { templateKey } : {}),
          notionLeadId: lead.id,
          notionListingId: listing.id,
          buyer: {
            email: email.trim(),
            name: name.trim() || undefined,
            phone: phone.trim() || undefined,
          },
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? `Request failed with status ${res.status}`);
      }
      const envelopeNumber = body.envelopeNumber as number;
      setResult({ kind: 'success', envelopeNumber });
      onSent?.(envelopeNumber);
      // Auto-close after 1.6 seconds so the broker sees the confirmation
      setTimeout(() => setModalOpen(false), 1600);
    } catch (err: any) {
      setResult({ kind: 'error', message: err.message ?? 'Send failed' });
    } finally {
      setSubmitting(false);
    }
  };

  // ----- Render -------------------------------------------------------------
  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={disabledReason !== null}
        title={disabledReason ?? 'Send the NDA to this buyer for electronic signature'}
        style={{
          ...btnPrimary,
          ...(disabledReason ? btnDisabled : {}),
        }}
      >
        {label}
      </button>

      {modalOpen && (
        <Modal onClose={close}>
          <h2 style={modalTitle}>Send NDA to buyer</h2>
          <p style={modalSubtitle}>
            Review the buyer's contact info, then send. The buyer will receive an
            email with a unique signing link for{' '}
            <strong>{listing.businessName ?? 'this listing'}</strong>.
          </p>

          <Field
            label="Buyer email"
            value={email}
            onChange={setEmail}
            type="email"
            required
            placeholder="buyer@example.com"
          />
          <Field
            label="Buyer name"
            value={name}
            onChange={setName}
            placeholder="John Smith"
          />
          <Field
            label="Phone (optional)"
            value={phone}
            onChange={setPhone}
            type="tel"
            placeholder="555-555-1212"
          />

          {result.kind === 'success' && (
            <div style={successBanner}>
              ✓ NDA sent. Envelope #{result.envelopeNumber}.
            </div>
          )}
          {result.kind === 'error' && (
            <div style={errorBanner}>
              {result.message}
            </div>
          )}

          <div style={modalActions}>
            <button type="button" onClick={close} style={btnSecondary} disabled={submitting}>
              Cancel
            </button>
            <button
              type="button"
              onClick={send}
              disabled={!canSend}
              style={canSend ? btnPrimary : { ...btnPrimary, ...btnDisabled }}
            >
              {submitting ? 'Sending…' : 'Send NDA'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ============================================================================
// Subcomponents
// ============================================================================

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = 'text', required, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div style={fieldRow}>
      <label style={fieldLabel}>
        {label}
        {required && <span style={{ color: '#b8542e' }}>&nbsp;*</span>}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={fieldInput}
      />
    </div>
  );
}

// ============================================================================
// Styles — mirror the signing page tokens
// ============================================================================

const ACCENT = '#1e3a5f';
const INK = '#0a1929';
const INK_SOFT = '#2c3e50';
const PAPER = '#fdfcf8';
const PAPER_WARM = '#f7f4ec';
const RULE = '#d8d2c4';
const SUCCESS = '#2d5a3d';
const WARNING = '#b8542e';

const btnBase: React.CSSProperties = {
  padding: '10px 20px',
  fontFamily: 'IBM Plex Sans, Inter, system-ui, sans-serif',
  fontSize: 14,
  letterSpacing: '0.02em',
  border: 0,
  cursor: 'pointer',
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: ACCENT,
  color: PAPER,
};

const btnSecondary: React.CSSProperties = {
  ...btnBase,
  background: PAPER_WARM,
  color: INK_SOFT,
  border: `1px solid ${RULE}`,
};

const btnDisabled: React.CSSProperties = {
  background: RULE,
  color: INK_SOFT,
  cursor: 'not-allowed',
  opacity: 0.7,
};

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(10,25,41,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 16,
};

const modalCard: React.CSSProperties = {
  background: PAPER,
  border: `1px solid ${RULE}`,
  borderRadius: 2,
  padding: 28,
  width: '100%',
  maxWidth: 460,
  fontFamily: 'IBM Plex Sans, Inter, system-ui, sans-serif',
  color: INK,
  boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
};

const modalTitle: React.CSSProperties = {
  fontFamily: 'Charter, Georgia, serif',
  fontSize: 20,
  fontWeight: 600,
  margin: '0 0 6px 0',
  color: INK,
};

const modalSubtitle: React.CSSProperties = {
  fontSize: 13,
  color: INK_SOFT,
  margin: '0 0 18px 0',
  lineHeight: 1.5,
};

const fieldRow: React.CSSProperties = {
  marginBottom: 12,
};

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: INK_SOFT,
  marginBottom: 4,
  fontWeight: 500,
};

const fieldInput: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: `1px solid ${RULE}`,
  background: PAPER,
  fontFamily: 'Charter, Georgia, serif',
  fontSize: 15,
  color: INK,
  outline: 'none',
  boxSizing: 'border-box',
};

const modalActions: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
  marginTop: 18,
};

const successBanner: React.CSSProperties = {
  padding: '10px 12px',
  background: '#e8f1ea',
  borderLeft: `3px solid ${SUCCESS}`,
  color: SUCCESS,
  fontSize: 13,
  marginTop: 12,
};

const errorBanner: React.CSSProperties = {
  padding: '10px 12px',
  background: '#fbeae2',
  borderLeft: `3px solid ${WARNING}`,
  color: WARNING,
  fontSize: 13,
  marginTop: 12,
};
