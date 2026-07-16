import type { ComponentPropertyModelBinding, ComponentPropertySchema, ComponentPropertyValue, Vec3 } from './types'

export function resolveComponentSizeFromParams(baseSize: Vec3, schema: ComponentPropertySchema[], params: Record<string, ComponentPropertyValue> = {}): Vec3 {
  return schema.reduce<Vec3>((size, property) => {
    const binding = normalizeComponentPropertyModelBinding(property.modelBinding)
    if (binding.kind !== 'size-axis' || property.type !== 'number') return size

    const value = numericParamValue(property, params[property.id])
    if (!Number.isFinite(value)) return size

    return {
      ...size,
      [binding.axis]: roundDimension(clampParamNumber(value, property.min, property.max)),
    }
  }, baseSize)
}

export function resolveComponentMaterialColor(fallbackColor: string, schema: ComponentPropertySchema[], params: Record<string, ComponentPropertyValue> = {}) {
  for (const property of schema) {
    const binding = normalizeComponentPropertyModelBinding(property.modelBinding)
    if (binding.kind !== 'material-color' || property.type !== 'color') continue
    const value = params[property.id] ?? property.defaultValue
    if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) return value
  }

  return fallbackColor
}

export function normalizeComponentPropertyModelBinding(binding: ComponentPropertyModelBinding | undefined): ComponentPropertyModelBinding {
  if (!binding || binding.kind === 'none') return { kind: 'none' }
  if (binding.kind === 'material-color') {
    const target = binding.target?.trim()
    return target ? { kind: 'material-color', target } : { kind: 'material-color' }
  }
  if (binding.kind === 'part-visibility') {
    const target = binding.target?.trim()
    return target ? { kind: 'part-visibility', target, visibleWhen: binding.visibleWhen ?? true } : { kind: 'none' }
  }
  if (binding.kind === 'size-axis') {
    const axis = binding.axis === 'y' || binding.axis === 'z' ? binding.axis : 'x'
    return { kind: 'size-axis', axis }
  }

  return { kind: 'none' }
}

function numericParamValue(property: ComponentPropertySchema, value: ComponentPropertyValue | undefined) {
  if (typeof value === 'number') return value
  if (typeof property.defaultValue === 'number') return property.defaultValue
  return Number.NaN
}

function clampParamNumber(value: number, min?: number, max?: number) {
  let nextValue = value
  if (Number.isFinite(min)) nextValue = Math.max(min as number, nextValue)
  if (Number.isFinite(max)) nextValue = Math.min(max as number, nextValue)
  return nextValue
}

function roundDimension(value: number) {
  return Number(value.toFixed(4))
}
