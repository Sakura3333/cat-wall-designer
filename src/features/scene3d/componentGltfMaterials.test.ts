import { BoxGeometry, Mesh, MeshStandardMaterial, Object3D, PlaneGeometry, Vector3 } from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { describe, expect, it } from 'vitest'
import { applyComponentModelParamEffects, buildComponentRenderableBox, isInvisibleProxyMesh, prepareComponentGltfScene } from './componentGltfMaterials'

describe('component GLTF material preparation', () => {
  it('makes exported transparent proxy planes invisible without mutating the cached material', () => {
    const originalMaterial = new MeshStandardMaterial({ name: '材质.002' })
    const proxy = new Mesh(new PlaneGeometry(1, 1), originalMaterial)
    const visibleChild = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), new MeshStandardMaterial({ name: '材质' }))
    proxy.add(visibleChild)

    prepareComponentGltfScene(proxy)

    expect(isInvisibleProxyMesh(proxy)).toBe(false)
    expect(proxy.userData.componentProxySurface).toBe(true)
    expect(proxy.material).not.toBe(originalMaterial)
    expect(proxy.material).toMatchObject({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
    })
    expect(originalMaterial.transparent).toBe(false)
    expect(originalMaterial.opacity).toBe(1)
    expect(outlineChildren(proxy)).toHaveLength(0)
    expect(outlineChildren(visibleChild)).toHaveLength(1)
  })

  it('leaves ordinary meshes with the same material name visible and outlined', () => {
    const material = new MeshStandardMaterial({ name: '材质.002' })
    const mesh = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), material)

    prepareComponentGltfScene(mesh)

    expect(mesh.material).toBe(material)
    expect(material.opacity).toBe(1)
    expect(material.transparent).toBe(false)
    expect(outlineChildren(mesh)).toHaveLength(1)
  })

  it('prepares visible component meshes for shadow rendering', () => {
    const scene = new Object3D()
    const mesh = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), new MeshStandardMaterial({ name: 'wood' }))
    scene.add(mesh)

    prepareComponentGltfScene(scene)

    expect(mesh.castShadow).toBe(true)
    expect(mesh.receiveShadow).toBe(true)
    expect(outlineChildren(mesh)).toHaveLength(1)
  })

  it('does not duplicate component outlines when preparation runs twice', () => {
    const mesh = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), new MeshStandardMaterial({ name: 'wood' }))

    prepareComponentGltfScene(mesh)
    prepareComponentGltfScene(mesh)

    expect(outlineChildren(mesh)).toHaveLength(1)
  })

  it('excludes invisible proxy meshes from renderable bounds', () => {
    const proxy = new Mesh(new PlaneGeometry(8, 8), new MeshStandardMaterial({ name: '材质.002' }))
    const visibleChild = new Mesh(new BoxGeometry(0.4, 0.3, 0.2), new MeshStandardMaterial({ name: 'wood' }))
    visibleChild.position.set(1.2, 0.5, 0.1)
    proxy.add(visibleChild)

    prepareComponentGltfScene(proxy)
    const size = buildComponentRenderableBox(proxy).getSize(new Vector3())

    expect(size.x).toBeCloseTo(0.4)
    expect(size.y).toBeCloseTo(0.3)
    expect(size.z).toBeCloseTo(0.2)
  })

  it('applies color params by cloning visible materials', () => {
    const material = new MeshStandardMaterial({ name: 'wood', color: '#ffffff' })
    const mesh = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), material)

    applyComponentModelParamEffects(
      mesh,
      [{ id: 'woodColor', label: '木色', type: 'color', defaultValue: '#c09052', modelBinding: { kind: 'material-color', target: 'wood' } }],
      { woodColor: '#336699' },
    )

    expect(mesh.material).not.toBe(material)
    expect((mesh.material as MeshStandardMaterial).color.getHexString()).toBe('336699')
    expect(material.color.getHexString()).toBe('ffffff')
  })

  it('preserves GLB materials when color params have no target', () => {
    const scene = new Object3D()
    const woodMaterial = new MeshStandardMaterial({ name: 'wood', color: '#915f36' })
    const ropeMaterial = new MeshStandardMaterial({ name: 'rope', color: '#c6a262' })
    const wood = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), woodMaterial)
    const rope = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), ropeMaterial)
    scene.add(wood, rope)

    applyComponentModelParamEffects(
      scene,
      [{ id: 'platformColor', label: '板面颜色', type: 'color', defaultValue: '#e7c49e', modelBinding: { kind: 'material-color' } }],
      { platformColor: '#336699' },
    )

    expect(wood.material).toBe(woodMaterial)
    expect(rope.material).toBe(ropeMaterial)
    expect(woodMaterial.color.getHexString()).toBe('915f36')
    expect(ropeMaterial.color.getHexString()).toBe('c6a262')
  })

  it('toggles matching model parts with boolean params', () => {
    const scene = new Object3D()
    const rail = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), new MeshStandardMaterial({ name: 'wood' }))
    rail.name = 'front-rail'
    const platform = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), new MeshStandardMaterial({ name: 'wood' }))
    platform.name = 'platform'
    scene.add(rail, platform)

    applyComponentModelParamEffects(
      scene,
      [{ id: 'showRail', label: '显示围栏', type: 'boolean', defaultValue: true, modelBinding: { kind: 'part-visibility', target: 'rail', visibleWhen: true } }],
      { showRail: false },
    )

    expect(rail.visible).toBe(false)
    expect(platform.visible).toBe(true)
  })
})

function outlineChildren(mesh: Mesh) {
  return mesh.children.filter((child): child is LineSegments2 => child instanceof LineSegments2 && child.userData.componentOutline === true)
}
