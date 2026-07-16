import { Box3, Color, EdgesGeometry, Material, Mesh, Object3D } from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { normalizeComponentPropertyModelBinding } from '../../domain/scene/componentParamEffects'
import type { ComponentPropertySchema, ComponentPropertyValue } from '../../domain/scene/types'

const INVISIBLE_PROXY_MATERIAL_NAMES = new Set(['material.002', '材质.002'])
const COMPONENT_OUTLINE_COLOR = '#332d26'
const COMPONENT_OUTLINE_LINEWIDTH = 2.2
const COMPONENT_OUTLINE_OPACITY = 0.86
const COMPONENT_OUTLINE_THRESHOLD_ANGLE = 18

export function prepareComponentGltfScene(scene: Object3D) {
  const meshes: Mesh[] = []
  scene.traverse((object) => {
    if (object instanceof Mesh) meshes.push(object)
  })

  meshes.forEach((mesh) => {
    mesh.castShadow = true
    mesh.receiveShadow = true

    if (isInvisibleProxyMesh(mesh)) {
      mesh.material = cloneAsInvisibleMaterial(mesh.material)
      mesh.userData.componentProxySurface = true
      return
    }

    addCartoonOutline(mesh)
  })
}

export function buildComponentRenderableBox(scene: Object3D) {
  const box = new Box3()
  let hasRenderableMesh = false
  scene.updateWorldMatrix(true, true)

  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return
    if (!object.visible || object.userData.componentProxySurface || object.userData.componentOutline) return
    object.geometry.computeBoundingBox()
    if (!object.geometry.boundingBox) return
    box.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld))
    hasRenderableMesh = true
  })

  return hasRenderableMesh ? box : new Box3().setFromObject(scene)
}

export function applyComponentModelParamEffects(scene: Object3D, schema: ComponentPropertySchema[], params: Record<string, ComponentPropertyValue> = {}) {
  schema.forEach((property) => {
    const binding = normalizeComponentPropertyModelBinding(property.modelBinding)
    const value = params[property.id] ?? property.defaultValue

    if (binding.kind === 'material-color' && binding.target && property.type === 'color' && typeof value === 'string' && isHexColor(value)) {
      applyMaterialColor(scene, value, binding.target)
    }

    if (binding.kind === 'part-visibility' && property.type === 'boolean') {
      applyPartVisibility(scene, binding.target, Boolean(value) === (binding.visibleWhen ?? true))
    }
  })
}

export function isInvisibleProxyMesh(mesh: Mesh) {
  if (mesh.children.length === 0) return false
  const materials = getMaterials(mesh.material)
  if (materials.length === 0) return false

  return materials.every((material) => isInvisibleProxyMaterial(material))
}

function isInvisibleProxyMaterial(material: Material) {
  const normalizedName = material.name.trim().toLowerCase()
  if (!INVISIBLE_PROXY_MATERIAL_NAMES.has(normalizedName)) return false
  if (material.transparent || material.opacity < 1) return false

  const mappedMaterial = material as Material & { map?: unknown; alphaMap?: unknown }
  return !mappedMaterial.map && !mappedMaterial.alphaMap
}

function cloneAsInvisibleMaterial(material: Material | Material[]) {
  if (Array.isArray(material)) return material.map(makeInvisible)
  return makeInvisible(material)
}

function makeInvisible(material: Material) {
  const nextMaterial = material.clone()
  nextMaterial.transparent = true
  nextMaterial.opacity = 0
  nextMaterial.depthWrite = false
  nextMaterial.colorWrite = false
  nextMaterial.needsUpdate = true
  return nextMaterial
}

function addCartoonOutline(mesh: Mesh) {
  if (mesh.userData.componentOutlineSource) return

  const edgesGeometry = new EdgesGeometry(mesh.geometry, COMPONENT_OUTLINE_THRESHOLD_ANGLE)
  const outlineGeometry = new LineSegmentsGeometry().fromEdgesGeometry(edgesGeometry)
  edgesGeometry.dispose()

  const outline = new LineSegments2(
    outlineGeometry,
    new LineMaterial({
      color: COMPONENT_OUTLINE_COLOR,
      linewidth: COMPONENT_OUTLINE_LINEWIDTH,
      opacity: COMPONENT_OUTLINE_OPACITY,
      transparent: true,
      depthWrite: false,
    }),
  )
  outline.computeLineDistances()
  outline.renderOrder = 4
  outline.userData.componentOutline = true
  mesh.userData.componentOutlineSource = true
  mesh.add(outline)
}

function getMaterials(material: Material | Material[]) {
  return Array.isArray(material) ? material : [material]
}

function applyMaterialColor(scene: Object3D, color: string, target: string) {
  const nextColor = new Color(color)
  scene.traverse((object) => {
    if (!(object instanceof Mesh) || object.userData.componentProxySurface) return
    if (!matchesTarget(object, target)) return
    const materialWasArray = Array.isArray(object.material)
    const materials = cloneMaterialsForMutation(object.material).map((material) => {
      const colorMaterial = material as Material & { color?: Color }
      if (colorMaterial.color) {
        colorMaterial.color.copy(nextColor)
        colorMaterial.needsUpdate = true
      }
      return colorMaterial
    })
    object.material = materialWasArray ? materials : materials[0]
  })
}

function applyPartVisibility(scene: Object3D, target: string, visible: boolean) {
  scene.traverse((object) => {
    if (object.userData.componentOutline) return
    if (matchesTarget(object, target)) object.visible = visible
  })
}

function cloneMaterialsForMutation(material: Material | Material[]) {
  const materials = getMaterials(material)
  return materials.map((item) => item.clone())
}

function matchesTarget(object: Object3D, target: string) {
  const normalizedTarget = normalizeText(target)
  if (!normalizedTarget) return false
  if (normalizeText(object.name).includes(normalizedTarget)) return true
  if (object instanceof Mesh) {
    return getMaterials(object.material).some((material) => normalizeText(material.name).includes(normalizedTarget))
  }
  return false
}

function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value)
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}
