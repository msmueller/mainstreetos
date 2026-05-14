/**
 * Lead Router — template renderer
 *
 * Compiles a sequence_steps row's subject_template + body_template (both
 * Handlebars source) against a RenderContext. Returns an HTML body, a
 * plain-text body derived from the HTML, and a rendered subject line.
 *
 * HTML escaping is automatic via Handlebars's default behavior on `{{var}}`
 * — this is what protects against malicious content in extracted buyer
 * fields (e.g., a buyer signing as `<script>...`). Subject lines are
 * compiled with `noEscape: true` because they are plain text, not HTML.
 */

import Handlebars from 'handlebars';
import type {
  ExtractedAttributes,
  Listing,
  RenderContext,
  RenderedEmail,
} from './types';

// ---------------------------------------------------------------------------
// Variable assembly — flat string map consumed by Handlebars
// ---------------------------------------------------------------------------

function fmtUsd(n: number | null | undefined, fallback: string): string {
  if (n === null || n === undefined || Number.isNaN(n)) return fallback;
  return `$${n.toLocaleString()}`;
}

function fallback(value: string | null | undefined, fb: string): string {
  if (value === null || value === undefined) return fb;
  const trimmed = value.trim();
  return trimmed.length === 0 ? fb : trimmed;
}

/**
 * Build the variable map used by every Lead Router template. Adding a new
 * template variable is a one-place change — extend this function and every
 * template can use it.
 */
export function buildVariables(
  ctx: RenderContext
): Record<string, string> {
  const { lead, listing, attrs, available_slots, broker } = ctx;

  return {
    // Buyer
    buyer_first_name: fallback(
      attrs.buyer_first_name ?? lead.buyer_first_name,
      'there'
    ),
    buyer_last_name: fallback(
      attrs.buyer_last_name ?? lead.buyer_last_name,
      ''
    ),
    buyer_email: fallback(attrs.buyer_email ?? lead.buyer_email, ''),
    buyer_timeframe: fallback(attrs.buyer_timeframe, 'your timeline'),
    buyer_investment_range: fallback(
      attrs.buyer_investment_range,
      'your investment range'
    ),
    buyer_industry_interest: fallback(attrs.buyer_industry_interest, ''),

    // Listing
    listing_name: fallback(listing?.name, 'the listing'),
    listing_title: fallback(listing?.listing_title, listing?.name ?? 'the listing'),
    listing_number: fallback(listing?.listing_number, '[Listing #]'),
    industry: fallback(listing?.industry, ''),
    location: fallback(listing?.location, ''),
    asking_price: fmtUsd(listing?.asking_price ?? null, 'available upon request'),
    sde: fmtUsd(listing?.sde ?? null, 'available upon NDA'),
    ebitda: fmtUsd(listing?.ebitda ?? null, 'available upon NDA'),

    // Document links
    om_link: fallback(listing?.om_link, '[link forthcoming]'),
    cim_link: fallback(listing?.cim_link, '[link forthcoming]'),
    bvr_link: fallback(listing?.bvr_link, '[link forthcoming]'),
    workbook_link: fallback(listing?.workbook_link, '[link forthcoming]'),
    // nda_link falls back to the generic NDA form when no per-listing URL exists
    nda_link: fallback(
      listing?.nda_link,
      fallback(broker.generic_nda_link, '[link forthcoming]')
    ),
    bbs_link: fallback(listing?.bbs_link, '[link forthcoming]'),
    loi_link: fallback(listing?.loi_link, '[link forthcoming]'),

    // Calendar
    available_slots: fallback(available_slots, 'any time that works for you'),

    // Broker identity
    broker_name: fallback(broker.name, 'Mark Mueller'),
    broker_phone: fallback(broker.phone, ''),
    broker_email: fallback(broker.email, 'markm@creresources.biz'),
    broker_firm: fallback(broker.firm, 'CRE Resources, LLC'),

    // System / form URLs
    buyer_profile_link: fallback(broker.buyer_profile_link, '[link forthcoming]'),
    generic_nda_link: fallback(broker.generic_nda_link, '[link forthcoming]'),
    buyer_acquisition_process: fallback(broker.buyer_acquisition_process, '[link forthcoming]'),
  };
}

// ---------------------------------------------------------------------------
// HTML → plain text
// ---------------------------------------------------------------------------

/**
 * Convert Handlebars-rendered HTML into a readable plain-text alternative
 * for the multipart/alternative MIME message. Conservative — preserves
 * paragraph breaks and bullet structure, decodes basic entities, strips
 * any remaining tags. Not a full HTML-to-text converter; sufficient for
 * the templates we ship.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/?(ul|ol)[^>]*>/gi, '\n')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi, '$2 ($1)')
    .replace(/<\/?(strong|b)[^>]*>/gi, '')
    .replace(/<\/?(em|i)[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RenderInput {
  /** Raw Handlebars source from sequence_steps.subject_template */
  subject_template: string;
  /** Raw Handlebars source from sequence_steps.body_template (HTML) */
  body_template: string;
  /** Rendering context — everything assembled by the Router */
  ctx: RenderContext;
}

/**
 * Compile + render the template against the context. Returns
 * `{ subject, html, text }` ready to hand to a Sender.
 */
export function renderEmail(input: RenderInput): RenderedEmail {
  const variables = buildVariables(input.ctx);

  const subjectTpl = Handlebars.compile(input.subject_template, {
    noEscape: true, // subject is plain text, not HTML
    strict: false,
  });
  const bodyTpl = Handlebars.compile(input.body_template, {
    noEscape: false, // HTML body — escape user-supplied data by default
    strict: false,
  });

  const subject = subjectTpl(variables).trim();
  const html = bodyTpl(variables);
  const text = htmlToText(html);

  return { subject, html, text };
}
