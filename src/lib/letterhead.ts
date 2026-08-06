/**
 * MainStreetOS · Per-template letterhead helpers
 *
 * A sign template may carry its own `source.letterhead` (e.g. the CRE /
 * property variant is branded "Arrow Real Estate Services, LLC" rather than
 * "CRE Resources, LLC"). These helpers resolve that letterhead generically so
 * the public NDA page, the envelope prefill (broker_* filled_values), and the
 * signed PDF all render the SAME per-template broker identity — falling back
 * to the global CRE Resources brand when a template has no letterhead.
 */

export type TemplateLetterhead = {
  broker_company?: string;
  broker_principal?: string;
  broker_role_line?: string;
  broker_address?: string;
  broker_phone?: string;
  broker_email?: string;
  broker_web?: string;
};

/**
 * Global CRE Resources brand — the fallback used when a template carries no
 * `source.letterhead`. Stands in for portal_branding (there is no dedicated
 * portal_branding store today; this constant IS the global brand).
 */
export const GLOBAL_BROKER_BRAND: Required<TemplateLetterhead> = {
  broker_company:   'CRE Resources, LLC',
  broker_principal: 'Mark S. Mueller, CAIBVS™',
  broker_role_line: 'Business Broker & Intermediary',
  broker_address:   'Titusville, NJ 08560',
  broker_phone:     '856.745.9706',
  broker_email:     'markm@creresources.biz',
  broker_web:       'creresources.biz',
};

/**
 * broker_* filled_values derived from a template's `source.letterhead`.
 * Only keys present on the letterhead are returned, so callers spread this
 * OVER their BROKER_DEFAULTS — a template without a letterhead leaves the
 * defaults untouched.
 */
export function brokerValuesFromLetterhead(lh?: TemplateLetterhead | null): Record<string, string> {
  if (!lh) return {};
  const out: Record<string, string> = {};
  if (lh.broker_company)   out.broker_company = lh.broker_company;
  if (lh.broker_principal) out.broker_name    = lh.broker_principal;   // signature block name
  if (lh.broker_role_line) out.broker_title   = lh.broker_role_line;   // signature block title / role line
  if (lh.broker_address)   out.broker_address = lh.broker_address;
  if (lh.broker_phone)     out.broker_phone   = lh.broker_phone;
  if (lh.broker_email)     out.broker_email   = lh.broker_email;
  return out;
}

/** Read a template's `source.letterhead` (null when absent). */
export function letterheadFromSource(source: any): TemplateLetterhead | null {
  const lh = source?.letterhead;
  return lh && typeof lh === 'object' ? (lh as TemplateLetterhead) : null;
}

/**
 * The strip label for the business_name token — "Business" for the BIZ /
 * Corporate templates, "Property" for the CRE variant — read from the
 * template's `listing_strip`. Falls back to "Business".
 */
export function businessStripLabel(source: any): string {
  const fields = source?.listing_strip?.fields;
  if (Array.isArray(fields)) {
    const f = fields.find((x: any) => String(x?.token ?? '').replace(/[{}]/g, '') === 'business_name');
    if (f?.label) return String(f.label);
  }
  return 'Business';
}
