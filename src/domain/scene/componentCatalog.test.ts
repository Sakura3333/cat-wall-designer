import { describe, expect, it } from 'vitest'
import {
  createDefaultComponentParams,
  defaultComponentSubcategories,
  normalizeCatalogItem,
  type ComponentCatalogItem,
} from './componentCatalog'

describe('normalizeCatalogItem', () => {
  it('normalizes stale persisted component data into the current runtime shape', () => {
    const normalized = normalizeCatalogItem(
      {
        kind: ' custom-kind ',
        label: ' ',
        detail: '  demo component  ',
        icon: ' ',
        placement: 'floor',
        subcategoryId: 'wall-climb',
        defaultSize: { x: Number.NaN, y: 0.5, z: 0.2 },
        defaultRotation: { x: 0, y: Number.POSITIVE_INFINITY, z: 0.25 },
        fallbackColor: '',
        assetKey: ' cat-shelf-placeholder ',
        assetUrl: 'https://example.com/model.obj',
        purchaseUrls: undefined,
        referencePrice: '299',
        propertySchema: [{ id: ' accentColor ', label: ' ', type: 'color', defaultValue: '#f8efe1' }],
      } as unknown as ComponentCatalogItem,
      defaultComponentSubcategories,
    )

    expect(normalized).toMatchObject({
      kind: 'custom-kind',
      label: 'custom-kind',
      detail: 'demo component',
      icon: 'boxes',
      placement: 'floor',
      subcategoryId: undefined,
      defaultSize: { x: 0.46, y: 0.5, z: 0.2 },
      defaultRotation: { x: 0, y: 0, z: 0.25 },
      fallbackColor: '#dbe7df',
      assetKey: 'wall-two-step-ladder',
      assetUrl: undefined,
      purchaseUrls: [],
      referencePrice: 299,
    })
    expect(normalized.propertySchema).toEqual([{ id: 'accentColor', label: 'accentColor', type: 'color', defaultValue: '#f8efe1' }])
  })

  it('keeps non-empty purchase URLs after trimming blank rows', () => {
    const normalized = normalizeCatalogItem(
      {
        kind: 'links',
        label: 'Links',
        detail: '',
        icon: 'boxes',
        placement: 'wall',
        defaultSize: { x: 1, y: 1, z: 1 },
        defaultRotation: { x: 0, y: 0, z: 0 },
        fallbackColor: '#ffffff',
        purchaseUrls: [' https://example.com/a ', '', 'https://example.com/b'],
        propertySchema: [],
      },
      defaultComponentSubcategories,
    )

    expect(normalized.purchaseUrls).toEqual(['https://example.com/a', 'https://example.com/b'])
  })
})

describe('createDefaultComponentParams', () => {
  it('collects default values from the catalog property schema', () => {
    expect(createDefaultComponentParams('cat-shelf')).toEqual({
      stepCount: 3,
      roundedEdges: true,
    })
  })
})
