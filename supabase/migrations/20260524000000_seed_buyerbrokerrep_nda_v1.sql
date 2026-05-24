-- Migration: Seed BuyerBrokerRep_NDA template v1
-- ================================================================
-- Phase 7 (Buyer-Broker Representation) System 3 seed.
--
-- This migration seeds a NEW click-wrap template architecturally
-- isolated from System 1 (NDA_BuyerProfile, sell-side BBS lead flow).
--
-- System 3 use case: Mark Mueller represents a Buyer Client under an
-- Exclusive Buyer Brokerage Agreement. Buyer Client fills the Notion
-- form "Main Street Buyer Profile — Intake Form" (Notion DB
-- 2ea28c7df4864076876f15fbcc6b7b45). Mark triggers MSOS to import
-- that data into a click-wrap envelope. Buyer Client + Mark both sign
-- (two-signer). PDF is sent OUTBOUND by Mark to multiple Sellers'
-- Brokers as a reusable confidentiality wrapper, eliminating per-deal
-- NDAs.
--
-- NDA orientation: PURE 3-way confidentiality. No commission,
-- procuring-cause, retainer, or BRA-commercial-term language. The
-- BRA between Mark and the Buyer Client is referenced in ONE sentence
-- in the Preamble; its commercial terms are private.
--
-- Author: Mark S. Mueller (legal text approved 2026-05-24 v1.3)
-- Architecture isolation: see memory/project_mainstreetos_clickwrap_three_systems.md
-- ================================================================

DO $migration$
DECLARE
  v_disclosure_id uuid;
  v_template_id   uuid;
  v_source        jsonb;
  v_fields_schema jsonb;
  v_disclosure_text text;
  v_source_sha256 text;
BEGIN

-- ----------------------------------------------------------------
-- 1. Disclosure version: plain-text canonical NDA for hash trail
-- ----------------------------------------------------------------

