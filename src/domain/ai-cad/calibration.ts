import type { ComponentSpecV1 } from './types'

export type NullableNumber = number | null
export type HeightScope = 'wood-frame' | 'overall' | null
export type CalibrationAxis = 'x' | 'y' | 'z'
export type HoleAxis = '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z'

export type CalibrationPartDraft = {
  id: string
  label: string
  shape: 'rect-panel'
  sizeMm: Record<CalibrationAxis, NullableNumber>
  thicknessAxis: CalibrationAxis
  materialRole: string
}

export type CalibrationHoleDraft = {
  id: string
  partId: string
  diameterMm: NullableNumber
  centerMm: Record<CalibrationAxis, NullableNumber>
  axis: HoleAxis
  confirmed: boolean
}

export type SpaceCapsuleCalibrationDraft = {
  widthMm: number
  widthConfirmed: boolean
  labeledHeightMm: number
  labeledHeightConfirmed: boolean
  heightScope: HeightScope
  overallHeightMm: NullableNumber
  depthMm: NullableNumber
  capsuleDiameterMm: number
  capsuleDiameterConfirmed: boolean
  defaultThicknessMm: number
  defaultThicknessApproved: boolean
  parts: CalibrationPartDraft[]
  holes: CalibrationHoleDraft[]
}

export type CalibrationIssue = {
  code:
    | 'WIDTH_UNCONFIRMED'
    | 'HEIGHT_UNCONFIRMED'
    | 'HEIGHT_SCOPE_MISSING'
    | 'OVERALL_HEIGHT_MISSING'
    | 'DEPTH_MISSING'
    | 'DEPTH_BELOW_CAPSULE_DIAMETER'
    | 'CAPSULE_DIAMETER_UNCONFIRMED'
    | 'DEFAULT_THICKNESS_INVALID'
    | 'DEFAULT_THICKNESS_UNAPPROVED'
    | 'PART_DIMENSION_MISSING'
    | 'MOUNTING_HOLES_MISSING'
    | 'HOLE_PART_INVALID'
    | 'HOLE_DIAMETER_MISSING'
    | 'HOLE_CENTER_MISSING'
    | 'HOLE_UNCONFIRMED'
  field: string
  message: string
}

export const calibrationStorageKey = 'psd3-ai-cad-calibration:space-capsule-30:v1'

export function createSpaceCapsuleCalibrationDraft(): SpaceCapsuleCalibrationDraft {
  return {
    widthMm: 400,
    widthConfirmed: false,
    labeledHeightMm: 200,
    labeledHeightConfirmed: false,
    heightScope: null,
    overallHeightMm: null,
    depthMm: null,
    capsuleDiameterMm: 300,
    capsuleDiameterConfirmed: false,
    defaultThicknessMm: 18,
    defaultThicknessApproved: false,
    parts: [
      createPart('back-panel', '墙面背板', 'z', { x: 400, y: null, z: null }),
      createPart('platform', '水平承托板', 'y', { x: 400, y: null, z: null }),
      createPart('left-support', '左侧支撑板', 'x', { x: null, y: null, z: null }),
      createPart('right-support', '右侧支撑板', 'x', { x: null, y: null, z: null }),
    ],
    holes: [],
  }
}

export function listCalibrationIssues(draft: SpaceCapsuleCalibrationDraft): CalibrationIssue[] {
  const issues: CalibrationIssue[] = []
  if (!draft.widthConfirmed) issues.push(issue('WIDTH_UNCONFIRMED', 'widthConfirmed', '确认商品图中的 400 mm 宽度。'))
  if (!draft.labeledHeightConfirmed) issues.push(issue('HEIGHT_UNCONFIRMED', 'labeledHeightConfirmed', '确认商品图中的 200 mm 高度标注。'))
  if (!draft.heightScope) issues.push(issue('HEIGHT_SCOPE_MISSING', 'heightScope', '选择 200 mm 标注对应木质框架还是完整组件。'))
  if (draft.heightScope === 'wood-frame' && !isPositive(draft.overallHeightMm)) {
    issues.push(issue('OVERALL_HEIGHT_MISSING', 'overallHeightMm', '输入包含透明舱体的完整组件高度。'))
  }
  if (!isPositive(draft.depthMm)) {
    issues.push(issue('DEPTH_MISSING', 'depthMm', '输入组件前后方向的整体深度。'))
  } else if (draft.depthMm < draft.capsuleDiameterMm) {
    issues.push(issue('DEPTH_BELOW_CAPSULE_DIAMETER', 'depthMm', '整体深度不能小于透明舱体直径。'))
  }
  if (!draft.capsuleDiameterConfirmed) {
    issues.push(issue('CAPSULE_DIAMETER_UNCONFIRMED', 'capsuleDiameterConfirmed', '确认透明舱体直径 300 mm。'))
  }
  if (!isPositive(draft.defaultThicknessMm)) {
    issues.push(issue('DEFAULT_THICKNESS_INVALID', 'defaultThicknessMm', '默认板厚必须大于 0。'))
  }

  const usesDefaultThickness = draft.parts.some((part) => !isPositive(part.sizeMm[part.thicknessAxis]))
  if (usesDefaultThickness && !draft.defaultThicknessApproved) {
    issues.push(issue('DEFAULT_THICKNESS_UNAPPROVED', 'defaultThicknessApproved', '批准使用默认板厚，或逐块输入板厚。'))
  }

  for (const part of draft.parts) {
    for (const axis of axes) {
      if (axis === part.thicknessAxis && !isPositive(part.sizeMm[axis]) && draft.defaultThicknessApproved && isPositive(draft.defaultThicknessMm)) continue
      if (!isPositive(part.sizeMm[axis])) {
        issues.push(issue('PART_DIMENSION_MISSING', `parts.${part.id}.sizeMm.${axis}`, `${part.label}的 ${axis.toUpperCase()} 尺寸未完成。`))
      }
    }
  }

  if (draft.holes.length === 0) {
    issues.push(issue('MOUNTING_HOLES_MISSING', 'holes', '至少录入一个墙面施工孔。'))
  }

  const partIds = new Set(draft.parts.map((part) => part.id))
  for (const hole of draft.holes) {
    if (!partIds.has(hole.partId)) issues.push(issue('HOLE_PART_INVALID', `holes.${hole.id}.partId`, `施工孔 ${hole.id} 未绑定有效板件。`))
    if (!isPositive(hole.diameterMm)) issues.push(issue('HOLE_DIAMETER_MISSING', `holes.${hole.id}.diameterMm`, `施工孔 ${hole.id} 的孔径未完成。`))
    if (axes.some((axis) => hole.centerMm[axis] === null || !Number.isFinite(hole.centerMm[axis]))) {
      issues.push(issue('HOLE_CENTER_MISSING', `holes.${hole.id}.centerMm`, `施工孔 ${hole.id} 的中心坐标未完成。`))
    }
    if (!hole.confirmed) issues.push(issue('HOLE_UNCONFIRMED', `holes.${hole.id}.confirmed`, `施工孔 ${hole.id} 尚未确认。`))
  }

  return issues
}

