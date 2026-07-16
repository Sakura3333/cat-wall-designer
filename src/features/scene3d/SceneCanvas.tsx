import { Billboard, Edges, Line, OrbitControls, Text, TransformControls } from '@react-three/drei'
import { Canvas, useLoader, useThree, type ThreeEvent } from '@react-three/fiber'
import { Component, forwardRef, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { BufferGeometry, Camera, CanvasTexture, DoubleSide, Float32BufferAttribute, Group, Material, Mesh, MOUSE, Object3D, Plane as ThreePlane, Quaternion, Raycaster, RepeatWrapping, Shape, ShapeGeometry, Vector2, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { useEditorStore } from '../../editor/editorStore'
import { FLOOR_THICKNESS, WALL_THICKNESS } from '../../domain/geometry/planeGeometryConstants'
import { reflowRoomPlanes } from '../../domain/geometry/planeLayout'
import { buildOriginalAssetTransform, resolveComponentAssetSource } from '../../domain/scene/componentAssets'
import { getComponentCatalogItem } from '../../domain/scene/componentCatalog'
import { resolveComponentMaterialColor } from '../../domain/scene/componentParamEffects'
import { buildDistanceMeasurements, type DistanceMeasurement } from '../../domain/scene/distanceMeasurements'
import { buildForbiddenZoneFromDrag, getForbiddenZoneBounds, moveForbiddenZoneBy, updateForbiddenZoneAnchor } from '../../domain/scene/forbiddenZones'
import { planeLocalToWorld, planeSurfaceNormal, roundNumber, worldToPlaneLocal } from '../../domain/scene/planeMath'
import type { ComponentPlacementHit, ComponentPlacementSurface, ComponentPropertySchema, ComponentPropertyValue, ForbiddenZone, ForbiddenZoneShape, PlaneSpec, PlaneType, PolygonSpec, SceneComponent, Vec2, Vec3 } from '../../domain/scene/types'
import { applyComponentModelParamEffects, buildComponentRenderableBox, prepareComponentGltfScene } from './componentGltfMaterials'
import { applyConstrainedComponentTransformPreview } from './componentTransformPreview'
import { buildComponentTransformControlOptions } from './componentTransformControls'
import { isSceneSelectionClick } from './sceneSelection'

type ForbiddenZoneDraft = {
  planeId: string
  shape: ForbiddenZoneShape
  pointerId: number
  start: Vec2
  end: Vec2
}

type ActiveForbiddenZoneDrag =
  | {
      type: 'zone'
      planeId: string
      start: Vec2
      originalZone: ForbiddenZone
      previewZone: ForbiddenZone
    }
  | {
      type: 'anchor'
      planeId: string
      anchorIndex: number
      start: Vec2
      originalZone: ForbiddenZone
      previewZone: ForbiddenZone
    }

export function SceneCanvas() {
  const project = useEditorStore((state) => state.project)
  const selectedId = useEditorStore((state) => state.selectedId)
  const transformMode = useEditorStore((state) => state.transformMode)
  const forbiddenZoneDrawMode = useEditorStore((state) => state.forbiddenZoneDrawMode)
  const forbiddenZonesLocked = useEditorStore((state) => state.forbiddenZonesLocked)
  const setForbiddenZoneDrawMode = useEditorStore((state) => state.setForbiddenZoneDrawMode)
  const selectSceneObject = useEditorStore((state) => state.selectSceneObject)
  const addForbiddenZone = useEditorStore((state) => state.addForbiddenZone)
  const updateForbiddenZone = useEditorStore((state) => state.updateForbiddenZone)
  const updatePlaneTransform = useEditorStore((state) => state.updatePlaneTransform)
  const updateComponentTransform = useEditorStore((state) => state.updateComponentTransform)
  const polygonsById = useMemo(() => new Map(project.polygons.map((polygon) => [polygon.id, polygon])), [project.polygons])
  const selectedPlane = project.planes.find((plane) => plane.id === selectedId) ?? null
  const selectedComponent = project.components.find((component) => component.id === selectedId) ?? null
  const showMeasurements = project.settings.showMeasurements ?? true
  const measurements = useMemo(() => (showMeasurements ? buildDistanceMeasurements(project, selectedId) : []), [project, selectedId, showMeasurements])
  const transformControlOptions = useMemo(() => buildComponentTransformControlOptions(selectedComponent, transformMode), [selectedComponent, transformMode])
  const [selectedObject, setSelectedObject] = useState<Object3D | null>(null)
  const [zoneDraft, setZoneDraft] = useState<ForbiddenZoneDraft | null>(null)
  const [activeZoneDrag, setActiveZoneDrag] = useState<ActiveForbiddenZoneDrag | null>(null)
  const zoneDraftRef = useRef<ForbiddenZoneDraft | null>(null)
  const activeZoneDragRef = useRef<ActiveForbiddenZoneDrag | null>(null)
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
    if (!selectedPlane && !selectedComponent) setSelectedObject(null)
  }, [selectedComponent, selectedPlane])

  useEffect(() => {
    zoneDraftRef.current = zoneDraft
  }, [zoneDraft])

  useEffect(() => {
    activeZoneDragRef.current = activeZoneDrag
  }, [activeZoneDrag])

  useEffect(() => {
    const handlePointerUp = () => {
      finalizeZoneDraft()
    }
    const handlePointerCancel = () => {
      if (!zoneDraftRef.current) return
      zoneDraftRef.current = null
      setZoneDraft(null)
      setForbiddenZoneDrawMode('select')
    }

    window.addEventListener('pointerup', handlePointerUp, { capture: true })
    window.addEventListener('pointercancel', handlePointerCancel, { capture: true })
    return () => {
      window.removeEventListener('pointerup', handlePointerUp, { capture: true })
      window.removeEventListener('pointercancel', handlePointerCancel, { capture: true })
    }
  }, [addForbiddenZone, setForbiddenZoneDrawMode])

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

  function constrainSelectedTransformPreview() {
    if (selectedPlane) {
      constrainSelectedPlanePreview()
      return
    }
    constrainSelectedComponentPreview()
  }

  function constrainSelectedPlanePreview() {
    if (!selectedObject || !selectedPlane) return
    const previewPlane: PlaneSpec = {
      ...selectedPlane,
      position: { x: selectedObject.position.x, y: selectedObject.position.y, z: selectedObject.position.z },
      rotation: { x: selectedObject.rotation.x, y: selectedObject.rotation.y, z: selectedObject.rotation.z },
    }
    const constrainedPlane = reflowRoomPlanes(project.planes.map((plane) => (plane.id === selectedPlane.id ? previewPlane : plane))).find((plane) => plane.id === selectedPlane.id)
    if (!constrainedPlane) return
    selectedObject.position.set(constrainedPlane.position.x, constrainedPlane.position.y, constrainedPlane.position.z)
    selectedObject.rotation.set(constrainedPlane.rotation.x, constrainedPlane.rotation.y, constrainedPlane.rotation.z)
  }

  function constrainSelectedComponentPreview() {
    if (!selectedObject || !selectedComponent) return
    const previewComponent = previewComponentRef.current?.id === selectedComponent.id ? previewComponentRef.current : selectedComponent
    previewComponentRef.current = applyConstrainedComponentTransformPreview(selectedObject, previewComponent, project.planes, project.forbiddenZones)
  }

  const draftForbiddenZone = useMemo(
    () =>
      zoneDraft
        ? buildForbiddenZoneFromDrag({
            id: 'forbidden-zone-draft',
            name: '绘制中',
            planeId: zoneDraft.planeId,
            shape: zoneDraft.shape,
            start: zoneDraft.start,
            end: zoneDraft.end,
          })
        : null,
    [zoneDraft],
  )
  const renderedForbiddenZones = useMemo(() => {
    if (!activeZoneDrag) return project.forbiddenZones
    return project.forbiddenZones.map((zone) => (zone.id === activeZoneDrag.previewZone.id ? activeZoneDrag.previewZone : zone))
  }, [activeZoneDrag, project.forbiddenZones])
  const forbiddenZoneSelectable = forbiddenZoneDrawMode === 'select' && !zoneDraft
  const forbiddenZoneEditable = forbiddenZoneSelectable && !forbiddenZonesLocked
  const zoneInteractionActive = forbiddenZoneDrawMode !== 'select' || Boolean(zoneDraft) || Boolean(activeZoneDrag)

  function handlePlanePointerDown(plane: PlaneSpec, event: ThreeEvent<PointerEvent>) {
    if (forbiddenZoneDrawMode !== 'rectangle' && forbiddenZoneDrawMode !== 'ellipse') return
    event.stopPropagation()
    if (zoneDraftRef.current) {
      finalizeZoneDraft()
      return
    }
    capturePointer(event)
    const local = pointerEventToPlaneLocal(event, plane, sceneGroupRef.current)
    const draft: ForbiddenZoneDraft = {
      planeId: plane.id,
      shape: forbiddenZoneDrawMode === 'rectangle' ? 'polygon' : 'ellipse',
      pointerId: event.pointerId,
      start: local,
      end: local,
    }
    zoneDraftRef.current = draft
    setZoneDraft(draft)
  }

  function handlePlanePointerMove(plane: PlaneSpec, event: ThreeEvent<PointerEvent>) {
    const draft = zoneDraftRef.current
    if (draft?.planeId === plane.id && draft.pointerId === event.pointerId) {
      event.stopPropagation()
      const nextDraft = { ...draft, end: pointerEventToPlaneLocal(event, plane, sceneGroupRef.current) }
      zoneDraftRef.current = nextDraft
      setZoneDraft(nextDraft)
      return
    }
    updateActiveZoneDragPreview(plane, event)
  }

  function handlePlanePointerUp(plane: PlaneSpec, event: ThreeEvent<PointerEvent>) {
    const draft = zoneDraftRef.current
    if (draft?.planeId === plane.id && draft.pointerId === event.pointerId) {
      event.stopPropagation()
      releasePointer(event)
      finalizeZoneDraft()
      return
    }
    commitActiveZoneDrag(plane, event)
  }

  function finalizeZoneDraft() {
    const draft = zoneDraftRef.current
    if (!draft) return
    zoneDraftRef.current = null
    addForbiddenZone(draft.planeId, draft.shape, draft.start, draft.end)
    setZoneDraft(null)
    setForbiddenZoneDrawMode('select')
  }

  function handleZonePointerDown(zone: ForbiddenZone, plane: PlaneSpec, event: ThreeEvent<PointerEvent>) {
    if (forbiddenZoneDrawMode !== 'select' || forbiddenZonesLocked) return
    event.stopPropagation()
    capturePointer(event)
    selectSceneObject(zone.id)
    setActiveZoneDrag({
      type: 'zone',
      planeId: plane.id,
      start: pointerEventToPlaneLocal(event, plane, sceneGroupRef.current),
      originalZone: zone,
      previewZone: zone,
    })
  }

  function handleZoneAnchorPointerDown(zone: ForbiddenZone, plane: PlaneSpec, anchorIndex: number, event: ThreeEvent<PointerEvent>) {
    if (forbiddenZoneDrawMode !== 'select' || forbiddenZonesLocked) return
    event.stopPropagation()
    capturePointer(event)
    selectSceneObject(zone.id)
    setActiveZoneDrag({
      type: 'anchor',
      planeId: plane.id,
      anchorIndex,
      start: pointerEventToPlaneLocal(event, plane, sceneGroupRef.current),
      originalZone: zone,
      previewZone: zone,
    })
  }

  function updateActiveZoneDragPreview(plane: PlaneSpec, event: ThreeEvent<PointerEvent>) {
    if (!activeZoneDrag || activeZoneDrag.planeId !== plane.id) return
    event.stopPropagation()
    const local = pointerEventToPlaneLocal(event, plane, sceneGroupRef.current)
    setActiveZoneDrag((current) => {
      if (!current || current.planeId !== plane.id) return current
      const previewZone =
        current.type === 'zone'
          ? moveForbiddenZoneBy(current.originalZone, {
              x: local.x - current.start.x,
              y: local.y - current.start.y,
            })
          : updateForbiddenZoneAnchor(current.originalZone, current.anchorIndex, local)
      return { ...current, previewZone }
    })
  }

  function commitActiveZoneDrag(plane: PlaneSpec, event: ThreeEvent<PointerEvent>) {
    if (!activeZoneDrag || activeZoneDrag.planeId !== plane.id) return
    event.stopPropagation()
    if (forbiddenZoneChanged(activeZoneDrag.originalZone, activeZoneDrag.previewZone)) {
      updateForbiddenZone(activeZoneDrag.previewZone.id, activeZoneDrag.previewZone)
    }
    setActiveZoneDrag(null)
    releasePointer(event)
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
                selectionDisabled={zoneInteractionActive}
                onForbiddenZonePointerDown={handlePlanePointerDown}
                onForbiddenZonePointerMove={handlePlanePointerMove}
                onForbiddenZonePointerUp={handlePlanePointerUp}
              />
            )
          })}
          <ForbiddenZoneLayer
            zones={renderedForbiddenZones}
            draftZone={draftForbiddenZone}
            planes={project.planes}
            selectedId={selectedId}
            selectable={forbiddenZoneSelectable}
            editable={forbiddenZoneEditable}
            locked={forbiddenZonesLocked}
            onSelect={selectSceneObject}
            onZonePointerDown={handleZonePointerDown}
            onZonePointerMove={updateActiveZoneDragPreview}
            onZonePointerUp={commitActiveZoneDrag}
            onAnchorPointerDown={handleZoneAnchorPointerDown}
          />
          {project.components.map((component) => (
            <ComponentMesh
              key={component.id}
              component={component}
              selected={selectedId === component.id}
              ref={selectedId === component.id ? setSelectedObject : undefined}
              onSelect={() => selectSceneObject(component.id)}
            />
          ))}
          <DistanceMeasurementLayer measurements={measurements} />
        </group>
        <PlacementResolver sceneGroupRef={sceneGroupRef} />
        {selectedObject && (selectedPlane || selectedComponent) && (
          <TransformControls
            object={selectedObject}
            mode={transformMode === 'rotate' ? 'rotate' : 'translate'}
            enabled={transformMode !== 'select'}
            space={transformControlOptions.space}
            showX={transformControlOptions.showX}
            showY={transformControlOptions.showY}
            showZ={transformControlOptions.showZ}
            onObjectChange={constrainSelectedTransformPreview}
            onMouseUp={commitSelectedTransform}
          />
        )}
      </Suspense>
      <OrbitControls
        enabled={transformMode === 'select' && forbiddenZoneDrawMode === 'select' && !zoneDraft && !activeZoneDrag}
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
  selectionDisabled?: boolean
  onForbiddenZonePointerDown?: (plane: PlaneSpec, event: ThreeEvent<PointerEvent>) => void
  onForbiddenZonePointerMove?: (plane: PlaneSpec, event: ThreeEvent<PointerEvent>) => void
  onForbiddenZonePointerUp?: (plane: PlaneSpec, event: ThreeEvent<PointerEvent>) => void
}