v_disclosure_text := $DISCLOSURE$
BUYER PROFILE & NON-DISCLOSURE AGREEMENT
(Buyer-Broker Representation Form — Outbound to Sellers and Sellers' Brokers)
Template: BuyerBrokerRep_NDA v1.3
Legal authorities: NJ N.J.S.A. 12A:12-1 et seq. · ESIGN 15 U.S.C. § 7001 et seq. · NJ Trade Secrets Act N.J.S.A. 56:15-1 et seq.

PREAMBLE
This Non-Disclosure Agreement (this "NDA"), dated and effective as of the latest date below (the "Effective Date"), is by and between the Buyer Client identified on the signature page and CRE Resources, LLC, acting in its capacity as Buyer's Broker for the Buyer Client ("Buyer's Broker" and, together with Buyer Client, the "Receiving Parties"), and is intended for delivery to one or more business owners ("Seller") and their respective brokers, agents, or representatives ("Seller's Broker") in connection with the Buyer Client's evaluation of potential business acquisition opportunities.

CRE Resources, LLC has entered into an Exclusive Buyer Brokerage Agreement with Buyer Client governing the buyer-side representation relationship. The terms of that agreement are private between Buyer Client and Buyer's Broker, and are not the subject of this NDA. The purpose of this NDA is solely to set forth the Receiving Parties' confidentiality obligations with respect to Confidential Information shared by any Seller, Seller's Broker, or Buyer's Broker in connection with the evaluation of any business acquisition opportunity.

In consideration of the disclosure of Confidential Information to the Receiving Parties, the Receiving Parties agree as follows:

§1 — CONFIDENTIAL INFORMATION
In connection with the Buyer Client's evaluation of potential business acquisition opportunities, the Receiving Parties may receive certain confidential and proprietary information from one or more of the following sources: (a) the seller of a business listed for sale (each, a "Seller"), (b) the broker, agent, or other representative of any such Seller (each, a "Seller's Broker"), and/or (c) Buyer's Broker itself, acting in its capacity as Buyer Client's representative (collectively, the "Disclosing Parties").
"Confidential Information" means any non-public, confidential, or proprietary information disclosed by any Disclosing Party to either Receiving Party, regardless of form or media, including without limitation: financial statements, tax returns, customer and supplier lists, employee lists and compensation, lease and contract terms, business plans, operating procedures, trade secrets, intellectual property, pricing data, marketing plans, valuations, comparable transaction data, deal pipeline information, prospective seller identities, the existence or terms of any potential transaction, and any analyses or notes prepared by either Receiving Party derived from such information.
The Receiving Parties each agree to (i) hold all Confidential Information in strict confidence, (ii) use such Confidential Information solely for the purpose of evaluating a potential business acquisition by Buyer Client, and (iii) not disclose, publish, or otherwise reveal any Confidential Information to any third party without the prior written consent of the applicable Disclosing Party.
Nothing in this NDA shall limit or supersede any rights or remedies available to any Disclosing Party under the New Jersey Trade Secrets Act, N.J.S.A. 56:15-1 et seq., or any other applicable statute or common-law doctrine, all of which are expressly preserved.

§2 — PERMITTED DISCLOSURES
Notwithstanding §1, either Receiving Party may disclose Confidential Information to its own legal counsel, accountant, tax advisor, financial advisor, lender, or prospective lender, in each case solely to the extent reasonably necessary to evaluate, finance, or close a potential acquisition and provided that such recipient is bound by professional or contractual obligations of confidentiality at least as restrictive as those imposed by this NDA. The disclosing Receiving Party shall remain responsible for any breach of confidentiality by any such recipient.
A Receiving Party may also disclose Confidential Information to the extent required by applicable law, regulation, court order, or subpoena, provided that such Receiving Party (where legally permitted) gives prompt written notice to the applicable Disclosing Party so that the Disclosing Party may seek a protective order or other appropriate remedy.

§3 — CONDUCT & NO DIRECT CONTACT
The Receiving Parties acknowledge and agree that all communications concerning any business introduced through Buyer's Broker shall be conducted solely through Buyer's Broker, who will in turn liaise with the applicable Seller's Broker. The Buyer Client shall not approach, contact, or visit the physical location of any such business, or contact or approach any of its officers, managers, agents, employees, independent contractors, customers, suppliers, landlords, or competitors, without an appointment arranged through Buyer's Broker and the applicable Seller's Broker.
This contact-discipline provision exists to protect the confidentiality of the contemplated transaction and the integrity of the Seller's ongoing business operations, and is independent of any commercial or compensation arrangement between Buyer's Broker, Buyer Client, Seller, or Seller's Broker.

§4 — INFORMATION & CONDUIT; NO WARRANTIES
The Receiving Parties acknowledge that Buyer's Broker acts as a conduit of information provided by Sellers, Sellers' Brokers, and other third-party sources, and has not made and will not make any independent investigation of the accuracy or completeness of such information. Any and all representations and warranties concerning a Business shall be made solely by and between Seller and Buyer Client in a signed purchase/sale agreement and shall be subject to the provisions thereof.
Neither Buyer's Broker nor any Seller's Broker makes any representations or warranties whatsoever, express or implied, to Buyer Client with respect to any business or the veracity or completeness of the Confidential Information disclosed. Buyer Client acknowledges and agrees that it will not rely upon any information, written or oral, furnished by Buyer's Broker or any Seller's Broker, and that all Confidential Information received must be independently verified by Buyer Client prior to entering into any purchase agreement.

§5 — RETURN OR DESTRUCTION
Upon written request from any Disclosing Party — whether following the Buyer Client's decision not to proceed with a transaction, the termination of negotiations, or for any other reason — each Receiving Party shall promptly return to the applicable Disclosing Party, or destroy and certify in writing the destruction of, all Confidential Information in its possession or control that originated with that Disclosing Party, including all copies, summaries, abstracts, notes, and derivative analyses prepared by either Receiving Party from such Confidential Information. Notwithstanding the foregoing, a Receiving Party may retain Confidential Information to the extent required by applicable law, professional record-keeping requirements, or routine electronic backup, provided that any such retained Confidential Information remains subject to this NDA.

§6 — SELLER AND SELLER'S BROKER AS THIRD-PARTY BENEFICIARIES
Each Seller and each Seller's Broker to whom this NDA (or any Confidential Information protected hereby) is delivered shall have the right to enforce the terms of this NDA directly against the Receiving Parties. For such limited purposes only, each such Seller and each such Seller's Broker shall be considered an intended third-party beneficiary hereunder. The fact that a Seller or Seller's Broker is not a signatory to this NDA shall not prohibit, alter, or limit such party's right to enforce the terms hereof.

§7 — REPRESENTATION & ADVICE
Buyer's Broker is engaged solely as Buyer Client's representative in the buy-side engagement pursuant to a separately executed Exclusive Buyer Brokerage Agreement between Buyer's Broker and Buyer Client. The terms of that engagement are private between Buyer's Broker and Buyer Client and are not modified or supplemented by this NDA. Any Seller's Broker is understood to be engaged solely as the representative of their respective Seller pursuant to a separate engagement between Seller and Seller's Broker, the terms of which are likewise not the subject of this NDA.
Buyer's Broker has advised Buyer Client to consult an attorney and/or certified public accountant for assistance in reviewing and verifying the legal, financial, and other information disclosed in connection with any business of interest. Buyer Client has had ample opportunity to seek independent legal advice related to this NDA and is not relying on any statements of Buyer's Broker in entering into this NDA.

§8 — WARRANTIES
Buyer Client represents and warrants that: (a) Buyer Client does not represent any third-party competitor of any business introduced hereunder, and is not an employee or agent of a competitor business with respect to any specific business reviewed unless separately disclosed to Buyer's Broker and the applicable Seller's Broker in writing; (b) the sole purpose for requesting and receiving Confidential Information on any business is to evaluate Buyer Client's desire to effect a purchase, merger, or acquisition of such business, and Buyer Client will not use any Confidential Information for any other purpose; (c) Buyer Client is financially capable of pursuing a business acquisition consistent with the Capital Capacity range indicated in Section A (Buyer Profile) of this document; and (d) the information provided by Buyer Client in Section A (Buyer Profile) is true and complete in all material respects as of the Effective Date.
Buyer's Broker represents and warrants that it has entered into an Exclusive Buyer Brokerage Agreement with Buyer Client and is authorized to represent Buyer Client in the buy-side engagement contemplated by this NDA.

§9 — INDEMNIFICATION
Each Receiving Party shall be solely responsible for any breach of this NDA by such Receiving Party or any of its agents, representatives, employees, or permitted recipients under §2 (Permitted Disclosures), and shall fully indemnify, defend, and hold harmless the applicable Disclosing Party (including Sellers and Sellers' Brokers as third-party beneficiaries under §6) from any costs, damages, expenses, and reasonable attorneys' fees actually incurred by such Disclosing Party as a direct result of such breach. This indemnification is limited to breaches of this NDA and does not extend to disputes arising from the underlying commercial transaction, the Buyer Brokerage Agreement, or any listing agreement between Seller and Seller's Broker.

§10 — SURVIVAL
The confidentiality obligations of the Receiving Parties under §1 (Confidential Information), §2 (Permitted Disclosures), and §5 (Return or Destruction), and the indemnification obligations under §9, shall survive any termination, expiration, or fulfillment of this NDA for a period of five (5) years from the Effective Date, except with respect to any Confidential Information that constitutes a trade secret under applicable law, which shall remain confidential for so long as it qualifies as a trade secret. All other provisions shall survive only to the extent necessary to enforce surviving obligations.

§11 — GOVERNING LAW, JURISDICTION & ATTORNEYS' FEES
This NDA shall be governed by and construed in accordance with the laws of the State of New Jersey, without regard to its conflict-of-laws principles. The parties consent and agree that Mercer County, New Jersey shall be the sole and exclusive venue for all proceedings relating to this NDA and/or its subject matter, including without limitation the enforcement hereof, and each party hereby waives all objections to establishing venue elsewhere.
In the event of any breach or threatened breach of this NDA, any Disclosing Party (including Sellers and Sellers' Brokers as third-party beneficiaries) may obtain, in addition to any other legal remedies which may be available, such equitable relief as may be necessary to protect such Disclosing Party against such breach or threatened breach, with the posting of a minimal bond as determined by a court of competent jurisdiction.
In the event of any dispute or litigation arising out of or relating to this NDA, the prevailing party shall be entitled to an award of its reasonable attorneys' fees, costs, and expenses incurred at both the trial-court and appellate levels.

§12 — WIRE TRANSFER FRAUD NOTICE
Buyer's Broker will never request or send wire instructions by electronic mail. The Receiving Parties acknowledge and agree to verbally verify any account information directly from any escrow agent and not to rely on account or contact information obtained via email without verbally confirming accuracy. Any wire instructions received by either Receiving Party purporting to come from Buyer's Broker, any Seller, or any Seller's Broker by email should be treated as suspicious and confirmed by telephone using a known, independently-verified number before any funds are transferred.

§13 — COPIES; ELECTRONIC EXECUTION; COUNTERPARTS; ENTIRE AGREEMENT
This NDA may be executed in counterparts and the separate counterparts may be jointly deemed one whole instrument. An electronically transmitted copy with signatures shall be considered an original. The parties expressly intend and consent that this NDA may be executed by electronic signature in accordance with the Electronic Signatures in Global and National Commerce Act, 15 U.S.C. § 7001 et seq., and the New Jersey Uniform Electronic Transactions Act, N.J.S.A. 12A:12-1 et seq., and that an electronic signature affixed by either Receiving Party through Buyer's Broker's signing platform shall have the same legal effect as a handwritten signature on a paper original.
This NDA constitutes the entire agreement of the Receiving Parties with respect to its subject matter and supersedes any prior or contemporaneous understandings regarding confidentiality between the Receiving Parties. No amendment shall be effective unless in writing and signed by both Receiving Parties (and acknowledged by any affected Disclosing Party where applicable).

END OF NDA — Buyer Client signs first (Section B signature block), Buyer's Broker (Mark S. Mueller, CRE Resources, LLC) countersigns second.
$DISCLOSURE$;

-- ----------------------------------------------------------------
-- 2. Source JSONB — full template structure consumed by render-pdf
--    and the signing page UI
-- ----------------------------------------------------------------

v_source := jsonb_build_object(
  'version', 1,
  'template_key', 'BuyerBrokerRep_NDA',
  'display_name', 'Buyer Profile & Pre-Signed NDA (Buyer-Broker Representation) v1',
  'based_on', 'Mark S. Mueller approved 2026-05-24 v1.3 — pure 3-way confidentiality NDA paired with 9-section Buyer Profile',
  'system_tag', 'system3_buy_side',  -- isolation marker (see project memory)
  'preamble', 'This Non-Disclosure Agreement (this "NDA"), dated and effective as of the latest date below (the "Effective Date"), is by and between {{buyer_name}} (the "Buyer Client") and CRE Resources, LLC, acting in its capacity as Buyer''s Broker for the Buyer Client ("Buyer''s Broker" and, together with Buyer Client, the "Receiving Parties"), and is intended for delivery to one or more business owners ("Seller") and their respective brokers, agents, or representatives ("Seller''s Broker") in connection with the Buyer Client''s evaluation of potential business acquisition opportunities. CRE Resources, LLC has entered into an Exclusive Buyer Brokerage Agreement with Buyer Client governing the buyer-side representation relationship. The terms of that agreement are private between Buyer Client and Buyer''s Broker, and are not the subject of this NDA. The purpose of this NDA is solely to set forth the Receiving Parties'' confidentiality obligations with respect to Confidential Information shared by any Seller, Seller''s Broker, or Buyer''s Broker in connection with the evaluation of any business acquisition opportunity.',
  'letterhead', jsonb_build_object(
    'broker_company', 'CRE Resources, LLC',
    'broker_principal', 'Mark S. Mueller, CAIBVS™',
    'broker_role_line', 'Buyer''s Broker | Business Broker & Intermediary | CRE Agent & Advisor',
    'broker_web', 'https://creresources.biz',
    'broker_email', 'markm@creresources.biz',
    'broker_phone', '856.745.9706',
    'broker_address', 'Titusville, NJ 08560',
    'platform_powered_by', 'MainStreetOS',
    'platform_url', 'https://mainstreetos.biz'
  ),
  'listing_strip', jsonb_build_object(
    'title', 'Buyer-Broker Representation',
    'fields', jsonb_build_array(
      jsonb_build_object('label', 'Date',                      'token', '{{effective_date}}'),
      jsonb_build_object('label', 'Buyer Client',              'token', '{{buyer_name}}'),
      jsonb_build_object('label', 'Represented By',            'token', 'CRE Resources, LLC · Buyer''s Broker'),
      jsonb_build_object('label', 'BRA Effective Date',        'token', '{{bra_effective_date}}'),
      jsonb_build_object('label', 'Form Purpose',              'token', 'Buyer Pre-Qualification + Pre-Signed Confidentiality NDA (reusable across business acquisition opportunities)')
    )
  ),
  'nda_section', jsonb_build_object(
    'title', 'Section B — Non-Disclosure Agreement',
    'preamble', 'In consideration of the disclosure of Confidential Information to the Receiving Parties, the Receiving Parties agree as follows:',
    'clauses', jsonb_build_array(
      jsonb_build_object('number', '1', 'heading', 'Confidential Information',
        'text', 'In connection with the Buyer Client''s evaluation of potential business acquisition opportunities, the Receiving Parties may receive certain confidential and proprietary information from one or more of the following sources: (a) the seller of a business listed for sale (each, a "Seller"), (b) the broker, agent, or other representative of any such Seller (each, a "Seller''s Broker"), and/or (c) Buyer''s Broker itself, acting in its capacity as Buyer Client''s representative (collectively, the "Disclosing Parties"). "Confidential Information" means any non-public, confidential, or proprietary information disclosed by any Disclosing Party to either Receiving Party, regardless of form or media, including without limitation: financial statements, tax returns, customer and supplier lists, employee lists and compensation, lease and contract terms, business plans, operating procedures, trade secrets, intellectual property, pricing data, marketing plans, valuations, comparable transaction data, deal pipeline information, prospective seller identities, the existence or terms of any potential transaction, and any analyses or notes prepared by either Receiving Party derived from such information. The Receiving Parties each agree to (i) hold all Confidential Information in strict confidence, (ii) use such Confidential Information solely for the purpose of evaluating a potential business acquisition by Buyer Client, and (iii) not disclose, publish, or otherwise reveal any Confidential Information to any third party without the prior written consent of the applicable Disclosing Party. Nothing in this NDA shall limit or supersede any rights or remedies available to any Disclosing Party under the New Jersey Trade Secrets Act, N.J.S.A. 56:15-1 et seq., or any other applicable statute or common-law doctrine, all of which are expressly preserved.'),
      jsonb_build_object('number', '2', 'heading', 'Permitted Disclosures',
        'text', 'Notwithstanding §1, either Receiving Party may disclose Confidential Information to its own legal counsel, accountant, tax advisor, financial advisor, lender, or prospective lender, in each case solely to the extent reasonably necessary to evaluate, finance, or close a potential acquisition and provided that such recipient is bound by professional or contractual obligations of confidentiality at least as restrictive as those imposed by this NDA. The disclosing Receiving Party shall remain responsible for any breach of confidentiality by any such recipient. A Receiving Party may also disclose Confidential Information to the extent required by applicable law, regulation, court order, or subpoena, provided that such Receiving Party (where legally permitted) gives prompt written notice to the applicable Disclosing Party so that the Disclosing Party may seek a protective order or other appropriate remedy.'),
      jsonb_build_object('number', '3', 'heading', 'Conduct & No Direct Contact',
        'text', 'The Receiving Parties acknowledge and agree that all communications concerning any business introduced through Buyer''s Broker shall be conducted solely through Buyer''s Broker, who will in turn liaise with the applicable Seller''s Broker. The Buyer Client shall not approach, contact, or visit the physical location of any such business, or contact or approach any of its officers, managers, agents, employees, independent contractors, customers, suppliers, landlords, or competitors, without an appointment arranged through Buyer''s Broker and the applicable Seller''s Broker. This contact-discipline provision exists to protect the confidentiality of the contemplated transaction and the integrity of the Seller''s ongoing business operations, and is independent of any commercial or compensation arrangement between Buyer''s Broker, Buyer Client, Seller, or Seller''s Broker.'),
      jsonb_build_object('number', '4', 'heading', 'Information & Conduit; No Warranties',
        'text', 'The Receiving Parties acknowledge that Buyer''s Broker acts as a conduit of information provided by Sellers, Sellers'' Brokers, and other third-party sources, and has not made and will not make any independent investigation of the accuracy or completeness of such information. Any and all representations and warranties concerning a Business shall be made solely by and between Seller and Buyer Client in a signed purchase/sale agreement and shall be subject to the provisions thereof. Neither Buyer''s Broker nor any Seller''s Broker makes any representations or warranties whatsoever, express or implied, to Buyer Client with respect to any business or the veracity or completeness of the Confidential Information disclosed. Buyer Client acknowledges and agrees that it will not rely upon any information, written or oral, furnished by Buyer''s Broker or any Seller''s Broker, and that all Confidential Information received must be independently verified by Buyer Client prior to entering into any purchase agreement.'),
      jsonb_build_object('number', '5', 'heading', 'Return or Destruction',
        'text', 'Upon written request from any Disclosing Party — whether following the Buyer Client''s decision not to proceed with a transaction, the termination of negotiations, or for any other reason — each Receiving Party shall promptly return to the applicable Disclosing Party, or destroy and certify in writing the destruction of, all Confidential Information in its possession or control that originated with that Disclosing Party, including all copies, summaries, abstracts, notes, and derivative analyses prepared by either Receiving Party from such Confidential Information. Notwithstanding the foregoing, a Receiving Party may retain Confidential Information to the extent required by applicable law, professional record-keeping requirements, or routine electronic backup, provided that any such retained Confidential Information remains subject to this NDA.'),
      jsonb_build_object('number', '6', 'heading', 'Seller and Seller''s Broker as Third-Party Beneficiaries',
        'text', 'Each Seller and each Seller''s Broker to whom this NDA (or any Confidential Information protected hereby) is delivered shall have the right to enforce the terms of this NDA directly against the Receiving Parties. For such limited purposes only, each such Seller and each such Seller''s Broker shall be considered an intended third-party beneficiary hereunder. The fact that a Seller or Seller''s Broker is not a signatory to this NDA shall not prohibit, alter, or limit such party''s right to enforce the terms hereof.'),
      jsonb_build_object('number', '7', 'heading', 'Representation & Advice',
        'text', 'Buyer''s Broker is engaged solely as Buyer Client''s representative in the buy-side engagement pursuant to a separately executed Exclusive Buyer Brokerage Agreement between Buyer''s Broker and Buyer Client. The terms of that engagement are private between Buyer''s Broker and Buyer Client and are not modified or supplemented by this NDA. Any Seller''s Broker is understood to be engaged solely as the representative of their respective Seller pursuant to a separate engagement between Seller and Seller''s Broker, the terms of which are likewise not the subject of this NDA. Buyer''s Broker has advised Buyer Client to consult an attorney and/or certified public accountant for assistance in reviewing and verifying the legal, financial, and other information disclosed in connection with any business of interest. Buyer Client has had ample opportunity to seek independent legal advice related to this NDA and is not relying on any statements of Buyer''s Broker in entering into this NDA.'),
      jsonb_build_object('number', '8', 'heading', 'Warranties',
        'text', 'Buyer Client represents and warrants that: (a) Buyer Client does not represent any third-party competitor of any business introduced hereunder, and is not an employee or agent of a competitor business with respect to any specific business reviewed unless separately disclosed to Buyer''s Broker and the applicable Seller''s Broker in writing; (b) the sole purpose for requesting and receiving Confidential Information on any business is to evaluate Buyer Client''s desire to effect a purchase, merger, or acquisition of such business, and Buyer Client will not use any Confidential Information for any other purpose; (c) Buyer Client is financially capable of pursuing a business acquisition consistent with the Capital Capacity range indicated in Section A (Buyer Profile) of this document; and (d) the information provided by Buyer Client in Section A (Buyer Profile) is true and complete in all material respects as of the Effective Date. Buyer''s Broker represents and warrants that it has entered into an Exclusive Buyer Brokerage Agreement with Buyer Client and is authorized to represent Buyer Client in the buy-side engagement contemplated by this NDA.'),
      jsonb_build_object('number', '9', 'heading', 'Indemnification',
        'text', 'Each Receiving Party shall be solely responsible for any breach of this NDA by such Receiving Party or any of its agents, representatives, employees, or permitted recipients under §2 (Permitted Disclosures), and shall fully indemnify, defend, and hold harmless the applicable Disclosing Party (including Sellers and Sellers'' Brokers as third-party beneficiaries under §6) from any costs, damages, expenses, and reasonable attorneys'' fees actually incurred by such Disclosing Party as a direct result of such breach. This indemnification is limited to breaches of this NDA and does not extend to disputes arising from the underlying commercial transaction, the Buyer Brokerage Agreement, or any listing agreement between Seller and Seller''s Broker.'),
      jsonb_build_object('number', '10', 'heading', 'Survival',
        'text', 'The confidentiality obligations of the Receiving Parties under §1 (Confidential Information), §2 (Permitted Disclosures), and §5 (Return or Destruction), and the indemnification obligations under §9, shall survive any termination, expiration, or fulfillment of this NDA for a period of five (5) years from the Effective Date, except with respect to any Confidential Information that constitutes a trade secret under applicable law, which shall remain confidential for so long as it qualifies as a trade secret. All other provisions shall survive only to the extent necessary to enforce surviving obligations.'),
      jsonb_build_object('number', '11', 'heading', 'Governing Law, Jurisdiction & Attorneys'' Fees',
        'text', 'This NDA shall be governed by and construed in accordance with the laws of the State of New Jersey, without regard to its conflict-of-laws principles. The parties consent and agree that Mercer County, New Jersey shall be the sole and exclusive venue for all proceedings relating to this NDA and/or its subject matter, including without limitation the enforcement hereof, and each party hereby waives all objections to establishing venue elsewhere. In the event of any breach or threatened breach of this NDA, any Disclosing Party (including Sellers and Sellers'' Brokers as third-party beneficiaries) may obtain, in addition to any other legal remedies which may be available, such equitable relief as may be necessary to protect such Disclosing Party against such breach or threatened breach, with the posting of a minimal bond as determined by a court of competent jurisdiction. In the event of any dispute or litigation arising out of or relating to this NDA, the prevailing party shall be entitled to an award of its reasonable attorneys'' fees, costs, and expenses incurred at both the trial-court and appellate levels.'),
      jsonb_build_object('number', '12', 'heading', 'Wire Transfer Fraud Notice',
        'text', 'Buyer''s Broker will never request or send wire instructions by electronic mail. The Receiving Parties acknowledge and agree to verbally verify any account information directly from any escrow agent and not to rely on account or contact information obtained via email without verbally confirming accuracy. Any wire instructions received by either Receiving Party purporting to come from Buyer''s Broker, any Seller, or any Seller''s Broker by email should be treated as suspicious and confirmed by telephone using a known, independently-verified number before any funds are transferred.'),
      jsonb_build_object('number', '13', 'heading', 'Copies; Electronic Execution; Counterparts; Entire Agreement',
        'text', 'This NDA may be executed in counterparts and the separate counterparts may be jointly deemed one whole instrument. An electronically transmitted copy with signatures shall be considered an original. The parties expressly intend and consent that this NDA may be executed by electronic signature in accordance with the Electronic Signatures in Global and National Commerce Act, 15 U.S.C. § 7001 et seq., and the New Jersey Uniform Electronic Transactions Act, N.J.S.A. 12A:12-1 et seq., and that an electronic signature affixed by either Receiving Party through Buyer''s Broker''s signing platform shall have the same legal effect as a handwritten signature on a paper original. This NDA constitutes the entire agreement of the Receiving Parties with respect to its subject matter and supersedes any prior or contemporaneous understandings regarding confidentiality between the Receiving Parties. No amendment shall be effective unless in writing and signed by both Receiving Parties (and acknowledged by any affected Disclosing Party where applicable).')
    )
  ),
  'audit_footer', jsonb_build_object(
    'lines', jsonb_build_array(
      'Envelope No. {{envelope_number}}  ·  Document hash (SHA-256): {{document_sha256_short}}  ·  Disclosure: {{disclosure_version_label}}',
      'Buyer Client signed {{buyer_signed_at_iso}} from {{buyer_signer_ip}} ({{buyer_geolocation}})  ·  Buyer''s Broker signed {{broker_signed_at_iso}} from {{broker_signer_ip}}',
      'Audit certificate available on request: {{envelope_audit_url_short}}'
    )
  ),
  'signature_block', jsonb_build_object(
    'buyer', jsonb_build_object(
      'heading', 'BUYER CLIENT',
      'role_label', 'Buyer Client (re-attests Buyer Profile data and accepts NDA terms)',
      'fields', jsonb_build_array(
        jsonb_build_object('label', 'Buyer Client Name (Individual or Legal Entity)', 'token', '{{buyer_name}}'),
        jsonb_build_object('label', 'Title (if signing on behalf of an entity)',      'token', '{{buyer_authorized_signatory}}', 'optional', true),
        jsonb_build_object('label', 'Buyer Client Signature (typed)',                 'token', '{{buyer_typed_signature}}', 'render_as', 'signature_line'),
        jsonb_build_object('label', 'Drawn Signature (optional)',                     'token', '{{buyer_drawn_signature}}',  'render_as', 'drawn_image', 'if_present', true),
        jsonb_build_object('label', 'Date Signed',                                    'token', '{{buyer_signed_at}}', 'render_as', 'date'),
        jsonb_build_object('label', 'Email',                                          'token', '{{buyer_email}}')
      )
    ),
    'broker', jsonb_build_object(
      'heading', 'BUYER''S BROKER',
      'role_label', 'Buyer''s Broker (countersigns; confirms representation of Buyer Client and joins NDA as Receiving Party)',
      'company', 'CRE Resources, LLC',
      'fields', jsonb_build_array(
        jsonb_build_object('label', 'By',                'token', '{{broker_typed_signature}}', 'render_as', 'signature_line'),
        jsonb_build_object('label', 'Drawn Signature (optional)', 'token', '{{broker_drawn_signature}}', 'render_as', 'drawn_image', 'if_present', true),
        jsonb_build_object('label', 'Name',              'token', '{{broker_name}}'),
        jsonb_build_object('label', 'Title',             'token', '{{broker_title}}'),
        jsonb_build_object('label', 'Date',              'token', '{{broker_signed_at}}', 'render_as', 'date'),
        jsonb_build_object('label', 'Email',             'token', '{{broker_email}}'),
        jsonb_build_object('label', 'BRA Effective Date with Buyer Client', 'token', '{{bra_effective_date}}')
      )
    )
  ),
  'buyer_profile_section', jsonb_build_object(
    'title', 'Section A — Main Street Buyer Pre-Qualification Profile',
    'intro', 'Buyer Client represents the following information regarding their identity, capacity, and intent to acquire a business. Sections 1-9 below mirror the CRE Resources Main Street Buyer Pre-Qual standard. All currency amounts are in USD. Items may be marked TBD or N/A when not yet known.',
    'sections', jsonb_build_array(
      jsonb_build_object('number', '1', 'title', 'Buyer Identity',
        'fields', jsonb_build_array(
          jsonb_build_object('label', 'Buyer Name (Individual or Entity)', 'token', '{{buyer_name}}',           'required', true),
          jsonb_build_object('label', 'Phone',                              'token', '{{buyer_phone}}',          'required', true),
          jsonb_build_object('label', 'Email',                              'token', '{{buyer_email}}',          'required', true),
          jsonb_build_object('label', 'Mailing Address',                    'token', '{{buyer_mailing_address}}','required', true, 'multiline', true),
          jsonb_build_object('label', 'LinkedIn URL',                       'token', '{{buyer_linkedin_url}}'),
          jsonb_build_object('label', 'Entity Type',                        'token', '{{buyer_entity_type}}',
            'options_hint', '(Individual / LLC / S-Corp / C-Corp / Partnership / Trust / To Be Formed at Closing)'),
          jsonb_build_object('label', 'State of Formation',                 'token', '{{buyer_state_of_formation}}')
        )
      ),
      jsonb_build_object('number', '2', 'title', 'Background & Experience',
        'fields', jsonb_build_array(
          jsonb_build_object('label', 'Professional Background',                'token', '{{buyer_professional_background}}',    'multiline', true),
          jsonb_build_object('label', 'Direct Industry Experience',             'token', '{{buyer_direct_industry_experience}}', 'multiline', true),
          jsonb_build_object('label', 'Prior Business Ownership',               'token', '{{buyer_prior_business_ownership}}',   'options_hint', '(Yes / No)'),
          jsonb_build_object('label', 'Prior Business Details (if Yes)',        'token', '{{buyer_prior_business_details}}',     'multiline', true),
          jsonb_build_object('label', 'Prior Director / Manager Experience',    'token', '{{buyer_prior_director_experience}}',  'options_hint', '(Yes / No)'),
          jsonb_build_object('label', 'Licenses / Certifications',              'token', '{{buyer_licenses_certifications}}')
        )
      ),
      jsonb_build_object('number', '3', 'title', 'Acquisition Criteria',
        'fields', jsonb_build_array(
          jsonb_build_object('label', 'Preferred Geography',            'token', '{{buyer_preferred_geography}}'),
          jsonb_build_object('label', 'Preferred Industries / Concepts','token', '{{buyer_preferred_industries}}'),
          jsonb_build_object('label', 'Deal Structures Considered',     'token', '{{buyer_deal_structures_considered}}',
            'options_hint', '(Asset Sale, Stock Sale, Seller Financing, SBA, Earn-out, Other)'),
          jsonb_build_object('label', 'Real Estate Preference',         'token', '{{buyer_real_estate_preference}}',
            'options_hint', '(Lease only, Real estate included, Either, Land + build)'),
          jsonb_build_object('label', 'Target Asking Price Range',      'token', '{{buyer_target_asking_price_range}}'),
          jsonb_build_object('label', 'Target Revenue Range',           'token', '{{buyer_target_revenue_range}}'),
          jsonb_build_object('label', 'Target SDE / Cash Flow Range',   'token', '{{buyer_target_sde_range}}'),
          jsonb_build_object('label', 'Hold Period Intent',             'token', '{{buyer_hold_period_intent}}',
            'options_hint', '(Long-term operator 10+ yrs, 5-10 yrs, 3-5 yrs, Flip / Short, TBD)')
        )
      ),
      jsonb_build_object('number', '4', 'title', 'Capital Capacity',
        'fields', jsonb_build_array(
          jsonb_build_object('label', 'Maximum All-In Deal Size',              'token', '{{buyer_max_deal_size}}'),
          jsonb_build_object('label', 'Cash Available for Down Payment',       'token', '{{buyer_cash_for_down_payment}}',  'format', 'currency'),
          jsonb_build_object('label', 'Total Equity Available',                'token', '{{buyer_total_equity_available}}', 'format', 'currency'),
          jsonb_build_object('label', 'Primary Financing Source',              'token', '{{buyer_primary_financing_source_multi}}',
            'options_hint', '(All-cash, SBA 7(a), SBA 504, Conventional Bank, Seller Financing, Investor Group, Combination)'),
          jsonb_build_object('label', 'Outside Investors',                     'token', '{{buyer_outside_investors}}', 'options_hint', '(Yes / No)'),
          jsonb_build_object('label', 'Investor Structure (if Outside Investors = Yes)', 'token', '{{buyer_investor_structure}}', 'multiline', true)
        )
      ),
      jsonb_build_object('number', '5', 'title', 'Specific Interest',
        'fields', jsonb_build_array(
          jsonb_build_object('label', 'Listing Reference (if any specific business is currently of interest)', 'token', '{{buyer_listing_reference}}'),
          jsonb_build_object('label', 'Why This Listing / Acquisition Criteria Rationale', 'token', '{{buyer_why_this_listing}}', 'multiline', true),
          jsonb_build_object('label', 'Indicative Offer Range',            'token', '{{buyer_indicative_offer_range}}'),
          jsonb_build_object('label', 'Operating Role Post-Close',         'token', '{{buyer_operating_role_post_close}}',
            'options_hint', '(Owner-Operator full-time, Working Owner part-time, Absentee with Director on site)')
        )
      ),
      jsonb_build_object('number', '6', 'title', 'Process & Timeline',
        'fields', jsonb_build_array(
          jsonb_build_object('label', 'Earliest NDA Execution',          'token', '{{buyer_earliest_nda_execution}}', 'options_hint', '(Today, 1-3 days, 1 week, 2 weeks)'),
          jsonb_build_object('label', 'Earliest POF Delivery After NDA', 'token', '{{buyer_earliest_pof_delivery}}',  'options_hint', '(Same day, 24-48 hrs, 1 week, 2 weeks)'),
          jsonb_build_object('label', 'Earliest LOI Submission',         'token', '{{buyer_earliest_loi_submission}}'),
          jsonb_build_object('label', 'Earliest Possible Close',         'token', '{{buyer_earliest_possible_close}}'),
          jsonb_build_object('label', 'Other Deals in Active Diligence', 'token', '{{buyer_other_active_diligence}}', 'multiline', true),
          jsonb_build_object('label', 'Funding Contingencies',           'token', '{{buyer_funding_contingencies}}',  'multiline', true)
        )
      ),
      jsonb_build_object('number', '7', 'title', 'Proof of Funds',
        'fields', jsonb_build_array(
          jsonb_build_object('label', 'POF Methods',                     'token', '{{buyer_pof_methods}}',
            'options_hint', '(Bank/brokerage statements, Lender pre-qual letter, CPA/attorney attestation, Buyer Broker attestation, Combination, Other)'),
          jsonb_build_object('label', 'POF Method Notes',                'token', '{{buyer_pof_method_notes}}',       'multiline', true),
          jsonb_build_object('label', 'Lender Name / Contact',           'token', '{{buyer_lender_name_contact}}'),
          jsonb_build_object('label', 'Lender / Loan Officer',           'token', '{{buyer_lender_loan_officer}}'),
          jsonb_build_object('label', 'Lender Pre-Qualification Status', 'token', '{{buyer_lender_prequal_status}}',  'options_hint', '(Pre-qualified, Pre-approved, In process, Not yet engaged)')
        )
      ),
      jsonb_build_object('number', '8', 'title', 'Professional Advisors',
        'fields', jsonb_build_array(
          jsonb_build_object('label', 'Buyer Broker (default: Mark Mueller, CRE Resources, LLC)', 'token', '{{buyer_buyer_broker}}'),
          jsonb_build_object('label', 'Buyer Side Attorney',       'token', '{{buyer_side_attorney}}'),
          jsonb_build_object('label', 'CPA / Accountant',          'token', '{{buyer_cpa_accountant}}'),
          jsonb_build_object('label', 'Reference 1',               'token', '{{buyer_reference_1}}', 'multiline', true),
          jsonb_build_object('label', 'Reference 2',               'token', '{{buyer_reference_2}}', 'multiline', true)
        )
      ),
      jsonb_build_object('number', '9', 'title', 'Attestation',
        'fields', jsonb_build_array(
          jsonb_build_object('label', 'Other Principals / Co-Investors (or type "None" if solo)', 'token', '{{buyer_other_principals}}', 'multiline', true),
          jsonb_build_object('label', 'Final Decision Authority',                                  'token', '{{buyer_final_decision_authority}}',
            'options_hint', '(Self, Spouse + Self, Partnership, Investor Group IC, Other)'),
          jsonb_build_object('label', 'Buyer Acknowledgment',                                      'token', '{{buyer_acknowledgment}}', 'render_as', 'checkbox',
            'acknowledgment_text', 'I acknowledge: information is true and complete; I will treat all Confidential Information as confidential per the Section B NDA; I will not contact seller employees, customers, or landlords without written consent; I authorize CRE Resources to verify information.',
            'required', true),
          jsonb_build_object('label', 'Authorized Signatory (name, role, equity / control %)',     'token', '{{buyer_authorized_signatory}}')
        )
      )
    )
  )
);

-- ----------------------------------------------------------------
-- 3. fields_schema — what the signing page UI iterates to render
--    inputs and validate submission. Includes section_header rows
--    for visual dividers (Phase 7A.4 UI tweak required).
-- ----------------------------------------------------------------

v_fields_schema := $FS$
[
  {"name": "effective_date",       "role": "broker", "type": "date",            "readonly": true, "prefilled": true},
  {"name": "bra_effective_date",   "role": "broker", "type": "date",            "readonly": true, "prefilled": true, "label": "BRA Effective Date"},
  {"name": "broker_company",       "role": "broker", "type": "text",            "readonly": true, "prefilled": true},
  {"name": "broker_name",          "role": "broker", "type": "text",            "readonly": true, "prefilled": true},
  {"name": "broker_title",         "role": "broker", "type": "text",            "readonly": true, "prefilled": true},
  {"name": "broker_email",         "role": "broker", "type": "text",            "readonly": true, "prefilled": true},
  {"name": "broker_phone",         "role": "broker", "type": "text",            "readonly": true, "prefilled": true},
  {"name": "broker_address",       "role": "broker", "type": "text",            "readonly": true, "prefilled": true},
  {"name": "broker_typed_signature","role":"broker","type":"typed_signature",   "required": true, "label": "Buyer's Broker Signature (typed)"},
  {"name": "broker_drawn_signature","role":"broker","type":"drawn_signature",   "required": false,"label": "Buyer's Broker Drawn Signature (optional)"},

  {"name": "section_1_identity",   "role": "buyer",  "type": "section_header",  "label": "1. Buyer Identity"},
  {"name": "buyer_name",                 "role": "buyer", "type": "text",     "label": "Buyer Name (Individual or Entity)", "required": true},
  {"name": "buyer_phone",                "role": "buyer", "type": "tel",      "label": "Phone",                              "required": true},
  {"name": "buyer_email",                "role": "buyer", "type": "email",    "label": "Email",                              "required": true},
  {"name": "buyer_mailing_address",      "role": "buyer", "type": "textarea", "label": "Mailing Address",                    "required": true},
  {"name": "buyer_linkedin_url",         "role": "buyer", "type": "url",      "label": "LinkedIn URL",                       "required": false},
  {"name": "buyer_entity_type",          "role": "buyer", "type": "select",   "label": "Entity Type",
    "options": ["Individual", "LLC", "S-Corp", "C-Corp", "Partnership", "Trust", "To Be Formed at Closing"],
    "required": false},
  {"name": "buyer_state_of_formation",   "role": "buyer", "type": "text",     "label": "State of Formation",                 "required": false},

  {"name": "section_2_background", "role": "buyer",  "type": "section_header", "label": "2. Background & Experience"},
  {"name": "buyer_professional_background",     "role": "buyer", "type": "textarea", "label": "Professional Background",        "required": false},
  {"name": "buyer_direct_industry_experience",  "role": "buyer", "type": "textarea", "label": "Direct Industry Experience",     "required": false},
  {"name": "buyer_prior_business_ownership",    "role": "buyer", "type": "select",   "label": "Prior Business Ownership", "options": ["Yes", "No"], "required": false},
  {"name": "buyer_prior_business_details",      "role": "buyer", "type": "textarea", "label": "Prior Business Details (if Yes)", "required": false},
  {"name": "buyer_prior_director_experience",   "role": "buyer", "type": "select",   "label": "Prior Director / Manager Experience", "options": ["Yes", "No"], "required": false},
  {"name": "buyer_licenses_certifications",     "role": "buyer", "type": "text",     "label": "Licenses / Certifications",       "required": false},

  {"name": "section_3_acquisition", "role": "buyer", "type": "section_header", "label": "3. Acquisition Criteria"},
  {"name": "buyer_preferred_geography",         "role": "buyer", "type": "text",     "label": "Preferred Geography",                "required": false},
  {"name": "buyer_preferred_industries",        "role": "buyer", "type": "text",     "label": "Preferred Industries / Concepts",    "required": false},
  {"name": "buyer_deal_structures_considered",  "role": "buyer", "type": "multi_select", "label": "Deal Structures Considered",
    "options": ["Asset Sale", "Stock Sale", "Seller Financing", "SBA", "Earn-out", "Other"], "required": false},
  {"name": "buyer_real_estate_preference",      "role": "buyer", "type": "multi_select", "label": "Real Estate Preference",
    "options": ["Lease only", "Real estate included", "Either", "Land + build"], "required": false},
  {"name": "buyer_target_asking_price_range",   "role": "buyer", "type": "text",     "label": "Target Asking Price Range",          "required": false},
  {"name": "buyer_target_revenue_range",        "role": "buyer", "type": "text",     "label": "Target Revenue Range",               "required": false},
  {"name": "buyer_target_sde_range",            "role": "buyer", "type": "text",     "label": "Target SDE / Cash Flow Range",       "required": false},
  {"name": "buyer_hold_period_intent",          "role": "buyer", "type": "select",   "label": "Hold Period Intent",
    "options": ["Long-term operator (10+ yrs)", "5-10 yrs", "3-5 yrs", "Flip / Short", "TBD"], "required": false},

  {"name": "section_4_capital",   "role": "buyer",  "type": "section_header", "label": "4. Capital Capacity"},
  {"name": "buyer_max_deal_size",               "role": "buyer", "type": "text",     "label": "Maximum All-In Deal Size",           "required": false},
  {"name": "buyer_cash_for_down_payment",       "role": "buyer", "type": "currency", "label": "Cash Available for Down Payment",    "required": false},
  {"name": "buyer_total_equity_available",      "role": "buyer", "type": "currency", "label": "Total Equity Available",             "required": false},
  {"name": "buyer_primary_financing_source_multi", "role": "buyer", "type": "multi_select", "label": "Primary Financing Source",
    "options": ["All-cash", "SBA 7(a)", "SBA 504", "Conventional Bank", "Seller Financing", "Investor Group", "Combination"], "required": false},
  {"name": "buyer_outside_investors",           "role": "buyer", "type": "select",   "label": "Outside Investors",
    "options": ["Yes", "No"], "required": false},
  {"name": "buyer_investor_structure",          "role": "buyer", "type": "textarea", "label": "Investor Structure (if Outside Investors = Yes)", "required": false},

  {"name": "section_5_interest",  "role": "buyer",  "type": "section_header", "label": "5. Specific Interest"},
  {"name": "buyer_listing_reference",           "role": "buyer", "type": "text",     "label": "Listing Reference (if any specific business is currently of interest)", "required": false},
  {"name": "buyer_why_this_listing",            "role": "buyer", "type": "textarea", "label": "Why This Listing / Acquisition Criteria Rationale", "required": false},
  {"name": "buyer_indicative_offer_range",      "role": "buyer", "type": "text",     "label": "Indicative Offer Range",             "required": false},
  {"name": "buyer_operating_role_post_close",   "role": "buyer", "type": "select",   "label": "Operating Role Post-Close",
    "options": ["Owner-Operator (full-time)", "Working Owner (part-time)", "Absentee with Director on site"], "required": false},

  {"name": "section_6_timeline",  "role": "buyer",  "type": "section_header", "label": "6. Process & Timeline"},
  {"name": "buyer_earliest_nda_execution",      "role": "buyer", "type": "select",   "label": "Earliest NDA Execution",
    "options": ["Today", "1-3 days", "1 week", "2 weeks"], "required": false},
  {"name": "buyer_earliest_pof_delivery",       "role": "buyer", "type": "select",   "label": "Earliest POF Delivery After NDA",
    "options": ["Same day", "24-48 hrs", "1 week", "2 weeks"], "required": false},
  {"name": "buyer_earliest_loi_submission",     "role": "buyer", "type": "text",     "label": "Earliest LOI Submission",            "required": false},
  {"name": "buyer_earliest_possible_close",     "role": "buyer", "type": "text",     "label": "Earliest Possible Close",            "required": false},
  {"name": "buyer_other_active_diligence",      "role": "buyer", "type": "textarea", "label": "Other Deals in Active Diligence",    "required": false},
  {"name": "buyer_funding_contingencies",       "role": "buyer", "type": "textarea", "label": "Funding Contingencies",              "required": false},

  {"name": "section_7_pof",       "role": "buyer",  "type": "section_header", "label": "7. Proof of Funds"},
  {"name": "buyer_pof_methods",                 "role": "buyer", "type": "multi_select", "label": "POF Methods",
    "options": ["Bank / brokerage statements (redacted to balance)", "Lender pre-qualification letter", "CPA / attorney attestation letter", "Buyer Broker (Mark Mueller) attestation", "Combination", "Other"],
    "required": false},
  {"name": "buyer_pof_method_notes",            "role": "buyer", "type": "textarea", "label": "POF Method Notes",                   "required": false},
  {"name": "buyer_lender_name_contact",         "role": "buyer", "type": "text",     "label": "Lender Name / Contact",              "required": false},
  {"name": "buyer_lender_loan_officer",         "role": "buyer", "type": "text",     "label": "Lender / Loan Officer",              "required": false},
  {"name": "buyer_lender_prequal_status",       "role": "buyer", "type": "select",   "label": "Lender Pre-Qualification Status",
    "options": ["Pre-qualified", "Pre-approved", "In process", "Not yet engaged"], "required": false},

  {"name": "section_8_advisors",  "role": "buyer",  "type": "section_header", "label": "8. Professional Advisors"},
  {"name": "buyer_buyer_broker",                "role": "buyer", "type": "text",     "label": "Buyer Broker (default: Mark Mueller, CRE Resources, LLC)", "required": false},
  {"name": "buyer_side_attorney",               "role": "buyer", "type": "text",     "label": "Buyer Side Attorney",                "required": false},
  {"name": "buyer_cpa_accountant",              "role": "buyer", "type": "text",     "label": "CPA / Accountant",                   "required": false},
  {"name": "buyer_reference_1",                 "role": "buyer", "type": "textarea", "label": "Reference 1 (name, relationship, phone/email)", "required": false},
  {"name": "buyer_reference_2",                 "role": "buyer", "type": "textarea", "label": "Reference 2 (name, relationship, phone/email)", "required": false},

  {"name": "section_9_attestation", "role": "buyer", "type": "section_header", "label": "9. Attestation"},
  {"name": "buyer_other_principals",            "role": "buyer", "type": "textarea", "label": "Other Principals / Co-Investors (or type 'None' if solo)", "required": false},
  {"name": "buyer_final_decision_authority",    "role": "buyer", "type": "select",   "label": "Final Decision Authority",
    "options": ["Self", "Spouse + Self", "Partnership", "Investor Group IC", "Other"], "required": false},
  {"name": "buyer_acknowledgment",              "role": "buyer", "type": "checkbox", "label": "I acknowledge: information is true and complete; I will treat all Confidential Information as confidential per the Section B NDA; I will not contact seller employees, customers, or landlords without written consent; I authorize CRE Resources to verify information.", "required": true},
  {"name": "buyer_authorized_signatory",        "role": "buyer", "type": "text",     "label": "Authorized Signatory (name, role, and equity / control %)", "required": false},
  {"name": "buyer_typed_signature",             "role": "buyer", "type": "typed_signature", "label": "Buyer Client Signature (Typed Full Legal Name)", "required": true},
  {"name": "buyer_drawn_signature",             "role": "buyer", "type": "drawn_signature", "label": "Drawn Signature (optional)", "required": false}
]
$FS$::jsonb;

-- ----------------------------------------------------------------
-- 4. Compute SHA-256 of source canonical form (append -v1 suffix
--    to match existing convention from NDA_BuyerProfile v2)
-- ----------------------------------------------------------------

v_source_sha256 := encode(digest(v_source::text, 'sha256'), 'hex') || '-v1';

-- ----------------------------------------------------------------
-- 5. Insert disclosure version
-- ----------------------------------------------------------------

INSERT INTO sign_disclosure_versions (
  version_label,
  disclosure_text,
  text_sha256,
  active
) VALUES (
  'BuyerBrokerRep_NDA v1.3 (2026-05-24) — pure 3-way confidentiality, no commission terms',
  v_disclosure_text,
  encode(digest(v_disclosure_text, 'sha256'), 'hex'),
  true
) RETURNING id INTO v_disclosure_id;

-- ----------------------------------------------------------------
-- 6. Insert template
-- ----------------------------------------------------------------

INSERT INTO sign_templates (
  template_key,
  version,
  display_name,
  source,
  source_sha256,
  disclosure_version_id,
  fields_schema,
  active
) VALUES (
  'BuyerBrokerRep_NDA',
  1,
  'Buyer Profile & Pre-Signed NDA (Buyer-Broker Representation) v1',
  v_source,
  v_source_sha256,
  v_disclosure_id,
  v_fields_schema,
  true
) RETURNING id INTO v_template_id;

RAISE NOTICE 'Seeded BuyerBrokerRep_NDA v1: template_id=%, disclosure_id=%, source_sha256=%',
  v_template_id, v_disclosure_id, v_source_sha256;

END $migration$;

-- Verify
SELECT t.template_key, t.version, t.active, t.source_sha256, d.version_label, d.text_sha256
FROM sign_templates t
JOIN sign_disclosure_versions d ON d.id = t.disclosure_version_id
WHERE t.template_key = 'BuyerBrokerRep_NDA';
