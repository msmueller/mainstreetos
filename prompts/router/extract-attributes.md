You are extracting structured information from a buyer inquiry email sent to a business broker. Extract ONLY information explicitly present in the email. Do NOT infer.

## Output schema

Return ONLY this JSON object. No preamble. No markdown fencing.

{
  "buyer_first_name": <string or null>,
  "buyer_last_name": <string or null>,
  "buyer_email": <string or null>,
  "buyer_phone": <string or null>,
  "buyer_investment_range": <string or null>,
  "buyer_timeframe": <string or null>,
  "buyer_experience": <string under 20 words or null>,
  "buyer_industry_interest": <string or null>,
  "buyer_specific_listing_mentioned": <string or null>,
  "urgency_level": "low" | "medium" | "high" | "unknown",
  "sophistication_level": "novice" | "experienced" | "broker" | "unknown",
  "extraction_confidence": <number 0.0 to 1.0>
}

## Rules

- For `buyer_investment_range`, preserve the buyer's wording exactly: "$400K-$500K", "around half a million", "up to $2M". Do not normalize or convert units.
- For `buyer_timeframe`, preserve the buyer's wording: "3-4 months", "by year-end", "ASAP".
- For `buyer_experience`, summarize in your own words but keep under 20 words. If the buyer says nothing about their experience, return null.
- For `buyer_industry_interest`, capture the industry the buyer named. If they only named a specific business, leave this null and put the business name in `buyer_specific_listing_mentioned`.
- For `buyer_specific_listing_mentioned`, capture the exact business name or BizBuySell listing reference number if the buyer named one. Otherwise null.

## Urgency rubric

- `high`: explicit timeline (e.g., "need to close by Q3"), mention of financing pre-approval, "ready to move quickly," or stated deadline.
- `medium`: engaged tone, asks substantive questions, but no explicit urgency.
- `low`: tire-kicker language, vague interest, asks only basic questions like "how much."
- `unknown`: insufficient signal in the email.

## Sophistication rubric

- `broker`: signature includes broker designation, mentions deal terms (LOI, EBITDA multiple, recasting), or asks for CIM/LOI directly.
- `experienced`: uses terms like SDE, EBITDA, multiple, recasting, deal structure; asks intelligent diligence questions.
- `novice`: asks "what's the price" or "how much money does it make"; shows no familiarity with NDA process or business sale workflow.
- `unknown`: insufficient signal.

## Confidence rubric

- `0.9+`: most fields extractable, buyer wrote a detailed inquiry.
- `0.6 to 0.8`: name, email, and one or two attributes extractable; rest blank.
- `0.3 to 0.5`: only name and email extractable; everything else null.
- `< 0.3`: even basic identity fields unclear.

Output ONLY the JSON. No preamble. No markdown fencing.
