import type { Vec3 } from './types'

export type ComponentAssetSource = {
  key: string
  label: string
  url: string
  source: 'builtin' | 'external'
  size?: Vec3
}

export const componentAssetRegistry = {
  'wall-three-step-platform-right': {
    key: 'wall-three-step-platform-right',
    label: '三层跳台-右',
    url: '/models/cat-wall/wall-three-step-platform-right.glb',
    source: 'builtin',
    size: { x: 0.6234, y: 0.6485, z: 0.2152 },
  },
  'wall-three-step-platform-left': {
    key: 'wall-three-step-platform-left',
    label: '三层跳台-左',
    url: '/models/cat-wall/wall-three-step-platform-left.glb',
    source: 'builtin',
    size: { x: 0.6234, y: 0.6485, z: 0.2152 },
  },
  'wall-two-step-ladder': {
    key: 'wall-two-step-ladder',
    label: '两层小爬梯',
    url: '/models/cat-wall/wall-two-step-ladder.glb',
    source: 'builtin',
    size: { x: 0.2833, y: 0.4662, z: 0.2166 },
  },
  'wall-jump-board-medium': {
    key: 'wall-jump-board-medium',
    label: '中跳板',
    url: '/models/cat-wall/wall-jump-board-medium.glb',
    source: 'builtin',
    size: { x: 0.3, y: 0.2, z: 0.2666 },
  },
  'wall-half-round-board': {
    key: 'wall-half-round-board',
    label: '半圆跳板',
    url: '/models/cat-wall/wall-half-round-board.glb',
    source: 'builtin',
    size: { x: 0.4, y: 0.25, z: 0.4166 },
  },
  'wall-four-step-ladder': {
    key: 'wall-four-step-ladder',
    label: '四层硬梯',
    url: '/models/cat-wall/wall-four-step-ladder.glb',
    source: 'builtin',
    size: { x: 0.2784, y: 0.35, z: 0.266 },
  },
  'wall-rail-platform': {
    key: 'wall-rail-platform',
    label: '围栏跳台',
    url: '/models/cat-wall/wall-rail-platform.glb',
    source: 'builtin',
    size: { x: 0.4, y: 0.2, z: 0.416 },
  },
  'wall-post-horizontal': {
    key: 'wall-post-horizontal',
    label: '壁挂爬柱横款',
    url: '/models/cat-wall/wall-post-horizontal.glb',
    source: 'builtin',
    size: { x: 0.7, y: 0.13, z: 0.1613 },
  },
  'wall-cat-house-right': {
    key: 'wall-cat-house-right',
    label: '大猫房子-右',
    url: '/models/cat-wall/wall-cat-house-right.glb',
    source: 'builtin',
    size: { x: 0.58, y: 0.3798, z: 0.3 },
  },
  'wall-cat-house-left': {
    key: 'wall-cat-house-left',
    label: '大猫房子-左',
    url: '/models/cat-wall/wall-cat-house-left.glb',
    source: 'builtin',
    size: { x: 0.58, y: 0.3798, z: 0.3 },
  },
  'wall-soft-ladder': {
    key: 'wall-soft-ladder',
    label: '软梯',
    url: '/models/cat-wall/wall-soft-ladder.glb',
    source: 'builtin',
    size: { x: 0.9201, y: 0.016, z: 0.15 },
  },
} satisfies Record<string, ComponentAssetSource>

export type ComponentAssetKey = keyof typeof componentAssetRegistry

const legacyAssetKeyMap: Record<string, ComponentAssetKey | undefined> = {
  'cat-shelf-placeholder': 'wall-two-step-ladder',
  'painting-placeholder': undefined,
  'cat-bed-placeholder': undefined,
  'curtain-placeholder': undefined,
  'bowl-placeholder': undefined,
}

export function normalizeComponentAssetKey(assetKey?: string) {
  const trimmed = assetKey?.trim()
  if (!trimmed) return undefined
  if (Object.prototype.hasOwnProperty.call(legacyAssetKeyMap, trimmed)) return legacyAssetKeyMap[trimmed]
  return trimmed
}

export function resolveComponentAssetSource(assetKey?: string, assetUrl?: string): ComponentAssetSource | null {
  const normalizedAssetKey = normalizeComponentAssetKey(assetKey)
  if (normalizedAssetKey && normalizedAssetKey in componentAssetRegistry) {
    return componentAssetRegistry[normalizedAssetKey as ComponentAssetKey]
  }

  const normalizedAssetUrl = normalizeComponentAssetUrl(assetUrl)
  if (!normalizedAssetUrl) return null

  return {
    key: `external:${normalizedAssetUrl}`,
    label: '外部 GLB',
    url: normalizedAssetUrl,
    source: 'external',
  }
}

export function normalizeComponentAssetUrl(assetUrl?: string) {
  const trimmed = assetUrl?.trim()
  if (!trimmed || !/\.(glb|gltf)([?#].*)?$/i.test(trimmed)) return undefined
  if (trimmed.startsWith('/') || trimmed.startsWith('https://') || trimmed.startsWith('http://')) return trimmed
  return undefined
}

export function resolveComponentAssetSize(fallbackSize: Vec3, assetKey?: string, assetUrl?: string): Vec3 {
  return resolveComponentAssetSource(assetKey, assetUrl)?.size ?? fallbackSize
}

export function buildOriginalAssetTransform(center: Vec3) {
  return {
    offset: {
      x: negateNumber(center.x),
      y: negateNumber(center.y),
      z: negateNumber(center.z),
    },
    scale: { x: 1, y: 1, z: 1 },
  }
}

function negateNumber(value: number) {
  const next = -value
  return Object.is(next, -0) ? 0 : next
}
