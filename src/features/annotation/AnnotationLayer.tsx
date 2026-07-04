import { PointerEvent, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '../../editor/editorStore'
import { imageToViewportPoint, viewportToImagePoint } from '../../domain/geometry/coordinate'
import { buildPerspectiveCalibration, estimatePerspectiveGuideLengthCm } from '../../domain/geometry/perspective'
import type { PerspectiveAxis, RulerSpec, Vec2 } from '../../domain/scene/types'

type DragTarget = {
  type: 'corner' | 'ruler' | 'perspective'
  id: string
  pointIndex?: 0 | 1
}

type DraftGuide = {
  start: Vec2
  end: Vec2
}

export function AnnotationLayer() {
  const layerRef = useRef<HTMLDivElement | null>(null)
  const hitboxRef = useRef<HTMLDivElement | null>(null)
  const [layerSize, setLayerSize] = useState<{ width: number; height: number } | null>(null)
  const project = useEditorStore((state) => state.project)
  const mode = useEditorStore((state) => state.mode)
  const addCorner = useEditorStore((state) => state.addCorner)
  const deleteCorner = useEditorStore((state) => state.deleteCorner)
  const moveCorner = useEditorStore((state) => state.moveCorner)
  const addRulerPoint = useEditorStore((state) => state.addRulerPoint)
  const moveRulerPoint = useEditorStore((state) => state.moveRulerPoint)
  const updateRulerLength = useEditorStore((state) => state.updateRulerLength)
  const addPerspectiveGuide = useEditorStore((state) => state.addPerspectiveGuide)
  const movePerspectiveGuidePoint = useEditorStore((state) => state.movePerspectiveGuidePoint)
  const deletePerspectiveGuide = useEditorStore((state) => state.deletePerspectiveGuide)
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null)
  const [draftGuide, setDraftGuide] = useState<DraftGuide | null>(null)
  const [selectedCornerId, setSelectedCornerId] = useState<string | null>(null)
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null)

  useLayoutEffect(() => {
    const observedLayer = layerRef.current
    if (!observedLayer) return
    const layerElement: HTMLDivElement = observedLayer

    function syncLayerSize() {
      const rect = layerElement.getBoundingClientRect()
      setLayerSize((current) => {
        const width = Math.round(rect.width)
        const height = Math.round(rect.height)
        return current?.width === width && current.height === height ? current : { width, height }
      })
    }

    syncLayerSize()
    const observer = new ResizeObserver(syncLayerSize)
    observer.observe(layerElement)
    return () => observer.disconnect()
  }, [project.sourceImage])

  const imageViewport = useMemo(
    () => (project.sourceImage && layerSize ? getContainedImageBox(project.sourceImage, layerSize) : null),
    [layerSize, project.sourceImage],
  )
  const rulerScale = getRulerScale(project.ruler)
  const perspectiveCalibration = useMemo(
    () => project.perspectiveCalibration ?? buildPerspectiveCalibration(project.sourceImage, project.perspectiveGuides).calibration,
    [project.perspectiveCalibration, project.perspectiveGuides, project.sourceImage],
  )

  if (!project.sourceImage) return null

  function getPoint(event: PointerEvent): Vec2 | null {
    const hitbox = hitboxRef.current
    const sourceImage = project.sourceImage
    if (!hitbox || !sourceImage) return null
    const rect = hitbox.getBoundingClientRect()
    return viewportToImagePoint(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      sourceImage,
      { width: rect.width, height: rect.height },
    )
  }

  function handleLayerPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    setSelectedCornerId(null)
    setSelectedGuideId(null)
    const point = getPoint(event)
    if (!point) return
    if (mode === 'marking-ruler') {
      addRulerPoint(point)
      return
    }
    if (mode === 'marking-perspective') {
      event.currentTarget.setPointerCapture(event.pointerId)
      setDraftGuide({ start: point, end: point })
      return
    }
    addCorner(point)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const point = getPoint(event)
    if (!point) return
    if (draftGuide) {
      setDraftGuide({ ...draftGuide, end: point })
      return
    }
    if (!dragTarget) return
    if (dragTarget.type === 'perspective' && dragTarget.pointIndex !== undefined) {
      movePerspectiveGuidePoint(dragTarget.id, dragTarget.pointIndex, point)
      return
    }
    if (dragTarget.type === 'ruler') {
      moveRulerPoint(dragTarget.id, point)
      return
    }
    moveCorner(dragTarget.id, point)
  }

  function finishPointer(event: PointerEvent<HTMLDivElement>) {
    if (draftGuide && distance(draftGuide.start, draftGuide.end) > 16) {
      addPerspectiveGuide(draftGuide.start, draftGuide.end)
    }
    if (draftGuide && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setDraftGuide(null)
    setDragTarget(null)
  }

  return (
    <div ref={layerRef} className="annotation-layer">
      <img className="source-photo" src={project.sourceImage.url} alt="上传的室内图" />
      {imageViewport && (
        <div
          ref={hitboxRef}
          className="annotation-hitbox"
          style={{
            left: imageViewport.x,
            top: imageViewport.y,
            width: imageViewport.width,
            height: imageViewport.height,
          }}
          onPointerDown={handleLayerPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointer}
          onPointerLeave={finishPointer}
        >
      {project.corners.map((corner, index) => {
        const point =
          imageViewport && project.sourceImage
            ? imageToViewportPoint(corner, project.sourceImage, imageViewport)
            : { x: 0, y: 0 }
        return (
          <div className="corner-control" key={corner.id} style={{ left: point.x, top: point.y }}>
            <button
              className={selectedCornerId === corner.id ? 'corner-pin selected' : 'corner-pin'}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setSelectedCornerId(corner.id)
              }}
              onPointerDown={(event) => {
                event.stopPropagation()
                setDragTarget({ type: 'corner', id: corner.id })
              }}
              aria-label={`角点 ${index + 1}`}
            >
              {index + 1}
            </button>
            {selectedCornerId === corner.id && (
              <button
                className="corner-delete"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  deleteCorner(corner.id)
                  setSelectedCornerId(null)
                }}
                onPointerDown={(event) => event.stopPropagation()}
                aria-label={`删除角点 ${index + 1}`}
              >
                删除
              </button>
            )}
          </div>
        )
      })}
      <svg className="annotation-lines" aria-hidden="true">
        {project.corners.map((corner, index) => {
          if (!imageViewport || !project.sourceImage) return null
          const groupStart = Math.floor(index / 4) * 4
          const groupIndex = index % 4
          const groupComplete = project.corners.length >= groupStart + 4
          const next = groupIndex === 3 ? (groupComplete ? project.corners[groupStart] : null) : project.corners[index + 1]
          if (!next) return null
          const a = imageToViewportPoint(corner, project.sourceImage, imageViewport)
          const b = imageToViewportPoint(next, project.sourceImage, imageViewport)
          const length = rulerScale ? Math.round(distance(corner, next) * rulerScale) : null
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
          return (
            <g key={`${corner.id}-${next.id}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              {length !== null && (
                <text className="segment-length-label" x={mid.x} y={mid.y - 8}>
                  {length} cm
                </text>
              )}
            </g>
          )
        })}
        {project.ruler?.points.length === 2 && imageViewport && project.sourceImage
          ? (() => {
              const a = imageToViewportPoint(project.ruler.points[0], project.sourceImage!, imageViewport)
              const b = imageToViewportPoint(project.ruler.points[1], project.sourceImage!, imageViewport)
              return <line className="ruler-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            })()
          : null}
        {project.perspectiveGuides.map((guide) => {
          if (!imageViewport || !project.sourceImage) return null
          const a = imageToViewportPoint(guide.points[0], project.sourceImage, imageViewport)
          const b = imageToViewportPoint(guide.points[1], project.sourceImage, imageViewport)
          const lengthCm = estimatePerspectiveGuideLengthCm(guide, project.ruler, perspectiveCalibration)
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
          return (
            <g key={guide.id}>
              <line className={`perspective-line ${guide.axis}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              {lengthCm !== null && (
                <text className={`perspective-length-label ${guide.axis}`} x={mid.x} y={mid.y - 12}>
                  {formatLength(lengthCm)}
                </text>
              )}
            </g>
          )
        })}
        {draftGuide && imageViewport && project.sourceImage
          ? (() => {
              const a = imageToViewportPoint(draftGuide.start, project.sourceImage!, imageViewport)
              const b = imageToViewportPoint(draftGuide.end, project.sourceImage!, imageViewport)
              return <line className="perspective-line draft" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            })()
          : null}
      </svg>
      {project.perspectiveGuides.map((guide, guideIndex) => {
        if (!imageViewport || !project.sourceImage) return null
        return guide.points.map((point, pointIndex) => {
          const viewportPoint = imageToViewportPoint(point, project.sourceImage!, imageViewport)
          return (
            <button
              className={`perspective-pin ${guide.axis}${selectedGuideId === guide.id ? ' selected' : ''}`}
              key={`${guide.id}-${pointIndex}`}
              style={{ left: viewportPoint.x, top: viewportPoint.y }}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setSelectedGuideId(guide.id)
              }}
              onPointerDown={(event) => {
                event.stopPropagation()
                setDragTarget({ type: 'perspective', id: guide.id, pointIndex: pointIndex as 0 | 1 })
              }}
              aria-label={`${axisLabel(guide.axis)}透视线 ${guideIndex + 1} 端点 ${pointIndex + 1}`}
            >
              {pointIndex + 1}
            </button>
          )
        })
      })}
      {selectedGuideId
        ? (() => {
            const guide = project.perspectiveGuides.find((item) => item.id === selectedGuideId)
            if (!guide || !imageViewport || !project.sourceImage) return null
            const a = imageToViewportPoint(guide.points[0], project.sourceImage, imageViewport)
            const b = imageToViewportPoint(guide.points[1], project.sourceImage, imageViewport)
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
            return (
              <button
                className="guide-delete"
                type="button"
                style={{ left: mid.x, top: mid.y }}
                onClick={(event) => {
                  event.stopPropagation()
                  deletePerspectiveGuide(guide.id)
                  setSelectedGuideId(null)
                }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                删除{axisLabel(guide.axis)}线
              </button>
            )
          })()
        : null}
      {project.ruler?.points.map((point, index) => {
        const viewportPoint =
          imageViewport && project.sourceImage
            ? imageToViewportPoint(point, project.sourceImage, imageViewport)
            : { x: 0, y: 0 }
        return (
          <button
            className="ruler-pin"
            key={point.id}
            style={{ left: viewportPoint.x, top: viewportPoint.y }}
            type="button"
            onPointerDown={(event) => {
              event.stopPropagation()
              setDragTarget({ type: 'ruler', id: point.id })
            }}
            aria-label={`标尺点 ${index + 1}`}
          >
            {index + 1}
          </button>
        )
      })}
      {project.ruler?.points.length === 2 && imageViewport && project.sourceImage
        ? (() => {
            const a = imageToViewportPoint(project.ruler.points[0], project.sourceImage!, imageViewport)
            const b = imageToViewportPoint(project.ruler.points[1], project.sourceImage!, imageViewport)
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
            return (
              <label className="ruler-length-control" style={{ left: mid.x, top: mid.y }}>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={project.ruler.lengthCm}
                  onChange={(event) => updateRulerLength(Number(event.target.value))}
                  onPointerDown={(event) => event.stopPropagation()}
                />
                <span>cm</span>
              </label>
            )
          })()
        : null}
        </div>
      )}
    </div>
  )
}

function getContainedImageBox(imageSize: { width: number; height: number }, viewportSize: { width: number; height: number }) {
  const imageRatio = imageSize.width / imageSize.height
  const viewportRatio = viewportSize.width / viewportSize.height
  if (imageRatio > viewportRatio) {
    const width = viewportSize.width
    const height = width / imageRatio
    return { width, height, x: 0, y: (viewportSize.height - height) / 2 }
  }

  const height = viewportSize.height
  const width = height * imageRatio
  return { width, height, x: (viewportSize.width - width) / 2, y: 0 }
}

function getRulerScale(ruler: RulerSpec | null) {
  if (!ruler || ruler.points.length !== 2 || ruler.lengthCm <= 0) return null
  const pixelLength = distance(ruler.points[0], ruler.points[1])
  if (pixelLength <= 0) return null
  return ruler.lengthCm / pixelLength
}

function axisLabel(axis: PerspectiveAxis) {
  return {
    left: '左向',
    right: '右向',
    vertical: '竖向',
  }[axis]
}

function formatLength(lengthCm: number) {
  if (lengthCm >= 100) return `${(lengthCm / 100).toFixed(lengthCm >= 1000 ? 1 : 2)} m`
  return `${Math.round(lengthCm)} cm`
}

function distance(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
