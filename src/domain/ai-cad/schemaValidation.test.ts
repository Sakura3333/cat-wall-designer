import { describe, expect, it } from 'vitest'
import observationFixture from '../../../fixtures/ai-cad/golden/space-capsule-30/vision-observation.json'
import {
  assessComponentSpecReadiness,
  assessModelingPlanSemantics,
  validateComponentSpec,
  validateModelingPlan,
  validateQualityReport,
  validateVisionObservation,
} from './schemaValidation'
import type { ComponentSpecV1, ModelingPlanV1, QualityReportV1 } from './types'

describe('AI CAD v1 schema validation', () => {
  it('accepts the space capsule observation without inventing missing dimensions', () => {
    const result = validateVisionObservation(observationFixture)

    expect(result.success).toBe(true)
    expect(observationFixture.dimensionEvidence.map((item) => item.valueMm)).toEqual([400, 200, 300])
    expect(observationFixture.ambiguities.filter((item) => item.severity === 'blocking')).toHaveLength(4)
  })

  it('rejects unknown fields in model output', () => {
    const result = validateVisionObservation({
      ...observationFixture,
      python: 'import os',
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.errors.some((error) => error.keyword === 'additionalProperties')).toBe(true)
  })

  it('accepts a confirmed component spec and reports it ready', () => {
    const spec = confirmedSpec()

    expect(validateComponentSpec(spec).success).toBe(true)
    expect(assessComponentSpecReadiness(spec)).toEqual([])
  })

  it('blocks unconfirmed hard parts, holes, and assumptions', () => {
    const spec = confirmedSpec()
    spec.parts[0].sizeStatus = 'proposed'
    spec.holes[0].status = 'proposed'
    spec.assumptions.push({ field: 'overallSizeMm.z', reason: '整体深度未知。', severity: 'blocking' })

    expect(assessComponentSpecReadiness(spec).map((issue) => issue.code)).toEqual([
      'UNCONFIRMED_HARD_PART',
      'UNCONFIRMED_HOLE',
      'BLOCKING_ASSUMPTION',
    ])
  })

  it('accepts only the phase zero box and mounting-hole plan operations', () => {
    const spec = confirmedSpec()
    const plan = phaseZeroPlan()

    expect(validateModelingPlan(plan).success).toBe(true)
    expect(assessModelingPlanSemantics(plan, spec)).toEqual([])
    expect(validateModelingPlan({ ...plan, nodes: [{ id: 'script', op: 'python', source: 'import os' }] }).success).toBe(false)
  })

  it('blocks a plan that changes confirmed construction-hole values', () => {
    const plan = phaseZeroPlan()
    const hole = plan.nodes[1]
    if (hole.op !== 'mounting-hole') throw new Error('Expected mounting-hole fixture node.')
    hole.diameterMm = 10
    hole.centerMm.x = -140
    hole.axis = '-Z'

    expect(assessModelingPlanSemantics(plan, confirmedSpec()).map((issue) => issue.code)).toEqual([
      'HOLE_DIAMETER_MISMATCH',
      'HOLE_CENTER_MISMATCH',
      'HOLE_AXIS_MISMATCH',
    ])
  })

  it('validates the quality report contract', () => {
    const report: QualityReportV1 = {
      schemaVersion: 1,
      jobId: 'fixture-panel',
      componentSpecRevision: 1,
      planHash: 'a'.repeat(64),
      compilerVersion: '0.1.0',
      blenderVersion: '4.5.11 LTS',
      status: 'passed',
      hardConstraintToleranceMm: 1,
      checks: [
        {
          id: 'overall-width',
          kind: 'overall-size',
          status: 'passed',
          expectedMm: 400,
          actualMm: 400,
          deltaMm: 0,
          message: '整体宽度符合确认值。',
        },
      ],
      artifacts: [
        {
          kind: 'glb',
          fileName: 'fixture-panel.glb',
          sha256: 'b'.repeat(64),
          sizeBytes: 1024,
        },
      ],
    }

    expect(validateQualityReport(report).success).toBe(true)
    expect(validateQualityReport({ ...report, status: 'unknown' }).success).toBe(false)
  })
})

function confirmedSpec(): ComponentSpecV1 {
  return {
    schemaVersion: 1,
    revision: 1,
    unit: 'mm',
    name: '测试板件',
    family: 'single-panel',
    placement: 'wall',
    overallSizeMm: { x: 400, y: 200, z: 18 },
    parts: [
      {
        id: 'main-panel',
        label: '主板',
        shape: 'rect-panel',
        sizeMm: { x: 400, y: 200, z: 18 },
        sizeStatus: 'confirmed',
        hardConstraint: true,
        materialRole: 'wood-primary',
      },
    ],
    holes: [
      {
        id: 'mount-hole-left',
        partId: 'main-panel',
        centerMm: { x: -150, y: 60, z: 0 },
        axis: { x: 0, y: 0, z: 1 },
        diameterMm: 8,
        through: true,
        source: 'user',
        status: 'confirmed',
      },
    ],
    assumptions: [],
  }
}

function phaseZeroPlan(): ModelingPlanV1 {
  return {
    schemaVersion: 1,
    componentSpecRevision: 1,
    coordinateSystem: { handedness: 'right', up: '+Y', front: '+Z', unit: 'mm' },
    nodes: [
      {
        id: 'main-panel-solid',
        op: 'box',
        partId: 'main-panel',
        sizeMm: { x: 400, y: 200, z: 18 },
        transform: {
          positionMm: { x: 0, y: 0, z: 0 },
          rotationDeg: { x: 0, y: 0, z: 0 },
        },
        materialRole: 'wood-primary',
      },
      {
        id: 'mount-hole-left-op',
        op: 'mounting-hole',
        holeId: 'mount-hole-left',
        targetNodeId: 'main-panel-solid',
        diameterMm: 8,
        centerMm: { x: -150, y: 60, z: 0 },
        axis: '+Z',
        through: true,
      },
    ],
    export: {
      primary: 'glb',
      optional: ['blend'],
      originPolicy: 'bounding-box-center',
      applyTransforms: true,
    },
  }
}