const PlaneMesh = forwardRef<Mesh, PlaneMeshProps>(function PlaneMesh({ plane, polygon, selected, onSelect, selectionDisabled = false, onForbiddenZonePointerDown, onForbiddenZonePointerMove, onForbiddenZonePointerUp }, ref) {
  const geometry = useMemo(() => buildThickPlaneGeometry(plane.width, plane.height, plane.type === 'floor' ? FLOOR_THICKNESS : WALL_THICKNESS, polygon?.uv), [plane.width, plane.height, plane.type, polygon?.uv])

  return (
    <mesh
      ref={ref}
      userData={{ kind: 'plane', planeId: plane.id, planeType: plane.type }}
      position={[plane.position.x, plane.position.y, plane.position.z]}
      rotation={[plane.rotation.x, plane.rotation.y, plane.rotation.z]}
      onPointerDown={(event) => onForbiddenZonePointerDown?.(plane, event)}
      onPointerMove={(event) => onForbiddenZonePointerMove?.(plane, event)}
      onPointerUp={(event) => onForbiddenZonePointerUp?.(plane, event)}
      onClick={(event) => {
        event.stopPropagation()
        if (selectionDisabled || !isSceneSelectionClick(event.delta)) return
        onSelect()
      }}
    >
      <primitive attach="geometry" object={geometry} />
      <ProceduralPlaneMaterial type={plane.type} width={plane.width} height={plane.height} />
      <Edges color={selected ? '#d96d5f' : '#332d26'} linewidth={selected ? 3 : 2} />
    </mesh>
  )
})

