/**
 * Lead Router — template picker
 *
 * Given a category + optional listing_id + optional industry, picks the
 * best matching `lr_templates` row and returns it together with the step-1
 * sequence_steps content (subject_template, body_template).
 *
 * Picker priority:
 *   1. Per-listing override:  listing_id matches
 *   2. Per-industry:          industry_tags overlaps + listing_id IS NULL
 *   3. Generic fallback:      listing_type='any' + listing_id IS NULL + industry_tags='{}'
 */

import { getRouterSupabase } from './supabase';
import type { Template, TemplateCategory } from './types';

export interface PickedTemplate {
  template: Template;
  subject_template: string;
  body_template: string;
}

export async function pickTemplate(opts: {
  category: TemplateCategory;
  listing_id?: string | null;
  industry?: string | null;
}): Promise<PickedTemplate> {
  const supabase = getRouterSupabase();

  // 1. Per-listing override
  if (opts.listing_id) {
    const { data } = await supabase
      .from('lr_templates')
      .select('*')
      .eq('category', opts.category)
      .eq('listing_id', opts.listing_id)
      .eq('active', true)
      .maybeSingle();
    if (data) {
      const step = await fetchStep1(data.email_sequence_id);
      return { template: data as Template, ...step };
    }
  }

  // 2. Per-industry
  if (opts.industry) {
    const { data } = await supabase
      .from('lr_templates')
      .select('*')
      .eq('category', opts.category)
      .contains('industry_tags', [opts.industry])
      .is('listing_id', null)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    if (data) {
      const step = await fetchStep1(data.email_sequence_id);
      return { template: data as Template, ...step };
    }
  }

  // 3. Generic fallback
  const { data: generic } = await supabase
    .from('lr_templates')
    .select('*')
    .eq('category', opts.category)
    .eq('listing_type', 'any')
    .is('listing_id', null)
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  if (generic) {
    const step = await fetchStep1(generic.email_sequence_id);
    return { template: generic as Template, ...step };
  }

  throw new Error(
    `pickTemplate: no template found for category='${opts.category}' listing_id='${opts.listing_id ?? null}' industry='${opts.industry ?? null}'`
  );
}

async function fetchStep1(
  sequence_id: string
): Promise<{ subject_template: string; body_template: string }> {
  const supabase = getRouterSupabase();
  const { data, error } = await supabase
    .from('sequence_steps')
    .select('subject_template, body_template')
    .eq('sequence_id', sequence_id)
    .eq('step_number', 1)
    .single();
  if (error || !data) {
    throw new Error(`pickTemplate: sequence ${sequence_id} has no step_number=1`);
  }
  return {
    subject_template: data.subject_template,
    body_template: data.body_template,
  };
}
