import type { ConstructionDrawingSet } from '../../domain/scene/constructionDrawings'
import { formatConstructionDimension, formatPrice } from '../../domain/scene/constructionDrawings'

export function printConstructionDrawings() {
  window.print()
}

export function downloadAllSheetSvgs(projectName: string) {
  const printSheetSvgs = Array.from(document.querySelectorAll<SVGSVGElement>('.construction-print-sheets .construction-sheet-svg'))
  const svgElements = printSheetSvgs.length > 0 ? printSheetSvgs : uniqueSheetSvgs(Array.from(document.querySelectorAll<SVGSVGElement>('.construction-sheet-svg')))
  svgElements.forEach((svg, index) => {
    const sheetName = svg.getAttribute('data-sheet-title') ?? `sheet-${index + 1}`
    downloadTextFile(`${safeFileName(projectName)}-${safeFileName(sheetName)}.svg`, serializeSvg(svg), 'image/svg+xml;charset=utf-8')
  })
}

export function downloadBomCsv(drawingSet: ConstructionDrawingSet) {
  const rows = [
    ['编号', '组件', 'Kind', '规格', '数量', '单价', '小计', '购买链接'],
    ...drawingSet.billOfMaterials.items.map((item) => [
      item.componentCodes.join(' / '),
      item.name,
      item.kind,
      formatBomSize(item.size),
      String(item.quantity),
      formatPrice(item.unitPrice),
      formatPrice(item.subtotal),
      item.purchaseUrls.join(' '),
    ]),
    [],
    ['已知合计', '', '', '', '', '', formatPrice(drawingSet.billOfMaterials.knownTotal), ''],
    ['待报价组件数', '', '', '', String(drawingSet.billOfMaterials.pendingQuoteComponentCount), '', '', ''],
  ]
  downloadTextFile(`${safeFileName(drawingSet.projectName || drawingSet.projectId)}-bom.csv`, rows.map((row) => row.map(csvCell).join(',')).join('\n'), 'text/csv;charset=utf-8')
}

function serializeSvg(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('version', '1.1')
  inlineSvgComputedStyles(svg, clone)
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`
}

const svgPresentationProperties = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'paint-order',
] as const

type SvgComputedStyleReader = Pick<CSSStyleDeclaration, 'getPropertyValue'>

export function buildSvgPresentationStyle(style: SvgComputedStyleReader) {
  return svgPresentationProperties
    .map((property) => {
      const value = style.getPropertyValue(property).trim()
      return value ? `${property}:${value}` : ''
    })
    .filter(Boolean)
    .join(';')
}

function inlineSvgComputedStyles(source: SVGSVGElement, clone: SVGSVGElement) {
  const sourceElements = [source, ...Array.from(source.querySelectorAll<SVGElement>('*'))]
  const cloneElements = [clone, ...Array.from(clone.querySelectorAll<SVGElement>('*'))]
  sourceElements.forEach((sourceElement, index) => {
    const cloneElement = cloneElements[index]
    if (!cloneElement) return
    const computedStyle = buildSvgPresentationStyle(window.getComputedStyle(sourceElement))
    if (!computedStyle) return
    const existingStyle = cloneElement.getAttribute('style')
    cloneElement.setAttribute('style', existingStyle ? `${existingStyle};${computedStyle}` : computedStyle)
  })
}

function downloadTextFile(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function safeFileName(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-') || 'construction-drawings'
}

function uniqueSheetSvgs(svgs: SVGSVGElement[]) {
  const seen = new Set<string>()
  return svgs.filter((svg, index) => {
    const id = svg.getAttribute('data-sheet-id') ?? `sheet-${index}`
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function formatBomSize(size: { x: number; y: number; z: number }) {
  if (size.x < 1 && size.y < 1 && size.z < 1) return `${Math.round(size.x * 100)}×${Math.round(size.y * 100)}×${Math.round(size.z * 100)} cm`
  return `${formatConstructionDimension(size.x)}×${formatConstructionDimension(size.y)}×${formatConstructionDimension(size.z)}`
}
