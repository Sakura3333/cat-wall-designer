import { Edges, OrbitControls, TransformControls } from '@react-three/drei'
import { Canvas, useLoader, useThree } from '@react-three/fiber'
import { Component, forwardRef, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Box3, BufferGeometry, Camera, CanvasTexture, Float32BufferAttribute, Group, Mesh, MOUSE, Object3D, Quaternion, Raycaster, TextureLoader, Vector2, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { useEditorStore } from '../../editor/editorStore'
import { resolveComponentAssetSource } from '../../domain/scene/componentAssets'
import { getComponentCatalogItem } from '../../domain/scene/componentCatalog'
import type { ComponentPlacementHit, ComponentPlacementSurface, PlaneSpec, PlaneType, PolygonSpec, SceneComponent, Vec2 } from '../../domain/scene/types'
import { applyConstrainedComponentTransformPreview } from './componentTransformPreview'

export function SceneCanvas() {
  const project = useEditorStore((state) => state.project)
  const selectedId = useEditorStore((state) => state.selectedId)
  const transformMode = useEditorStore((state) => state.transformMode)
  const selectSceneObject = useEditorStore((state) => state.selectSceneObject)
  const setTransformMode = useEditorStore((state) => state.setTransformMode)
  const updatePlaneTransform = useEditorStore((state) => state.updatePlaneTransform)
  const updateComponentTransform = useEditorStore((state) => state.updateComponentTransform)
  const polygonsById = useMemo(() => new Map(project.polygons.map((polygon) => [polygon.id, polygon])), [project.polygons])
  const selectedPlane = project.planes.find((plane) => plane.id === selectedId) ?? null
  const selectedComponent = project.components.find((component) => component.id === selectedId) ?? null
  const [selectedObject, setSelectedObject] = useState<Object3D | null>(null)
  const sceneGroupRef = useRef<Group>(null)
  const previewComponentRef = useRef<SceneComponent | null>(null)
  const camera = project.sceneCamera
  const cameraConfig = camera
    ? {
        fov: camera.fov,
        position: [camera.position.x, camera.position.y, camera.position.z] as [number, number, number],
        rotation: [camera.rotation.x, camera.rotation.y, camera.rotation.z] as [number, number, number],
        near: 0.1,
        far: 100,
      }
    : {
        fov: 40,
        position: [0, 2.25, 8.6] as [number, number, number],
        near: 0.1,
        far: 100,
      }

  useEffect(() => {
    previewComponentRef.current = null
    if (!selectedId) setSelectedObject(null)
  }, [selectedId])

  function commitSelectedTransform() {
    if (!selectedObject) return
    const patch = {
      position: { x: selectedObject.position.x, y: selectedObject.position.y, z: selectedObject.position.z },
      rotation: { x: selectedObject.rotation.x, y: selectedObject.rotation.y, z: selectedObject.rotation.z },
    }

    if (selectedPlane) {
      updatePlaneTransform(selectedPlane.id, patch)
    } else if (selectedComponent) {
      updateComponentTransform(selectedComponent.id, patch)
    }
    previewComponentRef.current = null
  }

  function constrainSelectedComponentPreview() {
    if (!selectedObject || !selectedComponent) return
    const previewComponent = previewComponentRef.current?.id === selectedComponent.id ? previewComponentRef.current : selectedComponent
    previewComponentRef.current = applyConstrainedComponentTransformPreview(selectedObject, previewComponent, project.planes)
  }

  return (
    <Canvas className="scene-canvas" camera={cameraConfig}>
      <ambientLight intensity={1.4} />
      <directionalLight position={[2, 4, 5]} intensity={1.1} />
      <Suspense fallback={null}>
        <group ref={sceneGroupRef} position={camera ? [0, 0, 0] : [0, -1, 0]}>
          {project.planes.map((plane) => {
            const polygon = plane.polygonId ? polygonsById.get(plane.polygonId) : undefined
            return (
              <PlaneMesh
                key={plane.id}
                plane={plane}
                polygon={polygon}
                selected={selectedId === plane.id}
                ref={selectedId === plane.id ? setSelectedObject : undefined}
                onSelect={() => selectSceneObject(plane.id)}
              />
            )
          })}
          {project.components.map((component) => (
            <ComponentMesh
              key={component.id}
              component={component}
              selected={selectedId === component.id}
              ref={selectedId === component.id ? setSelectedObject : undefined}
              onSelect={() => selectSceneObject(component.id)}
            />
          ))}
        </group>
        <PlacementResolver sceneGroupRef={sceneGroupRef} />
        {selectedObject && (selectedPlane || selectedComponent) && (
          <TransformControls
            object={selectedObject}
            mode={transformMode === 'rotate' ? 'rotate' : 'translate'}
            enabled={transformMode !== 'select'}
            onObjectChange={constrainSelectedComponentPreview}
            onMouseUp={() => {
              commitSelectedTransform()
              setTransformMode('select')
            }}
          />
        )}
      </Suspense>
      <OrbitControls
        enabled={transformMode === 'select'}
        enablePan
        mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={2.6}
        maxDistance={14}
      />
    </Canvas>
  )
}

type PlaneMeshProps = {
  plane: PlaneSpec
  polygon?: PolygonSpec
  selected: boolean
  onSelect: () => void
}

const PlaneMesh = forwardRef<Mesh, PlaneMeshProps>(function PlaneMesh({ plane, polygon, selected, onSelect }, ref) {
  const geometry = useMemo(() => buildThickPlaneGeometry(plane.width, plane.height, plane.type === 'floor' ? 0.08 : 0.1, polygon?.uv), [plane.width, plane.height, plane.type, polygon?.uv])

  return (
    <mesh
      ref={ref}
      userData={{ kind: 'plane', planeId: plane.id, planeType: plane.type }}
      position={[plane.position.x, plane.position.y, plane.position.z]}
      rotation={[plane.rotation.x, plane.rotation.y, plane.rotation.z]}
      onClick={(event) => {
        event.stopPropagation()
        onSelect()
      }}
    >
      <primitive attach="geometry" object={geometry} />
      {plane.textureUrl && plane.textureEnabled ? (
        <TextureMaterial url={plane.textureUrl} floor={plane.type === 'floor'} />
      ) : plane.type === 'wall' ? (
        <WarmWallMaterial />
      ) : (
        <meshStandardMaterial color="#d9c3a2" roughness={0.9} />
      )}
      <Edges color={selected ? '#d96d5f' : '#332d26'} linewidth={selected ? 3 : 2} />
    </mesh>
  )
})

type PlacementResolverProps = {
  sceneGroupRef: RefObject<Group | null>
}

function PlacementResolver({ sceneGroupRef }: PlacementResolverProps) {
  const pendingPlacement = useEditorStore((state) => state.pendingComponentPlacement)
  const addComponent = useEditorStore((state) => state.addComponent)
  const consumeComponentPlacement = useEditorStore((state) => state.consumeComponentPlacement)
  const { camera, gl, raycaster, scene } = useThree()

  useEffect(() => {
    if (!pendingPlacement) return

    const hit = pendingPlacement.clientPoint
      ? resolveScenePlacementHit(pendingPlacement.clientPoint, camera, gl.domElement, scene, raycaster, sceneGroupRef.current)
      : null
    addComponent(pendingPlacement.kind, hit)
    consumeComponentPlacement(pendingPlacement.id)
  }, [addComponent, camera, consumeComponentPlacement, gl.domElement, pendingPlacement, raycaster, scene, sceneGroupRef])

  return null
}

type PlaneUserData = {
  kind?: 'plane'
  planeId?: string
  planeType?: PlaneType
}

function resolveScenePlacementHit(clientPoint: Vec2, camera: Camera, canvas: HTMLCanvasElement, scene: Object3D, raycaster: Raycaster, sceneGroup: Group | null): ComponentPlacementHit | null {
  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null

  const ndc = new Vector2(((clientPoint.x - rect.left) / rect.width) * 2 - 1, -((clientPoint.y - rect.top) / rect.height) * 2 + 1)
  const planeObjects: Object3D[] = []
  scene.traverse((object) => {
    const userData = object.userData as PlaneUserData
    if (userData.kind === 'plane') planeObjects.push(object)
  })

  if (!planeObjects.length) return null

  raycaster.setFromCamera(ndc, camera)
  const intersections = raycaster.intersectObjects(planeObjects, false)
  for (const intersection of intersections) {
    const userData = intersection.object.userData as PlaneUserData
    if (!userData.planeId || !userData.planeType) continue

    const point = intersection.point.clone()
    const localPoint = sceneGroup ? sceneGroup.worldToLocal(point.clone()) : point
    const localFaceNormal = intersection.face?.normal.clone() ?? new Vector3(0, 0, 1)
    const normal = toSceneLocalNormal(localFaceNormal, intersection.object, sceneGroup)

    return {
      planeId: userData.planeId,
      planeType: userData.planeType,
      point: toVec3(localPoint),
      normal: toVec3(normal),
      surface: classifyPlaneSurface(userData.planeType, localFaceNormal),
    }
  }

  return null
}

function toSceneLocalNormal(localFaceNormal: Vector3, object: Object3D, sceneGroup: Group | null) {
  const worldNormal = localFaceNormal.clone().transformDirection(object.matrixWorld)
  if (!sceneGroup) return worldNormal.normalize()

  const groupWorldQuaternion = sceneGroup.getWorldQuaternion(new Quaternion()).invert()
  return worldNormal.applyQuaternion(groupWorldQuaternion).normalize()
}

function classifyPlaneSurface(planeType: PlaneType, localFaceNormal: Vector3): ComponentPlacementSurface {
  if (planeType === 'floor' && localFaceNormal.z > 0.65) return 'top'
  if (Math.abs(localFaceNormal.z) > 0.65) return localFaceNormal.z > 0 ? 'front' : 'back'
  return 'side'
}

function toVec3(vector: Vector3) {
  return {
    x: Number(vector.x.toFixed(4)),
    y: Number(vector.y.toFixed(4)),
    z: Number(vector.z.toFixed(4)),
  }
}

function buildThickPlaneGeometry(width: number, height: number, depth: number, uv?: Vec2[]) {
  const halfWidth = width / 2
  const halfHeight = height / 2
  const halfDepth = depth / 2
  const geometry = new BufferGeometry()
  const frontUv = uv?.length === 4 ? uv : defaultUv
  const backUv: Vec2[] = [
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ]
  const sideUv = defaultUv

  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [
        -halfWidth, halfHeight, halfDepth,
        halfWidth, halfHeight, halfDepth,
        halfWidth, -halfHeight, halfDepth,
        -halfWidth, -halfHeight, halfDepth,
        halfWidth, halfHeight, -halfDepth,
        -halfWidth, halfHeight, -halfDepth,
        -halfWidth, -halfHeight, -halfDepth,
        halfWidth, -halfHeight, -halfDepth,
        -halfWidth, halfHeight, -halfDepth,
        -halfWidth, halfHeight, halfDepth,
        -halfWidth, -halfHeight, halfDepth,
        -halfWidth, -halfHeight, -halfDepth,
        halfWidth, halfHeight, halfDepth,
        halfWidth, halfHeight, -halfDepth,
        halfWidth, -halfHeight, -halfDepth,
        halfWidth, -halfHeight, halfDepth,
        -halfWidth, halfHeight, -halfDepth,
        halfWidth, halfHeight, -halfDepth,
        halfWidth, halfHeight, halfDepth,
        -halfWidth, halfHeight, halfDepth,
        -halfWidth, -halfHeight, halfDepth,
        halfWidth, -halfHeight, halfDepth,
        halfWidth, -halfHeight, -halfDepth,
        -halfWidth, -halfHeight, -halfDepth,
      ],
      3,
    ),
  )
  geometry.setAttribute(
    'uv',
    new Float32BufferAttribute([...frontUv, ...backUv, ...sideUv, ...sideUv, ...sideUv, ...sideUv].flatMap((point) => [point.x, point.y]), 2),
  )
  geometry.setIndex([
    0, 3, 1, 1, 3, 2,
    4, 7, 5, 5, 7, 6,
    8, 11, 9, 9, 11, 10,
    12, 15, 13, 13, 15, 14,
    16, 19, 17, 17, 19, 18,
    20, 23, 21, 21, 23, 22,
  ])
  geometry.computeVertexNormals()
  return geometry
}

