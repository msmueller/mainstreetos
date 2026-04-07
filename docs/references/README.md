# Valuation Methodology References

This directory holds copyrighted third-party reference materials used internally
to inform the design of MainStreetOS's valuation pipeline (Agents 2–4, the CSRP
risk model, and the five valuation methods).

**The PDF files themselves are not committed to git** (see `.gitignore`). Only
this index is tracked. To populate the directory locally, drop the files listed
below into `docs/references/` using the exact filenames shown.

## Index

### 1. ValuAdder Business Valuation eBook (15th Edition)
- **File:** `ValuAdder_Business_Valuation_eBook__Fifteenth_Edition.pdf`
- **Author / Publisher:** ValuAdder (Haliday Group / David Bates)
- **Covers:** Practitioner-oriented walkthrough of the three approaches (asset,
  market, income), SDE vs. EBITDA selection, market multiple sourcing, build-up
  method for cap/discount rates, and reconciliation. Used as a baseline reference
  for Agent 3's method implementations and the methods detail pages.

### 2. Standard Approach to Business Valuations
- **File:** `Standard Approach to Business Valuations.pdf`
- **Author:** Michael J. Schill, UVA Darden School of Business
- **Covers:** Academic framing of the standard valuation process — DCF mechanics,
  terminal value methodology, comparables selection, discount rate derivation,
  and the role of assumptions in defensibility. Used as a theoretical anchor for
  the DCF method page and the USPAP Standards content.

### 3. Preparing Your Business for Valuation (NEJE, 2005)
- **File:** `neje-08-01-2005-b006.pdf`
- **Authors:** Nowicki, Lewis, and Lippitt
- **Publication:** New England Journal of Entrepreneurship, Vol. 8, No. 1, 2005
- **Covers:** Pre-valuation preparation — financial statement normalization,
  add-back identification, owner-compensation adjustments, and the impact of
  recordkeeping quality on defensible valuations. Informs Agent 2's normalization
  logic and the recast P&L workflow.

### 4. A Complete Guide to Seller's Discretionary Earnings (SDE)
- **File:** `A Complete Guide to Seller's Discretionary Earnings (SDE).pdf`
- **Covers:** Definition of SDE, the standard add-back categories (owner comp,
  benefits, D&A, interest, non-recurring items, above-market rent), and how SDE
  differs from EBITDA. Used as the canonical reference for Agent 2's SDE
  add-back schedule and the SDE-vs-EBITDA selection logic.

## Usage notes

These materials are for internal reference only. Do not redistribute, embed
verbatim text in product copy, or check the PDFs into version control. When
incorporating ideas from these sources into product content (method pages,
USPAP standards page, etc.), paraphrase and cite the source by name.