type ForbiddenZoneLayerProps = {
  zones: ForbiddenZone[]
  draftZone: ForbiddenZone | null
  planes: PlaneSpec[]
  selectedId: string | null
  selectable: boolean
  editable: boolean
  locked: boolean
  onSelect: (id: string) => void
  onZonePointerDown: (zone: ForbiddenZone, plane: PlaneSpec, event: ThreeEvent<PointerEvent>) => void
  onZonePointerMove: (plane: PlaneSpec, event: ThreeEvent<PointerEvent>) => void
  onZonePointerUp: (plane: PlaneSpec, event: ThreeEvent<PointerEvent>) => void
  onAnchorPointerDown: (zone: ForbiddenZone, plane: PlaneSpec, anchorIndex: number, event: ThreeEvent<PointerEvent>) => void
}

function ForbiddenZoneLayer({ zones, draftZone, planes, selectedId, selectable, editable, locked, onSelect, onZonePointerDown, onZonePointerMove, onZonePointerUp, onAnchorPointerDown }: ForbiddenZoneLayerProps) {
  const planeMap = useMemo(() => new Map(planes.map((plane) => [plane.id, plane])), [planes])
  const visibleZones = draftZone ? [...zones, draftZone] : zones

  return (
    <group renderOrder={42}>
      {visibleZones.map((zone) => {
        const plane = planeMap.get(zone.planeId)
        if (!plane) return null
        const draft = zone.id === 'forbidden-zone-draft'
        return (
          <ForbiddenZoneMesh
            key={zone.id}
            zone={zone}
            plane={plane}
            selected={selectedId === zone.id}
            draft={draft}
            selectable={selectable && !draft}
            editable={editable && !draft}
            locked={locked && !draft}
            onSelect={onSelect}
            onZonePointerDown={onZonePointerDown}
            onZonePointerMove={onZonePointerMove}
            onZonePointerUp={onZonePointerUp}
            onAnchorPointerDown={onAnchorPointerDown}
          />
        )
      })}
    </group>
  )
}

