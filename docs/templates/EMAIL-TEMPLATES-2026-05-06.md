# Buyer Email Templates — Authored 2026-05-06 (v2)

**Source:** Mark Mueller (uploaded markdown, revised v2).
**Seeded into Supabase:** Email #1, #2, #3, #4, #5 — all live.
**Revision history:** v1 (initial) seeded #1–4; v2 (later same day) revised #4 subject/body and replaced placeholder #5 with distinct LOI-receipt content.
**Subject template (all five share this canonical subject):**

```
Response to your Inquiry on BizBuySell - Listing # {{listing_number}}, {{listing_title}}
```

For Email #2 onward the GmailSender automatically prepends `Re: ` because they're sent within the existing thread.

---

## Email #1 — Lead Inquiry (initial response)

**Template ID:** `tpl_bbs_initial_generic`
**Category:** `initial_response`
**Trigger:** New inquiry receipt (auto-fire on lead creation, no prior pipeline state).
**Pipeline transition:** advances Pipeline Stage to "2. Initial Response Sent".
**Notion date stamped:** `LEAD Email #1`.

```
Hello {{buyer_first_name}},

Thank you for your inquiry regarding this listing. I am the Business Broker and Intermediary for the {{listing_name}} business sale and represent the Owner/Seller on this transaction.

I'm here to assist you in obtaining additional financial, operational and valuation information about this business so that you can make an informed decision about making an offer and purchasing the business.

Business Documents now available — Offering Memorandum (OM): {{om_link}}

Once you have completed the Non-Disclosure Agreement (NDA): {{nda_link}}, and Business Buyer Questionnaire (BBQ): {{buyer_profile_link}} I can give you access to the following:

- Confidential Information Memorandum (CIM) which provides a detailed overview of the key financials and business performance.
- Business Valuation Report (BVR) which lays out the valuation methodology, comparable transactions, and the analysis behind the asking price of {{asking_price}}.

Once you are ready, let's get on the phone and I can walk you through the business offering, provide you some background on the business operations, and discuss your acquisition approach. Once you've qualified as a capable buyer I'll send you the Deal Workbook for you to start framing your offer via a Letter of Intent.

Our entire Business Buyer Acquisition Process {{buyer_acquisition_process}} is described here.

I'm available {{available_slots}} this week for a 30-minute introductory call. I can also schedule a business visit/tour once you've completed the NDA and Buyer Profile.

Best,
{{broker_name}}
Managing Member & Managing Broker
{{broker_firm}}
{{broker_phone}} | {{broker_email}}
```

---

## Email #2 — NDA Received

**Template ID:** `tpl_nda_received_generic`
**Category:** `nda_received`
**Trigger:** `Completed NDA = ✓` on the LEADS row (or BBS NDA-signed email), Pipeline Stage at 1 or 2.
**Pipeline transition:** advances Pipeline Stage to "3. NDA Executed".
**Notion date stamped:** `PROSP Email #2`.
**Threaded under:** Email #1's Gmail conversation.

```
Hello {{buyer_first_name}},

Thank you for your inquiry regarding this listing. I am the Business Broker and Intermediary for the {{listing_name}} business sale and represent the Owner/Seller on this transaction. I'm here to assist you in obtaining additional financial, operational and valuation information about this business so that you can make an informed decision about making an offer and purchasing the business.

I am in receipt of your signed Non-Disclosure Agreement (NDA) and making the following available to you:

Business Documents now available — Offering Memorandum (OM): {{om_link}}

- Confidential Information Memorandum (CIM) {{cim_link}} which provides a detailed overview of the key financials and business performance.

Once you have completed the Business Buyer Questionnaire (BBQ) {{buyer_profile_link}} I can give you access to the following:

- Business Valuation Report (BVR) which lays out the valuation methodology, comparable transactions, and the analysis behind the asking price of {{asking_price}}.

Once you are ready, let's get on the phone and I can walk you through the OM, give you the background on the business and discuss your acquisition approach. Once you've qualified as a capable buyer I will send you the Deal Workbook for you to start reviewing the business proforma, framing your offer via a Letter of Intent.

Our entire Business Buyer Acquisition Process {{buyer_acquisition_process}} is described here.

I'm available {{available_slots}} this week for a 30-minute introductory call. I can also schedule a business visit/tour once you've completed the NDA and Buyer Profile.

Best,
{{broker_name}}
Managing Member & Managing Broker
{{broker_firm}}
{{broker_phone}} | {{broker_email}}
```

---

## Email #3 — Buyer Profile Received

**Template ID:** `tpl_buyer_profile_received_generic`
**Category:** `buyer_profile_received`
**Trigger:** `Completed NDA = ✓ AND Completed Buyer Profile = ✓`.
**Pipeline transition:** advances Pipeline Stage to "4. Buyer Profile Received".
**Notion date stamped:** `PROSP Email #3`.
**Threaded under:** Email #1's Gmail conversation.

