import { describe, expect, it } from 'vitest'
import { componentAssetRegistry, normalizeComponentAssetKey, normalizeComponentAssetUrl, resolveComponentAssetSource } from './componentAssets'

describe('component asset registry', () => {
  it('resolves built-in asset keys before external URLs', () => {
    expect(resolveComponentAssetSource('wall-two-step-ladder', 'https://example.com/custom.glb')).toMatchObject({
      key: 'wall-two-step-ladder',
      source: 'builtin',
      url: '/models/cat-wall/wall-two-step-ladder.glb',
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

  it('keeps registry URLs under the Vite public model directory', () => {
    expect(Object.values(componentAssetRegistry).map((asset) => asset.url)).toEqual(expect.arrayContaining(['/models/cat-wall/wall-two-step-ladder.glb']))
    expect(Object.values(componentAssetRegistry).every((asset) => asset.url.startsWith('/models/cat-wall/') && asset.url.endsWith('.glb'))).toBe(true)
  })
})
