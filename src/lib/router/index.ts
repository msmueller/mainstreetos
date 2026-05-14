/**
 * Lead Router — public surface
 *
 * Import from `@/lib/router` rather than reaching into individual files.
 * Keeps the lib/router boundary explicit and lets us refactor internals
 * without breaking call sites.
 */

export * from './types';
export { getRouterSupabase } from './supabase';
export {
  getClaudeClient,
  callClaudeJSON,
  cleanJson,
  LR_MODEL,
  LR_MODEL_HAIKU,
} from './claude';
export {
  getNotionClient,
  fetchNotionLead,
  fetchNotionListing,
  updateNotionLead,
} from './notion';
export {
  getRouterOAuth2Client,
  getRouterGmail,
  GmailSender,
  hasReplyAfter,
  pingGmail,
} from './gmail';
export { getRouterCalendar, getAvailableSlots } from './calendar';
export { extractAttributes } from './extractor';
export { matchListing } from './matcher';
export { renderEmail, buildVariables, htmlToText } from './renderer';
export { pickTemplate } from './templates';
export type { PickedTemplate } from './templates';
export { fetchActiveListings, enrichListingFromNotion } from './listings';
export {
  buildLeadContextFromNotion,
  countPreviousInteractions,
} from './leads';
export {
  PIPELINE_STAGES,
  DISPOSITIONS,
  BUYER_QUALITIES,
  PIPELINE_STAGE_LABELS,
  DISPOSITION_LABELS,
  BUYER_QUALITY_LABELS,
  pipelineStageFromNotionLabel,
  dispositionFromNotionLabel,
  buyerQualityFromNotionLabel,
  pipelineStageToNotionLabel,
  dispositionToNotionLabel,
  buyerQualityToNotionLabel,
  deriveBuyerQuality,
  LEGACY_STAGE_PROPOSED_MAPPING,
} from './buyer-axes';
export type { PipelineStage, Disposition, BuyerQuality } from './buyer-axes';
export {
  upsertEmailThread,
  insertEmailMessage,
  persistSentEmail,
} from './email-records';
export type {
  EmailThreadInsert,
  EmailMessageInsert,
} from './email-records';
export { logMatchDecision, supersedePriorEnrollments } from './audit';
export { findEmailThreadForLead } from './threads';
export type { ExistingThread } from './threads';
export {
  readLeadGateState,
  decideNextStep,
  readAndDecide,
} from './advance';
export type {
  LeadGateState,
  AdvanceDecision,
  AdvanceErrorCode,
} from './advance';