```
Hello {{buyer_first_name}},

Thank you for your inquiry regarding this listing. I am the Business Broker and Intermediary for the {{listing_name}} business sale and represent the Owner/Seller on this transaction. I'm here to assist you in obtaining additional financial, operational and valuation information about this business so that you can make an informed decision about making an offer and purchasing the business.

I am in receipt of your signed Non-Disclosure Agreement (NDA) and Business Buyer Profile Questionnaire and making the following available to you:

- Offering Memorandum (OM): {{om_link}}
- Confidential Information Memorandum (CIM) {{cim_link}} which provides a detailed overview of the key financials and business performance.
- Business Valuation Report (BVR) {{bvr_link}} which lays out the valuation methodology, comparable transactions, and the analysis behind the asking price of {{asking_price}}.

Once you are ready, let's get on the phone and I can walk you through the CIM and the BVR, answer anything that came up reading those documents, and discuss your acquisition approach. Once we've qualified you as a capable buyer I will send you the Deal Workbook for you to start reviewing the proforma, framing your offer and preparing a Letter of Intent.

Our entire Business Buyer Acquisition Process {{buyer_acquisition_process}} is described here.

I'm available {{available_slots}} this week for a 30-minute discussion call. I can also schedule a business visit/tour/owner meeting once you are ready to discuss a business deal.

Best,
{{broker_name}}
Managing Member & Managing Broker
{{broker_firm}}
{{broker_phone}} | {{broker_email}}
```

---

## Email #4 — Qualified Buyer (v2)

**Template ID:** `tpl_qualified_generic`
**Category:** `qualified`
**Trigger:** Manual phone qualification — broker presses a "Mark Qualified" button or calls `/api/router/advance` with `category: "qualified"`.
**Pipeline transition:** advances Pipeline Stage to "5. Qualified Buyer".
**Notion date stamped:** `QUALIF Email #4`.
**Threaded under:** Email #1's Gmail conversation.
**v2 changes:** new subject ("Additional Information and Instructions regarding the business sale of {{listing_name}}"), added "access the" before Deal Workbook, added "to submit to the Seller." after LOI mention, added closing contact-anytime sentence.

```
SUBJECT: Additional Information and Instructions regarding the business sale of {{listing_name}}

Hello {{buyer_first_name}},

Thank you for your inquiry regarding this listing. I am the Business Broker and Intermediary for the {{listing_name}} business sale and represent the Owner/Seller on this transaction. I'm here to assist you in obtaining additional financial, operational and valuation information about this business so that you can make an informed decision about making an offer and purchasing the business.

The following documents are now available to you:

- Offering Memorandum (OM): {{om_link}}
- Confidential Information Memorandum (CIM) {{cim_link}} which provides a detailed overview of the key financials and business performance.
- Business Valuation Report (BVR) {{bvr_link}} which lays out the valuation methodology, comparable transactions, and the analysis behind the asking price of {{asking_price}}.

We have recognized you as a Qualified and Capable buyer and will be sending you an invitation to access the Deal Workbook {{workbook_link}} for this business so that you can review the full historical financials, prepare a proforma, frame your offer and prepare a Letter of Intent {{loi_link}} to submit to the Seller.

Our entire Business Buyer Acquisition Process {{buyer_acquisition_process}} is described here.

I'm available {{available_slots}} this week for a 30-minute discussion call. I can also schedule a business visit & tour and owner meeting once you are ready to discuss a business deal. Please feel free to contact me at anytime with questions about your pending acquisition deal.

Best,
{{broker_name}}
Managing Member & Managing Broker
{{broker_firm}}
{{broker_phone}} | {{broker_email}}
```

---

## Email #5 — LOI Received (v2)

**Template ID:** `tpl_loi_received_generic`
**Category:** `loi_received`
**Trigger:** `Completed LOI = ✓` on the LEADS row. Pipeline Stage at "5. Qualified Buyer".
**Pipeline transition:** advances Pipeline Stage to "6. LOI / IOI".
**Notion date stamped:** `PROPSL Email #5`.
**Threaded under:** Email #1's Gmail conversation.
**Notes:** introduces the negotiation phase, gates Disclosure Portal + Data Room access behind Proof of Funds, references Business Asset Purchase Agreement and Due Diligence as next milestones.

```
SUBJECT: Additional Information and Instructions Regarding the Business Sale - of {{listing_name}}

Hello {{buyer_first_name}},

Thank you for your continuing interest in this business sale. I'm here to assist you in making an Offer to Purchase this business and to provide you with all of the documents and guidance you will need as you prepare to negotiate the Business Asset Purchase Agreement and begin your Due Diligence period.

The following documents and portals are now available to you:

- Offering Memorandum (OM): {{om_link}}
- Confidential Information Memorandum (CIM) {{cim_link}} which provides a detailed overview of the key financials and business performance.
- Business Valuation Report (BVR) {{bvr_link}} which lays out the valuation methodology, comparable transactions, and the analysis behind the asking price of {{asking_price}}.
- Deal Workbook {{workbook_link}} for this business so that you can review the full historical financials, prepare a proforma and frame your offer.
- Letter of Intent {{loi_link}}.

The following additional documents are required in order to gain access to:

- Proof of Funds: When you submit your signed Letter of Intent, you will also need to supply your Proof of Funds (bank loan commitments, cash on hand in bank accounts, partnership funding, private equity funding and other sources of funds to settle on the purchase transaction).
- Once we receive your signed Letter of Intent and Proof of Funds, we will provide you access to the Disclosure Portal and Data Room, so you can inspect and review the actual documents associated with the business.

Our entire Business Buyer Acquisition Process {{buyer_acquisition_process}} is described here.

I'm available {{available_slots}} this week for a 30-minute discussion calls to review your LOI Offer and help you prepare for the Contract Phase of this transaction. I can also schedule additional business visits / document review and owner meetings once we are under a legal purchase contract.

Best,
{{broker_name}}
Managing Member & Managing Broker
{{broker_firm}}
{{broker_phone}} | {{broker_email}}
```