type ForbiddenZoneMeshProps = {
  zone: ForbiddenZone
  plane: PlaneSpec
  selected: boolean
  draft: boolean
  selectable: boolean
  editable: boolean
  locked: boolean
  onSelect: (id: string) => void
  onZonePointerDown: (zone: ForbiddenZone, plane: PlaneSpec, event: ThreeEvent<PointerEvent>) => void
  onZonePointerMove: (plane: PlaneSpec, event: ThreeEvent<PointerEvent>) => void
  onZonePointerUp: (plane: PlaneSpec, event: ThreeEvent<PointerEvent>) => void
  onAnchorPointerDown: (zone: ForbiddenZone, plane: PlaneSpec, anchorIndex: number, event: ThreeEvent<PointerEvent>) => void
}

function ForbiddenZoneMesh({ zone, plane, selected, draft, selectable, editable, locked, onSelect, onZonePointerDown, onZonePointerMove, onZonePointerUp, onAnchorPointerDown }: ForbiddenZoneMeshProps) {
  const geometry = useMemo(() => buildForbiddenZoneGeometry(zone), [zone])
  const surfaceZ = forbiddenZoneSurfaceZ(plane) + (draft ? 0.012 : 0.008)
  const outlinePoints = useMemo(() => buildForbiddenZoneOutlinePoints(zone, surfaceZ + 0.006), [surfaceZ, zone])
  const hatchLines = useMemo(() => buildForbiddenZoneHatchLines(zone, surfaceZ + 0.026), [surfaceZ, zone])
  const zoneCenter = useMemo(() => forbiddenZoneVisualCenter(zone), [zone])
  const zoneSize = useMemo(() => forbiddenZoneVisualSize(zone), [zone])
  const lockCenter = useMemo(() => forbiddenZoneLockCenter(zone), [zone])
  const anchorPoints = zone.shape === 'polygon' ? (zone.points ?? []) : []
  const fillColor = draft ? '#367aa7' : '#d96d5f'
  const lineColor = selected ? '#8a3930' : '#332d26'
  const labelSize = Math.max(0.09, Math.min(0.18, Math.min(zoneSize.x, zoneSize.y) * 0.34))
  const handlePointerDown = selectable
    ? (event: ThreeEvent<PointerEvent>) => {
        if (editable) {
          onZonePointerDown(zone, plane, event)
          return
        }
        event.stopPropagation()
      }
    : undefined

  return (
    <group position={[plane.position.x, plane.position.y, plane.position.z]} rotation={[plane.rotation.x, plane.rotation.y, plane.rotation.z]}>
      <mesh
        geometry={geometry}
        position={[0, 0, surfaceZ]}
        renderOrder={43}
        onPointerDown={handlePointerDown}
        onPointerMove={editable ? (event) => onZonePointerMove(plane, event) : undefined}
        onPointerUp={editable ? (event) => onZonePointerUp(plane, event) : undefined}
        onClick={
          selectable
            ? (event) => {
                event.stopPropagation()
                if (!isSceneSelectionClick(event.delta)) return
                onSelect(zone.id)
              }
            : undefined
        }
      >
        <meshBasicMaterial color={fillColor} transparent opacity={draft ? 0.18 : 0.24} depthTest={false} depthWrite={false} side={DoubleSide} />
      </mesh>
      {hatchLines.map((points, index) => (
        <Line key={`${zone.id}-hatch-${index}`} points={points} color="#7f2b25" lineWidth={2.1} transparent opacity={draft ? 0.5 : 0.74} depthTest={false} renderOrder={45} />
      ))}
      <Line points={outlinePoints} color={lineColor} lineWidth={selected ? 3.2 : 2.2} transparent opacity={0.98} depthTest={false} renderOrder={44} />
      <Text position={[zoneCenter.x, zoneCenter.y, surfaceZ + 0.025]} renderOrder={46} fontSize={labelSize} color="#8a3930" anchorX="center" anchorY="middle" outlineWidth={0.007} outlineColor="#fff9ef" onSync={keepMeasurementTextOnTop}>
        禁
      </Text>
      {locked && <ForbiddenZoneLockGlyph center={lockCenter} size={Math.max(0.08, Math.min(0.14, Math.min(zoneSize.x, zoneSize.y) * 0.24))} z={surfaceZ + 0.034} />}
      {selected &&
        editable &&
        anchorPoints.map((point, index) => (
          <mesh
            key={`${zone.id}-anchor-${index}`}
            position={[point.x, point.y, surfaceZ + 0.018]}
            renderOrder={45}
            onPointerDown={(event) => onAnchorPointerDown(zone, plane, index, event)}
            onPointerMove={(event) => onZonePointerMove(plane, event)}
            onPointerUp={(event) => onZonePointerUp(plane, event)}
          >
            <sphereGeometry args={[0.038, 16, 16]} />
            <meshBasicMaterial color="#fff9ef" depthTest={false} depthWrite={false} />
          </mesh>
        ))}
    </group>
  )
}

