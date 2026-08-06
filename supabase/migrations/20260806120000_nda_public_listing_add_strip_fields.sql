-- Extend the public NDA listing RPC to expose the new listing-strip display
-- fields (location, listing_brokers) and the canonical listing_number so the
-- public /nda/[slug] page header can render them alongside the existing
-- business_name / listing_title / om_link. Additive + whitelist-only,
-- consistent with the existing SECURITY DEFINER pattern. A return-column
-- change requires DROP + CREATE (Postgres can't CREATE OR REPLACE across a
-- changed RETURNS TABLE signature).

DROP FUNCTION IF EXISTS public.get_public_listing_by_slug(text);

CREATE FUNCTION public.get_public_listing_by_slug(p_slug text)
 RETURNS TABLE(
   business_name text,
   listing_title text,
   om_link text,
   blurb text,
   template_key text,
   location text,
   listing_brokers text,
   listing_number text
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT nda_public_display->>'business_name',
         nda_public_display->>'listing_title',
         nda_public_display->>'om_link',
         nda_public_display->>'blurb',
         default_sign_template_key,
         nda_public_display->>'location',
         nda_public_display->>'listing_brokers',
         listing_number
  FROM public.seller_listings
  WHERE nda_public_slug = p_slug
    AND nda_public_enabled = true;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_listing_by_slug(text) TO anon, authenticated, service_role;
