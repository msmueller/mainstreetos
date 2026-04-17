/**
 * BizBuySell Email Parser
 *
 * Parses three types of inquiry emails from interest@bizbuysell.com:
 *   1. New Listing Lead  — "You have a new listing lead"
 *   2. Signed NDA         — "Your NDA has been signed"
 *   3. Broker Directory   — "New broker directory lead"
 */

export type BbsEmailType = 'listing_lead' | 'signed_nda' | 'broker_directory'

export interface BbsParsedLead {
  email_type: BbsEmailType
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_zip: string | null
  listing_name: string | null
  listing_id: string | null
  able_to_invest: number | null
  purchase_within: string | null
  comments: string | null
  nda_signed: boolean
}

/**
 * Detect which BBS email type this is based on body text
 */
function detectType(body: string): BbsEmailType | null {
  if (body.includes('You have a new listing lead')) return 'listing_lead'
  if (body.includes('Your NDA has been signed') || body.includes('non-disclosure agreement')) return 'signed_nda'
  if (body.includes('New broker directory lead') || body.includes('Broker Directory profile')) return 'broker_directory'
  return null
}

/**
 * Extract a field value using "Label: Value" or "Label:Value" pattern
 */
function extractField(body: string, label: string): string | null {
  // Match "Contact Name: John Smith" or "Contact Name:John Smith"
  const regex = new RegExp(`${label}\\s*:\\s*(.+?)(?:\\n|Contact |Comments|Headline|Listing ID|You can reply|We take|$)`, 'i')
  const match = body.match(regex)
  if (!match) return null
  const value = match[1].trim()
  if (!value || value === 'Not disclosed') return null
  return value
}

/**
 * Extract listing name from the email body
 */
function extractListingName(body: string, emailType: BbsEmailType): string | null {
  if (emailType === 'listing_lead') {
    // Pattern: "new lead regarding your listing:\n[Listing Name]\nListing ID:"
    const match = body.match(/(?:new lead regarding your listing|regarding your listing):\s*([\s\S]+?)(?:\s*Listing ID|\s*$)/i)
    if (match) return match[1].trim()
  }
  if (emailType === 'signed_nda') {
    // Pattern: "non-disclosure agreement regarding:\n[Listing Name]\nListing ID:"
    const match = body.match(/(?:non-disclosure agreement regarding|agreement regarding):\s*([\s\S]+?)(?:\s*Listing ID|\s*$)/i)
    if (match) return match[1].trim()
  }
  return null
}

/**
 * Extract listing ID
 */
function extractListingId(body: string): string | null {
  const match = body.match(/Listing ID:\s*#?(\d+)/i)
  return match ? match[1] : null
}

/**
 * Extract monetary amount from "Able to Invest: 800000.00"
 */
function extractInvestAmount(body: string): number | null {
  const match = body.match(/Able to Invest:\s*\$?([\d,]+(?:\.\d+)?)/i)
  if (!match) return null
  const amount = parseFloat(match[1].replace(/,/g, ''))
  return isNaN(amount) ? null : amount
}

/**
 * Extract comments/message from email body.
 * Comments come after "Comments:" and before the BBS footer boilerplate.
 */
function extractComments(body: string): string | null {
  const match = body.match(/Comments:\s*([\s\S]+?)(?:\s*Headline:|\s*You can reply|\s*We take our lead|\s*For your convenience|\s*Unsubscribe)/i)
  if (!match) return null
  const value = match[1].trim()
  return value || null
}

/**
 * Parse a BizBuySell inquiry email body into structured lead data
 */
export function parseBbsEmail(body: string, subject?: string): BbsParsedLead | null {
  const emailType = detectType(body)
  if (!emailType) return null

  const contactName = extractField(body, 'Contact Name')
  const contactEmail = extractField(body, 'Contact Email')
  const contactPhone = extractField(body, 'Contact Phone')
  const contactZip = extractField(body, 'Contact Zip')
  const listingName = extractListingName(body, emailType)
  const listingId = extractListingId(body)
  const ableToInvest = extractInvestAmount(body)
  const purchaseWithin = extractField(body, 'Purchase Within')
  const comments = extractComments(body)

  return {
    email_type: emailType,
    contact_name: contactName,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    contact_zip: contactZip,
    listing_name: listingName,
    listing_id: listingId,
    able_to_invest: ableToInvest,
    purchase_within: purchaseWithin,
    comments: comments,
    nda_signed: emailType === 'signed_nda',
  }
}

/**
 * Split a "First Last" name string into parts
 */
export function splitName(fullName: string | null): { first: string; last: string } {
  if (!fullName) return { first: '', last: '' }
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { first: parts[0], last: '' }
  const first = parts[0]
  const last = parts.slice(1).join(' ')
  return {
    first: first.charAt(0).toUpperCase() + first.slice(1).toLowerCase(),
    last: last.charAt(0).toUpperCase() + last.slice(1).toLowerCase(),
  }
}