function ForbiddenZoneLockGlyph({ center, size, z }: { center: Vec2; size: number; z: number }) {
  const bodyTop = center.y - size * 0.08
  const bodyBottom = center.y - size * 0.54
  const bodyLeft = center.x - size * 0.42
  const bodyRight = center.x + size * 0.42
  const shackleTop = center.y + size * 0.5
  const shackleBottom = center.y - size * 0.05
  const shackleLeft = center.x - size * 0.28
  const shackleRight = center.x + size * 0.28
  const body: Array<[number, number, number]> = [
    [bodyLeft, bodyTop, z],
    [bodyRight, bodyTop, z],
    [bodyRight, bodyBottom, z],
    [bodyLeft, bodyBottom, z],
    [bodyLeft, bodyTop, z],
  ]
  const shackle: Array<[number, number, number]> = [
    [shackleLeft, shackleBottom, z],
    [shackleLeft, center.y + size * 0.28, z],
    [center.x, shackleTop, z],
    [shackleRight, center.y + size * 0.28, z],
    [shackleRight, shackleBottom, z],
  ]

  return (
    <group renderOrder={47}>
      <mesh position={[center.x, center.y - size * 0.31, z - 0.002]} renderOrder={46}>
        <boxGeometry args={[size * 0.84, size * 0.48, 0.002]} />
        <meshBasicMaterial color="#fff9ef" transparent opacity={0.82} depthTest={false} depthWrite={false} />
      </mesh>
      <Line points={body} color="#332d26" lineWidth={2} transparent opacity={0.92} depthTest={false} renderOrder={47} />
      <Line points={shackle} color="#332d26" lineWidth={2} transparent opacity={0.92} depthTest={false} renderOrder={47} />
    </group>
  )
}

