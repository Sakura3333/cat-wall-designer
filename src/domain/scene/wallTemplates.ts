import type { WallTemplateKind } from './types'

export const wallTemplates: Array<{ kind: WallTemplateKind; label: string; detail: string }> = [
  { kind: 'single-wall', label: '单面墙', detail: '一块正面墙' },
  { kind: 'corner-two-wall', label: '双墙夹角', detail: '两面墙成角' },
  { kind: 'three-wall', label: '三墙夹角', detail: '左中右三面墙' },
]

