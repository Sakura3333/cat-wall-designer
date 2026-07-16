import { describe, expect, it } from 'vitest'
import { normalizeComponentPropertyModelBinding, resolveComponentMaterialColor, resolveComponentSizeFromParams } from './componentParamEffects'
import type { ComponentPropertySchema } from './types'

describe('component param effects', () => {
  it('maps numeric params into declared size axes', () => {
    const schema: ComponentPropertySchema[] = [
      {
        id: 'width',
        label: '宽度',
        type: 'number',
        min: 0.2,
        max: 1.2,
        defaultValue: 0.6,
        modelBinding: { kind: 'size-axis', axis: 'x' },
      },
      {
        id: 'height',
        label: '高度',
        type: 'number',
        defaultValue: 0.4,
        modelBinding: { kind: 'size-axis', axis: 'y' },
      },
    ]

    expect(resolveComponentSizeFromParams({ x: 0.5, y: 0.3, z: 0.1 }, schema, { width: 2 })).toEqual({
      x: 1.2,
      y: 0.4,
      z: 0.1,
    })
  })

  it('uses the first bound color param as the component material color', () => {
    const schema: ComponentPropertySchema[] = [
      { id: 'ignored', label: '普通文本', type: 'text', defaultValue: '#111111' },
      { id: 'fabricColor', label: '布料颜色', type: 'color', defaultValue: '#f2e1cf', modelBinding: { kind: 'material-color' } },
    ]

    expect(resolveComponentMaterialColor('#ffffff', schema, {})).toBe('#f2e1cf')
    expect(resolveComponentMaterialColor('#ffffff', schema, { fabricColor: '#336699' })).toBe('#336699')
  })

  it('drops incomplete part visibility bindings', () => {
    expect(normalizeComponentPropertyModelBinding({ kind: 'part-visibility', target: '' })).toEqual({ kind: 'none' })
    expect(normalizeComponentPropertyModelBinding({ kind: 'size-axis', axis: 'z' })).toEqual({ kind: 'size-axis', axis: 'z' })
  })
})