function DistanceMeasurementLayer({ measurements }: { measurements: DistanceMeasurement[] }) {
  return (
    <group renderOrder={30}>
      {measurements.map((measurement) => {
        const color = measurementColor(measurement.kind)
        return (
          <group key={measurement.id}>
            <Line
              points={[
                [measurement.start.x, measurement.start.y, measurement.start.z],
                [measurement.end.x, measurement.end.y, measurement.end.z],
              ]}
              color={color}
              lineWidth={2.4}
              transparent
              opacity={0.95}
              depthTest={false}
            />
            <MeasurementLabel measurement={measurement} />
          </group>
        )
      })}
    </group>
  )
}

function MeasurementLabel({ measurement }: { measurement: DistanceMeasurement }) {
  return (
    <Billboard position={[measurement.labelPosition.x, measurement.labelPosition.y, measurement.labelPosition.z]} renderOrder={80}>
      <Text renderOrder={81} fontSize={0.075} color="#302b25" anchorX="center" anchorY="middle" outlineWidth={0.008} outlineColor="#fff9ef" onSync={keepMeasurementTextOnTop}>
        {measurement.label}
      </Text>
    </Billboard>
  )
}

function keepMeasurementTextOnTop(textMesh: Mesh) {
  textMesh.renderOrder = 81
  const material = textMesh.material
  const materials = Array.isArray(material) ? material : material ? [material] : []
  materials.forEach((item) => {
    if (item instanceof Material) {
      item.depthTest = false
      item.depthWrite = false
      item.needsUpdate = true
    }
  })
}

function measurementColor(kind: DistanceMeasurement['kind']) {
  if (kind === 'component-component') return '#367aa7'
  if (kind === 'component-ground') return '#6f927f'
  return '#d96d5f'
}

function buildForbiddenZoneGeometry(zone: ForbiddenZone) {
  const shape = new Shape()
  if (zone.shape === 'ellipse') {
    const center = zone.center ?? { x: 0, y: 0 }
    shape.absellipse(center.x, center.y, Math.max(0.04, zone.radiusX ?? 0.04), Math.max(0.04, zone.radiusY ?? 0.04), 0, Math.PI * 2, false, 0)
    return new ShapeGeometry(shape, 36)
  }

  const points = zone.points?.length ? zone.points : defaultForbiddenZonePoints
  shape.moveTo(points[0].x, points[0].y)
  points.slice(1).forEach((point) => shape.lineTo(point.x, point.y))
  shape.closePath()
  return new ShapeGeometry(shape)
}

function buildForbiddenZoneOutlinePoints(zone: ForbiddenZone, z: number): Array<[number, number, number]> {
  if (zone.shape === 'ellipse') {
    const center = zone.center ?? { x: 0, y: 0 }
    const radiusX = Math.max(0.04, zone.radiusX ?? 0.04)
    const radiusY = Math.max(0.04, zone.radiusY ?? 0.04)
    return Array.from({ length: 49 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 48
      return [center.x + Math.cos(angle) * radiusX, center.y + Math.sin(angle) * radiusY, z] as [number, number, number]
    })
  }

  const points = zone.points?.length ? zone.points : defaultForbiddenZonePoints
  return [...points, points[0]].map((point) => [point.x, point.y, z] as [number, number, number])
}

function buildForbiddenZoneHatchLines(zone: ForbiddenZone, z: number): Array<Array<[number, number, number]>> {
  const bounds = getForbiddenZoneBounds(zone)
  const width = Math.max(0.001, bounds.maxX - bounds.minX)
  const height = Math.max(0.001, bounds.maxY - bounds.minY)
  const diagonalSpan = width + height
  const step = Math.max(0.045, Math.min(width, height) / 5)
  const lines: Array<Array<[number, number, number]>> = []

  for (let offset = -height; offset <= width; offset += step) {
    const samples: Vec2[] = []
    for (let index = 0; index <= 48; index += 1) {
      const t = index / 48
      const x = bounds.minX + offset + diagonalSpan * t
      const y = bounds.minY + diagonalSpan * t
      if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) continue
      const point = { x, y }
      if (pointInForbiddenZone(point, zone)) samples.push(point)
    }
    if (samples.length >= 2) {
      const first = samples[0]
      const last = samples[samples.length - 1]
      lines.push([
        [roundNumber(first.x), roundNumber(first.y), z],
        [roundNumber(last.x), roundNumber(last.y), z],
      ])
    }
  }

  return lines
}

function forbiddenZoneVisualCenter(zone: ForbiddenZone): Vec2 {
  if (zone.shape === 'ellipse') return zone.center ?? { x: 0, y: 0 }
  const bounds = getForbiddenZoneBounds(zone)
  return {
    x: roundNumber((bounds.minX + bounds.maxX) / 2),
    y: roundNumber((bounds.minY + bounds.maxY) / 2),
  }
}

function forbiddenZoneVisualSize(zone: ForbiddenZone): Vec2 {
  const bounds = getForbiddenZoneBounds(zone)
  return {
    x: roundNumber(bounds.maxX - bounds.minX),
    y: roundNumber(bounds.maxY - bounds.minY),
  }
}

function forbiddenZoneLockCenter(zone: ForbiddenZone): Vec2 {
  const center = forbiddenZoneVisualCenter(zone)
  const size = forbiddenZoneVisualSize(zone)
  return {
    x: roundNumber(center.x + size.x * 0.26),
    y: roundNumber(center.y + size.y * 0.26),
  }
}

