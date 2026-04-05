import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveModel, MODELS } from './modelRouter'

describe('modelRouter — resolveModel()', () => {
  // 1. Hard gate: val.synthesize always Opus
  describe('hard gates', () => {
    it('val.synthesize returns Opus for premium license', () => {
      const r = resolveModel({ task: 'val.synthesize', license: 'premium' })
      assert.equal(r.model, MODELS.T1)
      assert.equal(r.tier, 'T1')
    })

    it('val.synthesize returns Opus for standard license', () => {
      const r = resolveModel({ task: 'val.synthesize', license: 'standard' })
      assert.equal(r.model, MODELS.T1)
      assert.equal(r.tier, 'T1')
    })

    it('deal.strategy returns Opus regardless of license', () => {
      const r = resolveModel({ task: 'deal.strategy', license: 'standard' })
      assert.equal(r.tier, 'T1')
    })
  })

  // 2. doc.draft returns Sonnet for both license levels
  describe('doc.draft routing', () => {
    it('returns Sonnet for premium', () => {
      const r = resolveModel({ task: 'doc.draft', license: 'premium' })
      assert.equal(r.model, MODELS.T2)
      assert.equal(r.tier, 'T2')
    })

    it('returns Sonnet for standard', () => {
      const r = resolveModel({ task: 'doc.draft', license: 'standard' })
      assert.equal(r.model, MODELS.T2)
      assert.equal(r.tier, 'T2')
    })
  })

  // 3. lead.ingest always Haiku
  describe('lead.ingest routing', () => {
    it('returns Haiku for premium', () => {
      const r = resolveModel({ task: 'lead.ingest', license: 'premium' })
      assert.equal(r.model, MODELS.T3)
      assert.equal(r.tier, 'T3')
    })

    it('returns Haiku for standard', () => {
      const r = resolveModel({ task: 'lead.ingest', license: 'standard' })
      assert.equal(r.model, MODELS.T3)
      assert.equal(r.tier, 'T3')
    })
  })

  // 4. legalRisk: true always Opus
  describe('legalRisk flag', () => {
    it('upgrades a T3 task to Opus when legalRisk is true', () => {
      const r = resolveModel({ task: 'util.proofread', license: 'standard', legalRisk: true })
      assert.equal(r.model, MODELS.T1)
      assert.equal(r.tier, 'T1')
      assert.match(r.reason, /Legal risk/)
    })

    it('upgrades a T2 task to Opus when legalRisk is true', () => {
      const r = resolveModel({ task: 'doc.draft', license: 'standard', legalRisk: true })
      assert.equal(r.tier, 'T1')
    })
  })

  // 5. Large deal upgrade: standard license + $2M+ upgrades non-hard-gated T1 tasks
  describe('large deal upgrade ($2M threshold)', () => {
    it('does not upgrade T2 tasks (no base T1 to upgrade)', () => {
      const r = resolveModel({ task: 'doc.draft', license: 'standard', dealSizeUsd: 3_000_000 })
      assert.equal(r.tier, 'T2')
    })

    it('does not upgrade T3 tasks', () => {
      const r = resolveModel({ task: 'lead.ingest', license: 'standard', dealSizeUsd: 5_000_000 })
      assert.equal(r.tier, 'T3')
    })

    it('hard gates still return Opus (not affected by deal size logic)', () => {
      const r = resolveModel({ task: 'val.synthesize', license: 'standard', dealSizeUsd: 500_000 })
      assert.equal(r.tier, 'T1')
    })

    it('does not upgrade when deal size is below $2M', () => {
      const r = resolveModel({ task: 'deal.documentLegal', license: 'standard', dealSizeUsd: 1_500_000 })
      // deal.documentLegal is a hard gate → still T1 via hard gate path
      assert.equal(r.tier, 'T1')
    })

    it('premium license does not need the upgrade path', () => {
      const r = resolveModel({ task: 'deal.documentLegal', license: 'premium', dealSizeUsd: 3_000_000 })
      assert.equal(r.tier, 'T1')
    })
  })

  // 6. forceTier overrides everything
  describe('forceTier override', () => {
    it('forces T3 on a hard-gated T1 task', () => {
      const r = resolveModel({ task: 'val.synthesize', license: 'premium', forceTier: 'T3' })
      assert.equal(r.model, MODELS.T3)
      assert.equal(r.tier, 'T3')
      assert.match(r.reason, /Forced/)
    })

    it('forces T1 on a T3 task', () => {
      const r = resolveModel({ task: 'lead.ingest', license: 'standard', forceTier: 'T1' })
      assert.equal(r.model, MODELS.T1)
      assert.equal(r.tier, 'T1')
    })

    it('forceTier takes precedence over legalRisk', () => {
      const r = resolveModel({ task: 'util.classify', license: 'standard', legalRisk: true, forceTier: 'T3' })
      assert.equal(r.tier, 'T3')
    })
  })
})
