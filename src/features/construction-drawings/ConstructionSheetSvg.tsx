import { formatConstructionBounds, formatConstructionDimension, type ConstructionComponentMark, type ConstructionForbiddenZoneMark, type ConstructionSheet } from '../../domain/scene/constructionDrawings'
import type { Vec2 } from '../../domain/scene/types'

const VIEWBOX_WIDTH = 960
const VIEWBOX_HEIGHT = 680
const PAD = 86

export function ConstructionSheetSvg({ sheet }: { sheet: ConstructionSheet }) {
  const scale = Math.min((VIEWBOX_WIDTH - PAD * 2) / Math.max(sheet.width, 0.01), (VIEWBOX_HEIGHT - PAD * 2) / Math.max(sheet.height, 0.01))
  const planeWidth = sheet.width * scale
  const planeHeight = sheet.height * scale
  const originX = (VIEWBOX_WIDTH - planeWidth) / 2
  const originY = (VIEWBOX_HEIGHT - planeHeight) / 2
  const toSvg = (point: Vec2) => ({
    x: originX + point.x * scale,
    y: originY + (sheet.height - point.y) * scale,
  })

  return (
    <svg className="construction-sheet-svg" data-sheet-id={sheet.id} data-sheet-title={sheet.title} viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} role="img" aria-label={sheet.title}>
      <rect width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} rx={18} fill="#fffdf8" />
      <SheetTitle sheet={sheet} />
      <g className="construction-plane">
        <rect x={originX} y={originY} width={planeWidth} height={planeHeight} fill="#fffaf1" stroke="#302b25" strokeWidth={3} />
        <DimensionLines sheet={sheet} originX={originX} originY={originY} planeWidth={planeWidth} planeHeight={planeHeight} />
        {sheet.forbiddenZones.map((zone) => (
          <ForbiddenZoneShape key={zone.id} zone={zone} sheet={sheet} toSvg={toSvg} scale={scale} />
        ))}
        {sheet.components.map((component, index) => (
          <ComponentShape key={component.id} component={component} sheet={sheet} toSvg={toSvg} scale={scale} index={index} />
        ))}
      </g>
    </svg>
  )
}

function SheetTitle({ sheet }: { sheet: ConstructionSheet }) {
  return (
    <g className="construction-sheet-title">
      <text x={36} y={44}>
        {sheet.title}
      </text>
      <text x={36} y={68}>
        {sheet.planeType === 'wall' ? '墙面正视图' : '地面正投影'} / 单位：米
      </text>
    </g>
  )
}

function DimensionLines({
  sheet,
  originX,
  originY,
  planeWidth,
  planeHeight,
}: {
  sheet: ConstructionSheet
  originX: number
  originY: number
  planeWidth: number
  planeHeight: number
}) {
  const bottomY = originY + planeHeight + 32
  const leftX = originX - 34
  return (
    <g className="construction-dimensions">
      <line x1={originX} y1={bottomY} x2={originX + planeWidth} y2={bottomY} />
      <line x1={originX} y1={bottomY - 8} x2={originX} y2={bottomY + 8} />
      <line x1={originX + planeWidth} y1={bottomY - 8} x2={originX + planeWidth} y2={bottomY + 8} />
      <text x={originX + planeWidth / 2} y={bottomY + 24} textAnchor="middle">
        宽 {formatConstructionDimension(sheet.width)}
      </text>

      <line x1={leftX} y1={originY} x2={leftX} y2={originY + planeHeight} />
      <line x1={leftX - 8} y1={originY} x2={leftX + 8} y2={originY} />
      <line x1={leftX - 8} y1={originY + planeHeight} x2={leftX + 8} y2={originY + planeHeight} />
      <text x={leftX - 16} y={originY + planeHeight / 2} textAnchor="middle" transform={`rotate(-90 ${leftX - 16} ${originY + planeHeight / 2})`}>
        高/深 {formatConstructionDimension(sheet.height)}
      </text>
    </g>
  )
}