function pointInForbiddenZone(point: Vec2, zone: ForbiddenZone) {
  if (zone.shape === 'ellipse') {
    const center = zone.center ?? { x: 0, y: 0 }
    const radiusX = Math.max(0.04, zone.radiusX ?? 0.04)
    const radiusY = Math.max(0.04, zone.radiusY ?? 0.04)
    const x = (point.x - center.x) / radiusX
    const y = (point.y - center.y) / radiusY
    return x * x + y * y <= 1
  }

  const polygon = zone.points ?? []
  if (polygon.length < 3) return false
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index]
    const b = polygon[previous]
    const crosses = a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || Number.EPSILON) + a.x
    if (crosses) inside = !inside
  }
  return inside
}

function forbiddenZoneSurfaceZ(plane: PlaneSpec) {
  return plane.type === 'floor' ? FLOOR_THICKNESS / 2 : WALL_THICKNESS / 2
}

const defaultForbiddenZonePoints: Vec2[] = [
  { x: -0.08, y: -0.08 },
  { x: 0.08, y: -0.08 },
  { x: 0.08, y: 0.08 },
  { x: -0.08, y: 0.08 },
]

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

function pointerEventToPlaneLocal(event: ThreeEvent<PointerEvent>, plane: PlaneSpec, sceneGroup: Group | null): Vec2 {
  const projectedPoint = projectPointerRayToPlane(event, plane, sceneGroup) ?? event.point.clone()
  const point = sceneGroup ? sceneGroup.worldToLocal(projectedPoint.clone()) : projectedPoint
  const local = worldToPlaneLocal(toVec3(point), plane)
  return {
    x: roundNumber(local.x),
    y: roundNumber(local.y),
  }
}

function projectPointerRayToPlane(event: ThreeEvent<PointerEvent>, plane: PlaneSpec, sceneGroup: Group | null) {
  const planePoint = toVector3(planeLocalToWorld({ x: 0, y: 0, z: forbiddenZoneSurfaceZ(plane) }, plane))
  const planeNormal = toVector3(planeSurfaceNormal(plane))
  if (sceneGroup) {
    sceneGroup.localToWorld(planePoint)
    planeNormal.transformDirection(sceneGroup.matrixWorld)
  }

  return event.ray.intersectPlane(new ThreePlane().setFromNormalAndCoplanarPoint(planeNormal.normalize(), planePoint), new Vector3())
}

function capturePointer(event: ThreeEvent<PointerEvent>) {
  const target = event.target as unknown as { setPointerCapture?: (pointerId: number) => void }
  target.setPointerCapture?.(event.pointerId)
}

function releasePointer(event: ThreeEvent<PointerEvent>) {
  const target = event.target as unknown as { releasePointerCapture?: (pointerId: number) => void }
  target.releasePointerCapture?.(event.pointerId)
}

function toVector3(vector: { x: number; y: number; z: number }) {
  return new Vector3(vector.x, vector.y, vector.z)
}

function forbiddenZoneChanged(a: ForbiddenZone, b: ForbiddenZone) {
  return JSON.stringify(a) !== JSON.stringify(b)
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

function ProceduralPlaneMaterial({ type, width, height }: { type: PlaneType; width: number; height: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')
    if (context) {
      context.fillStyle = type === 'floor' ? '#d8c3a2' : '#efd5b0'
      context.fillRect(0, 0, canvas.width, canvas.height)

      const plankStep = type === 'floor' ? 42 : 24
      for (let y = 0; y < canvas.height; y += plankStep) {
        context.strokeStyle = y % (plankStep * 2) === 0 ? 'rgba(132, 95, 58, 0.14)' : 'rgba(255, 255, 255, 0.18)'
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(0, y + seededWave(y, 2))
        context.quadraticCurveTo(86, y + 3 + seededWave(y + 4, 2), 172, y - 2 + seededWave(y + 8, 2))
        context.quadraticCurveTo(216, y - 3 + seededWave(y + 12, 2), 256, y + 2 + seededWave(y + 16, 2))
        context.stroke()
      }

      for (let i = 0; i < 420; i += 1) {
        const x = seededUnit(i * 17 + 3) * canvas.width
        const y = seededUnit(i * 29 + 7) * canvas.height
        const radius = seededUnit(i * 37 + 11) * 1.7 + 0.35
        context.fillStyle = i % 3 === 0 ? 'rgba(116, 82, 49, 0.12)' : 'rgba(255, 246, 229, 0.22)'
        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fill()
      }
    }

    const texture = new CanvasTexture(canvas)
    texture.colorSpace = 'srgb'
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.repeat.set(Math.max(1, width / (type === 'floor' ? 0.82 : 0.7)), Math.max(1, height / (type === 'floor' ? 0.82 : 0.46)))
    return texture
  }, [height, type, width])

  return <meshStandardMaterial map={texture} color={type === 'floor' ? '#d6bea0' : '#f1c995'} roughness={type === 'floor' ? 0.9 : 0.96} />
}