const defaultUv: Vec2[] = [
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: 0 },
  { x: 0, y: 0 },
]

function TextureMaterial({ url, floor }: { url: string; floor: boolean }) {
  const texture = useLoader(TextureLoader, url)
  texture.colorSpace = 'srgb'
  return <meshStandardMaterial map={texture} color={floor ? '#d6bea0' : '#fff3df'} roughness={0.88} transparent opacity={0.88} />
}

function WarmWallMaterial() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')
    if (context) {
      context.fillStyle = '#efd5b0'
      context.fillRect(0, 0, canvas.width, canvas.height)

      for (let y = 0; y < canvas.height; y += 18) {
        context.strokeStyle = y % 36 === 0 ? 'rgba(132, 95, 58, 0.10)' : 'rgba(255, 255, 255, 0.18)'
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(0, y + Math.sin(y) * 2)
        context.quadraticCurveTo(86, y + 5, 172, y - 2)
        context.quadraticCurveTo(216, y - 4, 256, y + 3)
        context.stroke()
      }

      for (let i = 0; i < 460; i += 1) {
        const x = Math.random() * canvas.width
        const y = Math.random() * canvas.height
        const radius = Math.random() * 1.8 + 0.4
        context.fillStyle = i % 3 === 0 ? 'rgba(116, 82, 49, 0.12)' : 'rgba(255, 246, 229, 0.22)'
        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fill()
      }
    }

    const wallTexture = new CanvasTexture(canvas)
    wallTexture.colorSpace = 'srgb'
    return wallTexture
  }, [])

  return <meshStandardMaterial map={texture} color="#f1c995" roughness={0.96} />
}

