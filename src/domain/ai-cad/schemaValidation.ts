import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js'
import componentSpecSchema from '../../../schemas/ai-cad/component-spec.v1.schema.json'
import modelingPlanSchema from '../../../schemas/ai-cad/modeling-plan.v1.schema.json'
import qualityReportSchema from '../../../schemas/ai-cad/quality-report.v1.schema.json'
import visionObservationSchema from '../../../schemas/ai-cad/vision-observation.v1.schema.json'
import type { ComponentSpecV1, ModelingPlanV1, QualityReportV1, VisionObservationV1 } from './types'

export type SchemaValidationError = {
  path: string
  keyword: string
  message: string
}

export type SchemaValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: SchemaValidationError[] }

export type ComponentSpecReadinessIssue = {
  code: 'BLOCKING_ASSUMPTION' | 'UNCONFIRMED_HARD_PART' | 'UNCONFIRMED_HOLE' | 'UNKNOWN_HOLE_PART' | 'DUPLICATE_ID'
  path: string
  message: string
}

export type ModelingPlanSemanticIssue = {
  code:
    | 'REVISION_MISMATCH'
    | 'DUPLICATE_NODE_ID'
    | 'UNKNOWN_PART'
    | 'UNKNOWN_TARGET_NODE'
    | 'UNKNOWN_HOLE'
    | 'HOLE_PART_MISMATCH'
    | 'HOLE_DIAMETER_MISMATCH'
    | 'HOLE_CENTER_MISMATCH'
    | 'HOLE_AXIS_MISMATCH'
  path: string
  message: string
}

const ajv = new Ajv2020({ allErrors: true, strict: true })
const visionObservationValidator = ajv.compile<VisionObservationV1>(visionObservationSchema)
const componentSpecValidator = ajv.compile<ComponentSpecV1>(componentSpecSchema)
const modelingPlanValidator = ajv.compile<ModelingPlanV1>(modelingPlanSchema)
const qualityReportValidator = ajv.compile<QualityReportV1>(qualityReportSchema)

export function validateVisionObservation(value: unknown): SchemaValidationResult<VisionObservationV1> {
  return validate(visionObservationValidator, value)
}

export function validateComponentSpec(value: unknown): SchemaValidationResult<ComponentSpecV1> {
  return validate(componentSpecValidator, value)
}

export function validateModelingPlan(value: unknown): SchemaValidationResult<ModelingPlanV1> {
  return validate(modelingPlanValidator, value)
}

export function validateQualityReport(value: unknown): SchemaValidationResult<QualityReportV1> {
  return validate(qualityReportValidator, value)
}

export function assessComponentSpecReadiness(spec: ComponentSpecV1): ComponentSpecReadinessIssue[] {
  const issues: ComponentSpecReadinessIssue[] = []
  const partIds = new Set<string>()
  const allIds = new Set<string>()

  for (const part of spec.parts) {
    addDuplicateIssue(part.id, `parts.${part.id}`, allIds, issues)
    partIds.add(part.id)
    if (part.hardConstraint && part.sizeStatus !== 'confirmed') {
      issues.push({
        code: 'UNCONFIRMED_HARD_PART',
        path: `parts.${part.id}.sizeStatus`,
        message: `硬约束板件“${part.label}”的尺寸尚未确认。`,
      })
    }
  }

  for (const hole of spec.holes) {
    addDuplicateIssue(hole.id, `holes.${hole.id}`, allIds, issues)
    if (!partIds.has(hole.partId)) {
      issues.push({
        code: 'UNKNOWN_HOLE_PART',
        path: `holes.${hole.id}.partId`,
        message: `孔“${hole.id}”引用了不存在的板件“${hole.partId}”。`,
      })
    }
    if (hole.status !== 'confirmed') {
      issues.push({
        code: 'UNCONFIRMED_HOLE',
        path: `holes.${hole.id}.status`,
        message: `施工孔“${hole.id}”尚未由用户确认。`,
      })
    }
  }

  spec.assumptions.forEach((assumption, index) => {
    if (assumption.severity === 'blocking') {
      issues.push({
        code: 'BLOCKING_ASSUMPTION',
        path: `assumptions.${index}`,
        message: assumption.reason,
      })
    }
  })

  return issues
}