function ForbiddenZoneShape({ zone, sheet, toSvg, scale }: { zone: ConstructionForbiddenZoneMark; sheet: ConstructionSheet; toSvg: (point: Vec2) => Vec2; scale: number }) {
  if (zone.shape === 'ellipse') {
    const center = toSvg(zone.center ?? zone.bounds.center)
    return <ellipse className="construction-forbidden-zone" cx={center.x} cy={center.y} rx={(zone.radiusX ?? 0) * scale} ry={(zone.radiusY ?? 0) * scale} />
  }

  const points = (zone.points ?? []).map(toSvg)
  if (points.length < 3) return null
  return <polygon className="construction-forbidden-zone" points={points.map((point) => `${point.x},${point.y}`).join(' ')} aria-label={`${sheet.title} ${zone.name}`} />
}

function ComponentShape({
  component,
  sheet,
  toSvg,
  scale,
  index,
}: {
  component: ConstructionComponentMark
  sheet: ConstructionSheet
  toSvg: (point: Vec2) => Vec2
  scale: number
  index: number
}) {
  const topLeft = toSvg({ x: component.bounds.minX, y: component.bounds.maxY })
  const width = (component.bounds.maxX - component.bounds.minX) * scale
  const height = (component.bounds.maxY - component.bounds.minY) * scale
  const center = toSvg(component.center)
  const horizontalLane = index % 3
  const verticalLane = Math.floor(index / 3) % 3
  const horizontalOffset = 14 + horizontalLane * 15
  const verticalOffset = 14 + verticalLane * 15
  const horizontalAbove = topLeft.y - horizontalOffset > 86
  const horizontalY = horizontalAbove ? topLeft.y - horizontalOffset : topLeft.y + height + horizontalOffset
  const verticalRight = topLeft.x + width + verticalOffset < VIEWBOX_WIDTH - 44
  const verticalX = verticalRight ? topLeft.x + width + verticalOffset : topLeft.x - verticalOffset
  const lengthLabel = `${component.code} X ${formatConstructionBounds(component.bounds, 'x')} / ${formatConstructionDimension(component.drawingSize.length)}`
  const widthLabel = `Y ${formatConstructionBounds(component.bounds, 'y')} / ${formatConstructionDimension(component.drawingSize.width)}`

  return (
    <g className={component.outsidePlane ? 'construction-component outside' : 'construction-component'}>
      <rect x={topLeft.x} y={topLeft.y} width={width} height={height} rx={5} />
      <line x1={center.x - 8} y1={center.y} x2={center.x + 8} y2={center.y} />
      <line x1={center.x} y1={center.y - 8} x2={center.x} y2={center.y + 8} />
      <circle cx={center.x} cy={center.y} r={15} />
      <text className="component-code" x={center.x} y={center.y + 5} textAnchor="middle">
        {component.code}
      </text>
      <DimensionMark
        className="component-horizontal-mark"
        x1={topLeft.x}
        y1={horizontalY}
        x2={topLeft.x + width}
        y2={horizontalY}
        label={lengthLabel}
        labelX={topLeft.x + width / 2}
        labelY={horizontalY + (horizontalAbove ? -5 : 14)}
      />
      <DimensionMark
        className="component-vertical-mark"
        x1={verticalX}
        y1={topLeft.y}
        x2={verticalX}
        y2={topLeft.y + height}
        label={widthLabel}
        labelX={verticalX + (verticalRight ? 12 : -12)}
        labelY={topLeft.y + height / 2}
        rotate
      />
    </g>
  )
}

function DimensionMark({
  className,
  x1,
  y1,
  x2,
  y2,
  label,
  labelX,
  labelY,
  rotate = false,
}: {
  className: string
  x1: number
  y1: number
  x2: number
  y2: number
  label: string
  labelX: number
  labelY: number
  rotate?: boolean
}) {
  const tickSize = 7
  return (
    <g className={`component-dimension-mark ${className}`}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {rotate ? (
        <>
          <line x1={x1 - tickSize} y1={y1} x2={x1 + tickSize} y2={y1} />
          <line x1={x2 - tickSize} y1={y2} x2={x2 + tickSize} y2={y2} />
          <text x={labelX} y={labelY} textAnchor="middle" transform={`rotate(-90 ${labelX} ${labelY})`}>
            {label}
          </text>
        </>
      ) : (
        <>
          <line x1={x1} y1={y1 - tickSize} x2={x1} y2={y1 + tickSize} />
          <line x1={x2} y1={y2 - tickSize} x2={x2} y2={y2 + tickSize} />
          <text x={labelX} y={labelY} textAnchor="middle">
            {label}
          </text>
        </>
      )}
    </g>
  )
}