export function buildComponentSpecFromCalibration(
  draft: SpaceCapsuleCalibrationDraft,
): { success: true; spec: ComponentSpecV1 } | { success: false; issues: CalibrationIssue[] } {
  const issues = listCalibrationIssues(draft)
  if (issues.length > 0) return { success: false, issues }

  const overallHeightMm = draft.heightScope === 'overall' ? draft.labeledHeightMm : requiredNumber(draft.overallHeightMm)
  const assumptions: ComponentSpecV1['assumptions'] = []
  const parts: ComponentSpecV1['parts'] = draft.parts.map((part) => {
    const sizeMm = { ...part.sizeMm } as Record<CalibrationAxis, number>
    if (!isPositive(sizeMm[part.thicknessAxis])) {
      sizeMm[part.thicknessAxis] = draft.defaultThicknessMm
      assumptions.push({
        field: `parts.${part.id}.sizeMm.${part.thicknessAxis}`,
        reason: `${part.label}采用已批准的默认板厚 ${draft.defaultThicknessMm} mm。`,
        severity: 'info',
      })
    }
    return {
      id: part.id,
      label: part.label,
      shape: part.shape,
      sizeMm,
      sizeStatus: 'confirmed',
      hardConstraint: true,
      materialRole: part.materialRole,
    }
  })

  parts.push({
    id: 'transparent-capsule',
    label: '透明太空舱',
    shape: 'hemisphere',
    sizeMm: {
      x: draft.capsuleDiameterMm,
      y: draft.capsuleDiameterMm / 2,
      z: draft.capsuleDiameterMm,
    },
    sizeStatus: 'confirmed',
    hardConstraint: true,
    materialRole: 'acrylic-transparent',
  })

  return {
    success: true,
    spec: {
      schemaVersion: 1,
      revision: 1,
      unit: 'mm',
      name: '太空舱直径 30 cm',
      family: 'wall-space-capsule-platform',
      placement: 'wall',
      overallSizeMm: {
        x: draft.widthMm,
        y: overallHeightMm,
        z: requiredNumber(draft.depthMm),
      },
      parts,
      holes: draft.holes.map((hole) => ({
        id: hole.id,
        partId: hole.partId,
        centerMm: {
          x: requiredNumber(hole.centerMm.x),
          y: requiredNumber(hole.centerMm.y),
          z: requiredNumber(hole.centerMm.z),
        },
        axis: axisVector(hole.axis),
        diameterMm: requiredNumber(hole.diameterMm),
        through: true,
        source: 'user',
        status: 'confirmed',
      })),
      assumptions,
    },
  }
}

export function createCalibrationHole(index: number, partId = 'back-panel'): CalibrationHoleDraft {
  return {
    id: `mount-hole-${index}`,
    partId,
    diameterMm: null,
    centerMm: { x: null, y: null, z: null },
    axis: '+Z',
    confirmed: false,
  }
}

function createPart(
  id: string,
  label: string,
  thicknessAxis: CalibrationAxis,
  sizeMm: Record<CalibrationAxis, NullableNumber>,
): CalibrationPartDraft {
  return { id, label, shape: 'rect-panel', sizeMm, thicknessAxis, materialRole: 'wood-primary' }
}

function issue(code: CalibrationIssue['code'], field: string, message: string): CalibrationIssue {
  return { code, field, message }
}

function isPositive(value: NullableNumber): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function requiredNumber(value: NullableNumber): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Calibration value is not complete.')
  return value
}

function axisVector(axis: HoleAxis) {
  if (axis === '+X') return { x: 1, y: 0, z: 0 }
  if (axis === '-X') return { x: -1, y: 0, z: 0 }
  if (axis === '+Y') return { x: 0, y: 1, z: 0 }
  if (axis === '-Y') return { x: 0, y: -1, z: 0 }
  if (axis === '-Z') return { x: 0, y: 0, z: -1 }
  return { x: 0, y: 0, z: 1 }
}

const axes: CalibrationAxis[] = ['x', 'y', 'z']
