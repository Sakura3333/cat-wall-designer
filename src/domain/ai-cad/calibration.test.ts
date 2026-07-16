import { describe, expect, it } from 'vitest'
import {
  buildComponentSpecFromCalibration,
  createCalibrationHole,
  createSpaceCapsuleCalibrationDraft,
  listCalibrationIssues,
} from './calibration'

describe('space capsule calibration', () => {
  it('starts with only image-evidenced values and explicit blockers', () => {
    const draft = createSpaceCapsuleCalibrationDraft()

    expect(draft.widthMm).toBe(400)
    expect(draft.labeledHeightMm).toBe(200)
    expect(draft.capsuleDiameterMm).toBe(300)
    expect(draft.depthMm).toBeNull()
    expect(listCalibrationIssues(draft).map((item) => item.code)).toContain('DEPTH_MISSING')
    expect(buildComponentSpecFromCalibration(draft).success).toBe(false)
  })

  it('requires explicit approval before using default board thickness', () => {
    const draft = completeDraft()
    draft.defaultThicknessApproved = false

    expect(listCalibrationIssues(draft).map((item) => item.code)).toContain('DEFAULT_THICKNESS_UNAPPROVED')
  })

  it('rejects an overall depth smaller than the confirmed capsule diameter', () => {
    const draft = completeDraft()
    draft.depthMm = 280

    expect(listCalibrationIssues(draft).map((item) => item.code)).toContain('DEPTH_BELOW_CAPSULE_DIAMETER')
  })

  it('builds a confirmed ComponentSpec after every blocker is resolved', () => {
    const result = buildComponentSpecFromCalibration(completeDraft())

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.spec.overallSizeMm).toEqual({ x: 400, y: 360, z: 360 })
    expect(result.spec.parts.find((part) => part.id === 'back-panel')?.sizeMm.z).toBe(18)
    expect(result.spec.parts.find((part) => part.id === 'transparent-capsule')?.sizeMm).toEqual({ x: 300, y: 150, z: 300 })
    expect(result.spec.holes[0]).toMatchObject({ diameterMm: 8, source: 'user', status: 'confirmed' })
    expect(result.spec.assumptions).toHaveLength(4)
  })
})

function completeDraft() {
  const draft = createSpaceCapsuleCalibrationDraft()
  draft.widthConfirmed = true
  draft.labeledHeightConfirmed = true
  draft.heightScope = 'wood-frame'
  draft.overallHeightMm = 360
  draft.depthMm = 360
  draft.capsuleDiameterConfirmed = true
  draft.defaultThicknessApproved = true
  draft.parts = draft.parts.map((part) => {
    if (part.id === 'back-panel') return { ...part, sizeMm: { x: 400, y: 120, z: null } }
    if (part.id === 'platform') return { ...part, sizeMm: { x: 400, y: null, z: 360 } }
    return { ...part, sizeMm: { x: null, y: 160, z: 300 } }
  })
  const hole = createCalibrationHole(1)
  hole.diameterMm = 8
  hole.centerMm = { x: -150, y: 60, z: 0 }
  hole.confirmed = true
  draft.holes = [hole]
  return draft
}