type ComponentMeshProps = {
  component: SceneComponent
  selected: boolean
  onSelect: () => void
}

const ComponentMesh = forwardRef<Group, ComponentMeshProps>(function ComponentMesh({ component, selected, onSelect }, ref) {
  const catalogItem = getComponentCatalogItem(component.kind)
  const size = component.size ?? catalogItem?.defaultSize ?? { x: 0.46, y: component.kind === 'curtain' ? 0.86 : 0.28, z: 0.14 }
  const scale = component.scale ?? { x: 1, y: 1, z: 1 }
  const color = component.material?.color ?? catalogItem?.fallbackColor ?? '#dbe7df'
  const assetSource = resolveComponentAssetSource(catalogItem?.assetKey, catalogItem?.assetUrl)

  return (
    <group
      ref={ref}
      position={[component.position.x, component.position.y, component.position.z]}
      rotation={[component.rotation.x, component.rotation.y, component.rotation.z]}
      scale={[scale.x, scale.y, scale.z]}
      onClick={(event) => {
        event.stopPropagation()
        onSelect()
      }}
    >
      {assetSource ? (
        <ComponentAssetErrorBoundary fallback={<ComponentFallbackBox size={size} color={color} selected={selected} />} resetKey={assetSource.url}>
          <Suspense fallback={<ComponentFallbackBox size={size} color={color} selected={selected} muted />}>
            <ComponentGltfAsset url={assetSource.url} size={size} selected={selected} />
          </Suspense>
        </ComponentAssetErrorBoundary>
      ) : (
        <ComponentFallbackBox size={size} color={color} selected={selected} />
      )}
    </group>
  )
})