function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function seededWave(seed: number, amplitude: number) {
  return (seededUnit(seed) - 0.5) * amplitude * 2
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
  const schema = catalogItem?.propertySchema ?? []
  const params = component.params ?? {}
  const color = resolveComponentMaterialColor(component.material?.color ?? catalogItem?.fallbackColor ?? '#dbe7df', schema, params)
  const assetSource = resolveComponentAssetSource(catalogItem?.assetKey, catalogItem?.assetUrl)

  return (
    <group
      ref={ref}
      position={[component.position.x, component.position.y, component.position.z]}
      rotation={[component.rotation.x, component.rotation.y, component.rotation.z]}
      scale={[scale.x, scale.y, scale.z]}
      onClick={(event) => {
        event.stopPropagation()
        if (!isSceneSelectionClick(event.delta)) return
        onSelect()
      }}
    >
      {assetSource ? (
        <ComponentAssetErrorBoundary fallback={(error) => <ComponentAssetFallback size={size} color={color} selected={selected} message={assetFailureMessage(error, assetSource.source)} />} resetKey={assetSource.url}>
          <Suspense fallback={<ComponentAssetFallback size={size} color={color} selected={selected} muted message="模型加载中" />}>
            <ComponentGltfAsset url={assetSource.url} size={size} assetSize={assetSource.size ?? size} selected={selected} schema={schema} params={params} />
          </Suspense>
        </ComponentAssetErrorBoundary>
      ) : (
        <ComponentFallbackBox size={size} color={color} selected={selected} />
      )}
    </group>
  )
})

function ComponentAssetFallback({ size, color, selected, muted = false, message }: { size: SceneComponent['size']; color: string; selected: boolean; muted?: boolean; message: string }) {
  return (
    <>
      <ComponentFallbackBox size={size} color={color} selected={selected} muted={muted} />
      <ComponentAssetStatus size={size} message={message} />
    </>
  )
}

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

function ComponentAssetStatus({ size, message }: { size: SceneComponent['size']; message: string }) {
  const safeSize = size ?? { x: 0.46, y: 0.28, z: 0.14 }
  return (
    <Billboard position={[0, safeSize.y / 2 + 0.12, 0]} renderOrder={82}>
      <Text renderOrder={83} fontSize={0.065} color="#8a3930" anchorX="center" anchorY="middle" outlineWidth={0.006} outlineColor="#fff9ef" onSync={keepMeasurementTextOnTop}>
        {message}
      </Text>
    </Billboard>
  )
}

function ComponentGltfAsset({
  url,
  size,
  assetSize,
  selected,
  schema,
  params,
}: {
  url: string
  size: NonNullable<SceneComponent['size']>
  assetSize: Vec3
  selected: boolean
  schema: ComponentPropertySchema[]
  params: Record<string, ComponentPropertyValue>
}) {
  const gltf = useLoader(GLTFLoader, url)
  const { scene, offset, scale } = useMemo(() => normalizeGltfScene(gltf.scene, schema, params, size, assetSize), [assetSize, gltf.scene, params, schema, size])

  return (
    <>
      <primitive object={scene} position={[offset.x, offset.y, offset.z]} scale={[scale.x, scale.y, scale.z]} />
      {selected && <ComponentSelectionBounds size={size} />}
    </>
  )
}

function normalizeGltfScene(sourceScene: Object3D, schema: ComponentPropertySchema[], params: Record<string, ComponentPropertyValue>, displaySize: Vec3, assetSize: Vec3) {
  const scene = sourceScene.clone(true)
  prepareComponentGltfScene(scene)
  applyComponentModelParamEffects(scene, schema, params)

  const box = buildComponentRenderableBox(scene)
  const center = box.getCenter(new Vector3())
  const transform = buildOriginalAssetTransform({ x: center.x, y: center.y, z: center.z })
  const scale = buildAssetDisplayScale(displaySize, assetSize)

  return {
    scene,
    scale,
    offset: {
      x: transform.offset.x * scale.x,
      y: transform.offset.y * scale.y,
      z: transform.offset.z * scale.z,
    },
  }
}

function buildAssetDisplayScale(displaySize: Vec3, assetSize: Vec3) {
  return {
    x: safeScaleRatio(displaySize.x, assetSize.x),
    y: safeScaleRatio(displaySize.y, assetSize.y),
    z: safeScaleRatio(displaySize.z, assetSize.z),
  }
}

function safeScaleRatio(displayValue: number, assetValue: number) {
  if (!Number.isFinite(displayValue) || !Number.isFinite(assetValue) || assetValue <= 0) return 1
  return displayValue / assetValue
}

function assetFailureMessage(error: unknown, source: 'builtin' | 'external') {
  const prefix = source === 'external' ? '外部模型加载失败' : '内置模型加载失败'
  const detail = error instanceof Error ? error.message.split('\n')[0] : ''
  return detail ? `${prefix}: ${detail.slice(0, 18)}` : prefix
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
  fallback: (error: unknown) => ReactNode
  resetKey: string
}

class ComponentAssetErrorBoundary extends Component<ComponentAssetErrorBoundaryProps, { hasError: boolean; error: unknown }> {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error }
  }

  componentDidUpdate(previousProps: ComponentAssetErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null })
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback(this.state.error) : this.props.children
  }
}