export function assessModelingPlanSemantics(plan: ModelingPlanV1, spec: ComponentSpecV1, toleranceMm = 0.001): ModelingPlanSemanticIssue[] {
  const issues: ModelingPlanSemanticIssue[] = []
  const partIds = new Set(spec.parts.map((part) => part.id))
  const holesById = new Map(spec.holes.map((hole) => [hole.id, hole]))
  const nodeIds = new Set<string>()
  const boxesById = new Map<string, Extract<ModelingPlanV1['nodes'][number], { op: 'box' }>>()

  if (plan.componentSpecRevision !== spec.revision) {
    issues.push({
      code: 'REVISION_MISMATCH',
      path: 'componentSpecRevision',
      message: `建模计划引用 revision ${plan.componentSpecRevision}，当前组件规格是 revision ${spec.revision}。`,
    })
  }

  plan.nodes.forEach((node, index) => {
    if (nodeIds.has(node.id)) {
      issues.push({
        code: 'DUPLICATE_NODE_ID',
        path: `nodes.${index}.id`,
        message: `建模节点 ID“${node.id}”重复。`,
      })
    }
    nodeIds.add(node.id)

    if (node.op === 'box') {
      boxesById.set(node.id, node)
      if (!partIds.has(node.partId)) {
        issues.push({
          code: 'UNKNOWN_PART',
          path: `nodes.${index}.partId`,
          message: `节点“${node.id}”引用了不存在的板件“${node.partId}”。`,
        })
      }
    }
  })

  plan.nodes.forEach((node, index) => {
    if (node.op !== 'mounting-hole') return
    const hole = holesById.get(node.holeId)
    const target = boxesById.get(node.targetNodeId)

    if (!target) {
      issues.push({
        code: 'UNKNOWN_TARGET_NODE',
        path: `nodes.${index}.targetNodeId`,
        message: `孔操作“${node.id}”引用了不存在的 Box 节点“${node.targetNodeId}”。`,
      })
    }
    if (!hole) {
      issues.push({
        code: 'UNKNOWN_HOLE',
        path: `nodes.${index}.holeId`,
        message: `孔操作“${node.id}”引用了不存在的施工孔“${node.holeId}”。`,
      })
      return
    }
    if (target && target.partId !== hole.partId) {
      issues.push({
        code: 'HOLE_PART_MISMATCH',
        path: `nodes.${index}.targetNodeId`,
        message: `施工孔“${hole.id}”属于板件“${hole.partId}”，不能作用到“${target.partId}”。`,
      })
    }
    if (!nearlyEqual(node.diameterMm, hole.diameterMm, toleranceMm)) {
      issues.push({
        code: 'HOLE_DIAMETER_MISMATCH',
        path: `nodes.${index}.diameterMm`,
        message: `施工孔“${hole.id}”的计划孔径 ${node.diameterMm} mm 与确认值 ${hole.diameterMm} mm 不一致。`,
      })
    }
    if (!vecNearlyEqual(node.centerMm, hole.centerMm, toleranceMm)) {
      issues.push({
        code: 'HOLE_CENTER_MISMATCH',
        path: `nodes.${index}.centerMm`,
        message: `施工孔“${hole.id}”的计划孔中心与确认值不一致。`,
      })
    }
    if (node.axis !== axisLabel(hole.axis)) {
      issues.push({
        code: 'HOLE_AXIS_MISMATCH',
        path: `nodes.${index}.axis`,
        message: `施工孔“${hole.id}”的计划轴向 ${node.axis} 与确认值 ${axisLabel(hole.axis)} 不一致。`,
      })
    }
  })

  return issues
}

function validate<T>(validator: ValidateFunction<T>, value: unknown): SchemaValidationResult<T> {
  if (validator(value)) return { success: true, data: value }
  return { success: false, errors: formatErrors(validator.errors) }
}

function formatErrors(errors: ErrorObject[] | null | undefined): SchemaValidationError[] {
  return (errors ?? []).map((error) => ({
    path: error.instancePath || '/',
    keyword: error.keyword,
    message: error.message ?? 'Schema validation failed.',
  }))
}

function addDuplicateIssue(id: string, path: string, ids: Set<string>, issues: ComponentSpecReadinessIssue[]) {
  if (ids.has(id)) {
    issues.push({
      code: 'DUPLICATE_ID',
      path,
      message: `ID“${id}”在组件规格中重复。`,
    })
  }
  ids.add(id)
}

function nearlyEqual(left: number, right: number, tolerance: number) {
  return Math.abs(left - right) <= tolerance
}

function vecNearlyEqual(left: { x: number; y: number; z: number }, right: { x: number; y: number; z: number }, tolerance: number) {
  return nearlyEqual(left.x, right.x, tolerance) && nearlyEqual(left.y, right.y, tolerance) && nearlyEqual(left.z, right.z, tolerance)
}

function axisLabel(axis: { x: number; y: number; z: number }): '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z' {
  if (axis.x === 1) return '+X'
  if (axis.x === -1) return '-X'
  if (axis.y === 1) return '+Y'
  if (axis.y === -1) return '-Y'
  if (axis.z === -1) return '-Z'
  return '+Z'
}