function ComponentFallbackBox({ size, color, selected, muted = false }: { size: SceneComponent['size']; color: string; selected: boolean; muted?: boolean }) {
  const safeSize = size ?? { x: 0.46, y: 0.28, z: 0.14 }
  return (
    <mesh>
      <boxGeometry args={[safeSize.x, safeSize.y, safeSize.z]} />
      <meshStandardMaterial color={color} roughness={0.75} transparent={muted} opacity={muted ? 0.42 : 1} />
      <Edges color={selected ? '#d96d5f' : '#332d26'} linewidth={selected ? 3 : 1.6} />
    </mesh>
  )
}

function ComponentGltfAsset({ url, size, selected }: { url: string; size: NonNullable<SceneComponent['size']>; selected: boolean }) {
  const gltf = useLoader(GLTFLoader, url)
  const { scene, offset, scale } = useMemo(() => normalizeGltfScene(gltf.scene, size), [gltf.scene, size])

  return (
    <>
      <primitive object={scene} position={[offset.x, offset.y, offset.z]} scale={[scale.x, scale.y, scale.z]} />
      {selected && <ComponentSelectionBounds size={size} />}
    </>
  )
}

function normalizeGltfScene(sourceScene: Object3D, size: NonNullable<SceneComponent['size']>) {
  const scene = sourceScene.clone(true)
  scene.traverse((object) => {
    if (object instanceof Mesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })

  const box = new Box3().setFromObject(scene)
  const modelSize = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const scale = {
    x: safeScale(size.x, modelSize.x),
    y: safeScale(size.y, modelSize.y),
    z: safeScale(size.z, modelSize.z),
  }

  return {
    scene,
    scale,
    offset: {
      x: -center.x * scale.x,
      y: -center.y * scale.y,
      z: -center.z * scale.z,
    },
  }
}

function safeScale(target: number, source: number) {
  if (!Number.isFinite(target) || !Number.isFinite(source) || Math.abs(source) < 0.000001) return 1
  return target / source
}

function ComponentSelectionBounds({ size }: { size: NonNullable<SceneComponent['size']> }) {
  return (
    <mesh>
      <boxGeometry args={[size.x, size.y, size.z]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      <Edges color="#d96d5f" linewidth={3} />
    </mesh>
  )
}

type ComponentAssetErrorBoundaryProps = {
  children: ReactNode
  fallback: ReactNode
  resetKey: string
}

class ComponentAssetErrorBoundary extends Component<ComponentAssetErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidUpdate(previousProps: ComponentAssetErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}
