# NJ Dual Agency — Legal Research Memo (informational only, not legal advice)

**Date:** 2026-08-02. **Prepared for:** Mark Mueller, in support of the MSOS dual-agency gate (see `docs/MSOS-Entity-Architecture-and-Workflow-Model.md`, "Dual agency — modeled and gated").

**This is not legal advice.** It summarizes publicly available NJ statutory and regulatory text so the MSOS schema/UI can be shaped around the actual disclosure mechanics NJ law requires. Any disclosure form or exact language you present to a client or buyer should be reviewed by your attorney before use — this memo deliberately stops short of drafting that language.

## 1. Two different legal regimes apply, depending on deal type

MSOS's `DealType` already splits CRE from BIZ. That split matters a lot here, because NJ regulates dual agency very specifically for **real estate** transactions, but has **no equivalent business-broker-specific statute**:

- **CRE deals** (`cre_acquisition`, `cre_disposition`) — governed by NJ real estate license law: N.J.S.A. 45:15-16.87 through 16.95 (added/amended by the **Consumer Protection Enhancement Act**, S3192/A4454, signed July 2024, effective **August 1, 2024** — this is real, current law, not a proposal), plus N.J.A.C. 11:5-6.9 (Consumer Information Statement) and 11:5-7.1 (dual compensation).
- **BIZ deals** (`business_acquisition`, `business_disposition`) — New Jersey does not require a real estate license to broker the sale of a business's stock/assets when no real property changes hands, and there is no NJ business-broker-specific dual-agency statute. Dual agency there is a matter of **common-law fiduciary duty**, not a specific statutory disclosure regime. This is consistent with what your standard buyer paperwork already does (the NJ "CRE Buyer Pre-Qualification, Confidentiality & Acknowledgment" doc disclaims dual agency by default) — that disclaimer is doing the work a statute would otherwise require, in the absence of one.

Practical read: if a BIZ deal happens to include real property (e.g., the business owns its building and that's part of the sale), the CRE-side statutory requirements attach to that piece of the transaction even though the deal is coded as BIZ.

## 2. What NJ actually requires for CRE disclosed dual agency

**Informed consent, in writing** — N.J.S.A. 45:15-16.92: a brokerage may represent both parties only with informed consent "as set forth in brokerage services agreements signed by the buyer and the seller ... in a residential real estate transaction, or otherwise in writing in a commercial real estate transaction." For commercial (which is Mark's CRE work), the consent must be in writing — not necessarily in the standardized residential agreement format, but written and both-parties-signed.

**Two specific disclosures are mandatory, in writing:**
- Compensation sources and amounts from both buyer and seller.
- Any actual or potential conflicts of interest the dual agent can reasonably anticipate.

**Non-waivable duties (N.J.S.A. 45:15-16.87), regardless of agency type:** no action adverse to either party; timely disclosure of conflicts; advise both parties to seek outside expert advice where needed; confidentiality (survives the relationship); good-faith effort to find buyers/properties (with narrow attorney-reviewed exceptions).

**Consumer Information Statement (N.J.A.C. 11:5-6.9):** a separate, mandatory disclosure of the five possible relationship types (seller's agent, buyer's agent, disclosed dual agent, designated agent, transaction broker) that must be delivered — verbally before discussing motivation/price, in writing by first showing or before an initial offer is prepared — with signed acknowledgment retained as a business record for **six years**. This is distinct from, and in addition to, the dual-agency-specific written consent above.

**Designated agency (new as of the 2024 Act):** a fifth relationship type where a single brokerage still technically represents both sides, but assigns a different individual licensee to each party, each owing full fiduciary duty to their own side, while the firm itself is the disclosed dual agent overseeing it. This is a real alternative to "pure" dual agency worth knowing about — not built into MSOS's schema now, flagged as a possible future enhancement (see below) rather than something implemented today, since you asked specifically about dual agency, not a five-relationship-type overhaul.

**Enforcement:** violations can carry licensing discipline and civil liability for breach of fiduciary duty; exact penalty schedules should be confirmed with counsel rather than taken from secondary sources.

**A caution on sourcing:** one search result (is-this-legal.com) described a "2026 rule overhaul" with specific dollar penalty figures and a "5-year record retention" requirement. That page reads like SEO/content-mill material dressed up with the current year rather than a citation to an actual 2026 amendment — I could not corroborate a 2026 change from NJ.gov, NJ Realtors, or law-firm sources; all of those point to the 2024 CPEA as the current framework. Treat that source as unverified and don't rely on the specific figures it cites.

## 3. What this means for the MSOS dual-agency gate (implemented)

Given the above, the gate and its UI now:

- Distinguish CRE from BIZ in the disclosure copy shown to the broker — CRE buyers see the NJ statutory citation and a reminder that written consent is required by law; BIZ buyers see a plain best-practice reminder rather than a statutory claim, since none applies unless real property is involved.
- Let the broker attach a link to the actual signed written-consent document (`dual_agency_consent_url` on `deal_access`, added in the original migration but previously unused by the UI) at the moment disclosure is recorded — because "informed consent" under 45:15-16.92 means a written, signed document, not just a system timestamp. The timestamp (`dual_agency_disclosed_at`) is MSOS's own audit trail of *when* that document was executed, not a substitute for it.
- Still does not draft, generate, or store the disclosure language itself — that's the attorney-reviewed document you'd link to, not something this system produces.

## 4. Not addressed (deliberately)

- Exact consent-form wording, compensation-disclosure table format, or Consumer Information Statement content/text — these are the parts that need your attorney, and for CRE specifically should track the NJ REALTORS®-published CIS forms (CIS-A / CIS-B) rather than a bespoke version.
- Pennsylvania's equivalent requirements — you mentioned separate PA paperwork exists; PA's dual-agency/consent rules differ from NJ's and weren't researched here. Flag if you want that done as a follow-up.
- Designated agency as a modeled MSOS relationship type — noted above as a real option under the 2024 Act, not built.

## Sources

- [N.J. Rev. Stat. § 45:15-16.92 — disclosed dual agent, informed consent](https://law.justia.com/codes/new-jersey/title-45/section-45-15-16-92/)
- [N.J. Rev. Stat. § 45:15-16.87 — brokerage firm duties by agency type](https://law.justia.com/codes/new-jersey/title-45/section-45-15-16-87/)
- [N.J.A.C. 11:5-6.9 — Consumer Information Statement](https://regulations.justia.com/states/new-jersey/title-11/chapter-5/subchapter-6/section-11-5-6-9/)
- [N.J.A.C. 11:5-7.1 — prohibition on dual compensation without disclosure](https://www.law.cornell.edu/regulations/new-jersey/N-J-A-C-11-5-7-1)
- [NJ Realtors — Consumer Protection Enhancement Act (CPEA) overview, effective 8/1/2024](https://www.njrealtor.com/government-affairs/cpea/)
- [NJ Dept. of Banking & Insurance bulletin on the Consumer Information Statement](https://nj.gov/dobi/bulletins/blt24_11Info.pdf)
- [NJ Realtors — Consumer Information Statement (CIS) form](https://www.njrealtor.com/wp-content/uploads/2024/08/CIS-A-2024-08.pdf)
- [Business Brokerage Press — state-by-state business broker licensing requirements (NJ not listed as requiring one)](https://businessbrokeragepress.com/industry-resources/state-licensing/)
- Treated as unverified, not relied upon: [is-this-legal.com — "2026 rule changes" claim](https://is-this-legal.com/is-dual-agency-legal-in-new-jersey/)
