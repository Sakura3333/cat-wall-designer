import { describe, expect, it } from 'vitest'
import { buildOriginalAssetTransform, componentAssetOptions, componentAssetRegistry, normalizeComponentAssetKey, normalizeComponentAssetUrl, resolveComponentAssetSize, resolveComponentAssetSource, validateComponentAssetUrl } from './componentAssets'

describe('component asset registry', () => {
  it('resolves built-in asset keys before external URLs', () => {
    expect(resolveComponentAssetSource('wall-two-step-ladder', 'https://example.com/custom.glb')).toMatchObject({
      key: 'wall-two-step-ladder',
      source: 'builtin',
      url: '/models/cat-wall/wall-two-step-ladder.glb',
      size: { x: 0.2833, y: 0.4662, z: 0.2166 },
    })
  })

  it('normalizes legacy placeholder keys from the early catalog', () => {
    expect(normalizeComponentAssetKey('cat-shelf-placeholder')).toBe('wall-two-step-ladder')
    expect(normalizeComponentAssetKey('painting-placeholder')).toBeUndefined()
  })

  it('accepts only GLB or GLTF runtime URLs for external assets', () => {
    expect(normalizeComponentAssetUrl(' /models/cat-wall/wall-soft-ladder.glb ')).toBe('/models/cat-wall/wall-soft-ladder.glb')
    expect(normalizeComponentAssetUrl('https://example.com/model.gltf?version=1')).toBe('https://example.com/model.gltf?version=1')
    expect(normalizeComponentAssetUrl('models/local.glb')).toBeUndefined()
    expect(normalizeComponentAssetUrl('https://example.com/model.obj')).toBeUndefined()
  })

  it('explains rejected external asset URLs', () => {
    expect(validateComponentAssetUrl('models/local.glb')).toMatchObject({
      valid: false,
      reason: 'unsupported-protocol',
    })
    expect(validateComponentAssetUrl('https://example.com/model.obj')).toMatchObject({
      valid: false,
      reason: 'unsupported-format',
    })
    expect(validateComponentAssetUrl('')).toEqual({ valid: true })
  })

  it('keeps registry URLs under the Vite public model directory', () => {
    expect(Object.values(componentAssetRegistry).map((asset) => asset.url)).toEqual(expect.arrayContaining(['/models/cat-wall/wall-two-step-ladder.glb']))
    expect(Object.values(componentAssetRegistry).every((asset) => asset.url.startsWith('/models/cat-wall/') && asset.url.endsWith('.glb'))).toBe(true)
    expect(componentAssetOptions).toHaveLength(Object.keys(componentAssetRegistry).length)
  })

  it('uses built-in asset dimensions for placement sizing', () => {
    expect(resolveComponentAssetSize({ x: 1, y: 1, z: 1 }, 'wall-two-step-ladder')).toEqual({ x: 0.2833, y: 0.4662, z: 0.2166 })
    expect(resolveComponentAssetSize({ x: 1, y: 1, z: 1 }, undefined, 'https://example.com/model.glb')).toEqual({ x: 1, y: 1, z: 1 })
  })

  it('centers model assets without changing their original scale or proportions', () => {
    expect(buildOriginalAssetTransform({ x: 4.9847, y: 0, z: 0.1083 })).toEqual({
      offset: { x: -4.9847, y: 0, z: -0.1083 },
      scale: { x: 1, y: 1, z: 1 },
    })
  })
})
