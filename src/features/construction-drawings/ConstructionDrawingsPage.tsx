import { ArrowLeft, Download, FileSpreadsheet, Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildConstructionDrawingSet, formatConstructionBounds, formatConstructionDimension, type ConstructionSheet } from '../../domain/scene/constructionDrawings'
import { useEditorStore } from '../../editor/editorStore'
import { loadLatestProject } from '../../persistence/projectApi'
import { BillOfMaterialsTable } from './BillOfMaterialsTable'
import { ConstructionSheetSvg } from './ConstructionSheetSvg'
import { downloadAllSheetSvgs, downloadBomCsv, printConstructionDrawings } from './constructionDrawingExport'

export function ConstructionDrawingsPage() {
  const project = useEditorStore((state) => state.project)
  const loadProject = useEditorStore((state) => state.loadProject)
  const drawingSet = useMemo(() => buildConstructionDrawingSet(project), [project])
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(drawingSet.sheets[0]?.id ?? null)
  const selectedSheet = drawingSet.sheets.find((sheet) => sheet.id === selectedSheetId) ?? drawingSet.sheets[0] ?? null

  useEffect(() => {
    if (project.planes.length > 0) return
    let cancelled = false
    void loadLatestProject().then((latestProject) => {
      if (!cancelled && latestProject) loadProject(latestProject)
    })
    return () => {
      cancelled = true
    }
  }, [loadProject, project.planes.length])

  useEffect(() => {
    if (!drawingSet.sheets.length) {
      setSelectedSheetId(null)
      return
    }
    if (!selectedSheetId || !drawingSet.sheets.some((sheet) => sheet.id === selectedSheetId)) setSelectedSheetId(drawingSet.sheets[0].id)
  }, [drawingSet.sheets, selectedSheetId])

  return (
    <main className="construction-page">
      <header className="construction-topbar">
        <Link className="manager-back" to="/">
          <ArrowLeft size={18} />
          返回编辑器
        </Link>
        <div>
          <span>CONSTRUCTION</span>
          <h1>施工图</h1>
        </div>
        <div className="manager-actions construction-actions">
          <button type="button" onClick={printConstructionDrawings} disabled={!drawingSet.sheets.length}>
            <Printer size={18} />
            打印/PDF
          </button>
          <button type="button" onClick={() => downloadAllSheetSvgs(drawingSet.projectName || drawingSet.projectId)} disabled={!drawingSet.sheets.length}>
            <Download size={18} />
            SVG
          </button>
          <button type="button" onClick={() => downloadBomCsv(drawingSet)} disabled={!drawingSet.billOfMaterials.items.length}>
            <FileSpreadsheet size={18} />
            BOM
          </button>
        </div>
      </header>

      {drawingSet.sheets.length === 0 ? (
        <section className="construction-empty">
          <strong>还没有可生成施工图的墙面或地面</strong>
          <span>先回到编辑器生成 3D 几何，再进入施工图。</span>
        </section>
      ) : (
        <section className="construction-layout">
          <aside className="construction-sheet-list">
            <div className="construction-panel-title">
              <span>图纸</span>
              <b>{drawingSet.sheets.length}</b>
            </div>
            {drawingSet.sheets.map((sheet) => (
              <button key={sheet.id} className={selectedSheet?.id === sheet.id ? 'active' : ''} type="button" onClick={() => setSelectedSheetId(sheet.id)}>
                <strong>{sheet.title}</strong>
                <span>
                  {sheet.planeType === 'wall' ? '墙面' : '地面'} / {sheet.components.length} 个组件
                </span>
              </button>
            ))}
            {drawingSet.warnings.length > 0 && (
              <section className="construction-warning-list">
                <div className="construction-panel-title">
                  <span>警告</span>
                  <b>{drawingSet.warnings.length}</b>
                </div>
                {drawingSet.warnings.map((warning) => (
                  <p key={warning.id}>{warning.message}</p>
                ))}
              </section>
            )}
          </aside>

          <section className="construction-sheet-preview">
            {selectedSheet && (
              <>
                <ConstructionSheetSvg sheet={selectedSheet} />
                <SheetComponentDetails sheet={selectedSheet} />
              </>
            )}
          </section>

          <BillOfMaterialsTable drawingSet={drawingSet} />
        </section>
      )}

      <div className="construction-print-sheets" aria-hidden="true">
        {drawingSet.sheets.map((sheet) => (
          <section className="construction-print-page" key={sheet.id}>
            <ConstructionSheetSvg sheet={sheet} />
            <SheetComponentDetails sheet={sheet} />
          </section>
        ))}
      </div>
    </main>
  )
}

function SheetComponentDetails({ sheet }: { sheet: ConstructionSheet }) {
  return (
    <section className="construction-sheet-details">
      <div className="construction-panel-title">
        <span>当前图纸定位明细</span>
        <b>{sheet.components.length}</b>
      </div>
      {sheet.components.length === 0 ? (
        <p className="construction-sheet-details-empty">这张图纸暂无组件。</p>
      ) : (
        <div className="construction-sheet-detail-table">
          <div className="construction-sheet-detail-head">
            <span>编号</span>
            <span>组件</span>
            <span>中心点</span>
            <span>X 范围</span>
            <span>Y 范围</span>
            <span>正视尺寸</span>
          </div>
          {sheet.components.map((component) => (
            <div className="construction-sheet-detail-row" key={component.id}>
              <strong>{component.code}</strong>
              <span>{component.catalogName}</span>
              <span>
                X {formatConstructionDimension(component.center.x)} / Y {formatConstructionDimension(component.center.y)}
              </span>
              <span>{formatConstructionBounds(component.bounds, 'x')}</span>
              <span>{formatConstructionBounds(component.bounds, 'y')}</span>
              <span>
                {formatConstructionDimension(component.drawingSize.length)} x {formatConstructionDimension(component.drawingSize.width)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
