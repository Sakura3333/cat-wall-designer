import {
  ArrowLeft,
  Check,
  CircleAlert,
  Copy,
  Download,
  FileJson,
  Layers3,
  Plus,
  RotateCcw,
  Ruler,
  ScanLine,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import sourceImageUrl from '../../../Phase 0组件样本/太空舱直径30.jpg?url'
import {
  buildComponentSpecFromCalibration,
  calibrationStorageKey,
  createCalibrationHole,
  createSpaceCapsuleCalibrationDraft,
  listCalibrationIssues,
  type CalibrationAxis,
  type CalibrationHoleDraft,
  type CalibrationPartDraft,
  type HeightScope,
  type HoleAxis,
  type NullableNumber,
  type SpaceCapsuleCalibrationDraft,
} from '../../domain/ai-cad/calibration'

type SaveState = 'saving' | 'saved'

const evidence = [
  { id: 'width', label: '商品宽度', value: '400 mm', region: { left: '31%', top: '23%', width: '42%', height: '11%' } },
  { id: 'height', label: '右侧高度', value: '200 mm', region: { left: '75%', top: '35%', width: '12%', height: '30%' } },
  { id: 'capsule', label: '舱体直径', value: '300 mm', region: { left: '24%', top: '51%', width: '47%', height: '10%' } },
]

export function AiCadCalibrationPage() {
  const [draft, setDraft] = useState(loadDraft)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [copied, setCopied] = useState(false)
  const issues = useMemo(() => listCalibrationIssues(draft), [draft])
  const specResult = useMemo(() => buildComponentSpecFromCalibration(draft), [draft])
  const generatedJson = specResult.success ? JSON.stringify(specResult.spec, null, 2) : ''

  useEffect(() => {
    setSaveState('saving')
    window.localStorage.setItem(calibrationStorageKey, JSON.stringify(draft))
    const timeout = window.setTimeout(() => setSaveState('saved'), 240)
    return () => window.clearTimeout(timeout)
  }, [draft])

  const stepState = {
    dimensions: draft.widthConfirmed && draft.labeledHeightConfirmed && Boolean(draft.heightScope) && draft.capsuleDiameterConfirmed && draft.depthMm !== null,
    structure: !issues.some((item) => item.code === 'PART_DIMENSION_MISSING' || item.code.startsWith('DEFAULT_THICKNESS')),
    holes: draft.holes.length > 0 && !issues.some((item) => item.code.startsWith('HOLE_') || item.code === 'MOUNTING_HOLES_MISSING'),
    spec: specResult.success,
  }

  function patchDraft(patch: Partial<SpaceCapsuleCalibrationDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function updatePart(partId: string, axis: CalibrationAxis, value: NullableNumber) {
    setDraft((current) => ({
      ...current,
      parts: current.parts.map((part) => (part.id === partId ? { ...part, sizeMm: { ...part.sizeMm, [axis]: value } } : part)),
    }))
  }

  function addHole() {
    setDraft((current) => ({ ...current, holes: [...current.holes, createCalibrationHole(current.holes.length + 1)] }))
  }

  function updateHole(holeId: string, patch: Partial<CalibrationHoleDraft>) {
    setDraft((current) => ({
      ...current,
      holes: current.holes.map((hole) => (hole.id === holeId ? { ...hole, ...patch } : hole)),
    }))
  }

  function updateHoleCenter(holeId: string, axis: CalibrationAxis, value: NullableNumber) {
    setDraft((current) => ({
      ...current,
      holes: current.holes.map((hole) => (hole.id === holeId ? { ...hole, centerMm: { ...hole.centerMm, [axis]: value } } : hole)),
    }))
  }

  function removeHole(holeId: string) {
    setDraft((current) => ({ ...current, holes: current.holes.filter((hole) => hole.id !== holeId) }))
  }

  function resetDraft() {
    window.localStorage.removeItem(calibrationStorageKey)
    setDraft(createSpaceCapsuleCalibrationDraft())
    setCopied(false)
  }

  async function copySpec() {
    if (!generatedJson) return
    await navigator.clipboard.writeText(generatedJson)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  function downloadSpec() {
    if (!generatedJson) return
    const url = URL.createObjectURL(new Blob([generatedJson], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'space-capsule-30.component-spec.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="ai-cad-page">
      <header className="cad-topbar">
        <a className="manager-back" href="/components_manager">
          <ArrowLeft size={18} />
          组件管理
        </a>
        <div className="cad-title">
          <span>AI CAD AGENT / VISION REVIEW</span>
          <h1>太空舱组件校准</h1>
          <p>fixture-space-capsule-30</p>
        </div>
        <div className="cad-header-actions">
          <span className={`cad-save-state ${saveState}`}>
            {saveState === 'saved' ? <Check size={15} /> : null}
            {saveState === 'saved' ? '草稿已保存' : '保存中'}
          </span>
          <button type="button" onClick={resetDraft}>
            <RotateCcw size={17} />
            重置校准
          </button>
        </div>
      </header>

      <section className="cad-workspace">
        <aside className="cad-step-rail" aria-label="建模阶段">
          <div className="cad-rail-heading">
            <span>PIPELINE</span>
            <b>{specResult.success ? '5/5' : '进行中'}</b>
          </div>
          <StageRow icon={<ScanLine size={18} />} title="输入与识别" detail="原图和证据已载入" state="done" />
          <StageRow icon={<Ruler size={18} />} title="尺寸校准" detail="外形与标注范围" state={stepState.dimensions ? 'done' : 'active'} />
          <StageRow icon={<Layers3 size={18} />} title="板件结构" detail="四块木质板件" state={stepState.structure ? 'done' : stepState.dimensions ? 'active' : 'pending'} />
          <StageRow icon={<CircleAlert size={18} />} title="施工孔位" detail="孔径、中心与轴向" state={stepState.holes ? 'done' : stepState.structure ? 'active' : 'pending'} />
          <StageRow icon={<FileJson size={18} />} title="组件规格" detail="ComponentSpec v1" state={stepState.spec ? 'done' : 'pending'} />
        </aside>

        <div className="cad-main-column">
          <section className="cad-review-grid">
            <div className="cad-source-panel">
              <header className="cad-section-head">
                <div>
                  <span>SOURCE IMAGE</span>
                  <h2>商品图证据</h2>
                </div>
                <b>800 × 800</b>
              </header>
              <div className="cad-source-canvas">
                <img src={sourceImageUrl} alt="带尺寸标注的太空舱商品图" />
                {evidence.map((item) => (
                  <span className={`cad-evidence-box ${item.id}`} style={item.region} key={item.id} aria-hidden="true" />
                ))}
              </div>
              <div className="cad-evidence-strip">
                {evidence.map((item) => (
                  <span key={item.id}>
                    <i className={item.id} />
                    {item.label}
                    <b>{item.value}</b>
                  </span>
                ))}
              </div>
            </div>

            <section className="cad-calibration-section cad-dimensions-section" data-testid="dimension-calibration">
              <header className="cad-section-head">
                <div>
                  <span>DIMENSIONS</span>
                  <h2>尺寸校准</h2>
                </div>
                <Ruler size={21} />
              </header>

              <EvidenceDimensionRow
                label="商品宽度"
                value={draft.widthMm}
                confirmed={draft.widthConfirmed}
                onValueChange={(widthMm) => patchDraft({ widthMm })}
                onConfirm={(widthConfirmed) => patchDraft({ widthConfirmed })}
              />
              <EvidenceDimensionRow
                label="右侧高度"
                value={draft.labeledHeightMm}
                confirmed={draft.labeledHeightConfirmed}
                onValueChange={(labeledHeightMm) => patchDraft({ labeledHeightMm })}
                onConfirm={(labeledHeightConfirmed) => patchDraft({ labeledHeightConfirmed })}
              />
              <EvidenceDimensionRow
                label="舱体直径"
                value={draft.capsuleDiameterMm}
                confirmed={draft.capsuleDiameterConfirmed}
                onValueChange={(capsuleDiameterMm) => patchDraft({ capsuleDiameterMm })}
                onConfirm={(capsuleDiameterConfirmed) => patchDraft({ capsuleDiameterConfirmed })}
              />

              <div className="cad-field-block">
                <span>200 mm 标注范围</span>
                <div className="cad-segmented" role="group" aria-label="高度标注范围">
                  <SegmentButton label="木质框架" value="wood-frame" selected={draft.heightScope} onChange={(heightScope) => patchDraft({ heightScope })} />
                  <SegmentButton label="完整组件" value="overall" selected={draft.heightScope} onChange={(heightScope) => patchDraft({ heightScope })} />
                </div>
              </div>

              {draft.heightScope === 'wood-frame' && (
                <NumberInput label="完整组件高度" value={draft.overallHeightMm} onChange={(overallHeightMm) => patchDraft({ overallHeightMm })} />
              )}
              <NumberInput label="整体深度" value={draft.depthMm} onChange={(depthMm) => patchDraft({ depthMm })} />
            </section>
          </section>

          <section className="cad-calibration-section" data-testid="part-calibration">
            <header className="cad-section-head cad-section-head-actions">
              <div>
                <span>PARTS</span>
                <h2>板件结构</h2>
              </div>
              <div className="cad-thickness-control">
                <NumberInput label="默认板厚" value={draft.defaultThicknessMm} onChange={(defaultThicknessMm) => patchDraft({ defaultThicknessMm: defaultThicknessMm ?? 0 })} />
                <ToggleField
                  label="批准使用"
                  checked={draft.defaultThicknessApproved}
                  onChange={(defaultThicknessApproved) => patchDraft({ defaultThicknessApproved })}
                />
              </div>
            </header>

            <div className="cad-parts-table">
              <div className="cad-parts-head">
                <span>板件</span>
                <span>X / 宽</span>
                <span>Y / 高</span>
                <span>Z / 深</span>
                <span>厚度轴</span>
              </div>
              {draft.parts.map((part) => (
                <PartRow draft={draft} part={part} onChange={(axis, value) => updatePart(part.id, axis, value)} key={part.id} />
              ))}
              <div className="cad-derived-part-row">
                <span>
                  <strong>透明太空舱</strong>
                  <small>由确认直径生成</small>
                </span>
                <b>{draft.capsuleDiameterMm}</b>
                <b>{draft.capsuleDiameterMm / 2}</b>
                <b>{draft.capsuleDiameterMm}</b>
                <em>半球</em>
              </div>
            </div>
          </section>

          <section className="cad-calibration-section" data-testid="hole-calibration">
            <header className="cad-section-head cad-section-head-actions">
              <div>
                <span>MOUNTING HOLES</span>
                <h2>施工孔位</h2>
              </div>
              <button className="cad-command-button" type="button" onClick={addHole}>
                <Plus size={17} />
                添加孔位
              </button>
            </header>

            {draft.holes.length === 0 ? (
              <div className="cad-empty-state">
                <CircleAlert size={24} />
                <strong>尚未录入施工孔</strong>
              </div>
            ) : (
              <div className="cad-hole-list">
                {draft.holes.map((hole) => (
                  <HoleRow
                    hole={hole}
                    parts={draft.parts}
                    onChange={(patch) => updateHole(hole.id, patch)}
                    onCenterChange={(axis, value) => updateHoleCenter(hole.id, axis, value)}
                    onDelete={() => removeHole(hole.id)}
                    key={hole.id}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="cad-status-panel" data-testid="calibration-status">
          <section className={specResult.success ? 'cad-gate-status ready' : 'cad-gate-status blocked'}>
            {specResult.success ? <ShieldCheck size={24} /> : <CircleAlert size={24} />}
            <div>
              <span>SPEC GATE</span>
              <strong>{specResult.success ? '可以生成 ComponentSpec' : `${issues.length} 个阻断项`}</strong>
            </div>
          </section>

          {!specResult.success && (
            <div className="cad-issue-list">
              {issues.map((item) => (
                <div key={`${item.code}-${item.field}`}>
                  <CircleAlert size={15} />
                  <span>{item.message}</span>
                </div>
              ))}
            </div>
          )}

          {specResult.success && (
            <>
              <div className="cad-spec-actions">
                <button type="button" onClick={copySpec}>
                  <Copy size={16} />
                  {copied ? '已复制' : '复制 JSON'}
                </button>
                <button className="primary" type="button" onClick={downloadSpec}>
                  <Download size={16} />
                  下载 Spec
                </button>
              </div>
              <pre className="cad-json-preview">{generatedJson}</pre>
            </>
          )}
        </aside>
      </section>
    </main>
  )
}

function StageRow({ icon, title, detail, state }: { icon: ReactNode; title: string; detail: string; state: 'done' | 'active' | 'pending' }) {
  return (
    <div className={`cad-stage-row ${state}`}>
      <span className="cad-stage-icon">{state === 'done' ? <Check size={17} /> : icon}</span>
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <i />
    </div>
  )
}

function EvidenceDimensionRow({
  label,
  value,
  confirmed,
  onValueChange,
  onConfirm,
}: {
  label: string
  value: number
  confirmed: boolean
  onValueChange: (value: number) => void
  onConfirm: (value: boolean) => void
}) {
  return (
    <div className={confirmed ? 'cad-evidence-dimension confirmed' : 'cad-evidence-dimension'}>
      <span>{label}</span>
      <label>
        <input type="number" min={0.01} step={1} value={value} onChange={(event) => onValueChange(Number(event.target.value))} />
        <b>mm</b>
      </label>
      <ToggleField label="确认" checked={confirmed} onChange={onConfirm} />
    </div>
  )
}

function SegmentButton({ label, value, selected, onChange }: { label: string; value: Exclude<HeightScope, null>; selected: HeightScope; onChange: (value: Exclude<HeightScope, null>) => void }) {
  return (
    <button className={selected === value ? 'active' : ''} type="button" onClick={() => onChange(value)} aria-pressed={selected === value}>
      {label}
    </button>
  )
}

function NumberInput({ label, value, onChange }: { label: string; value: NullableNumber; onChange: (value: NullableNumber) => void }) {
  return (
    <label className="cad-number-field">
      <span>{label}</span>
      <span>
        <input type="number" min={0.01} step={1} value={value ?? ''} onChange={(event) => onChange(toNullableNumber(event.target.value))} />
        <b>mm</b>
      </span>
    </label>
  )
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="cad-toggle-field">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{checked ? <Check size={14} /> : null}</span>
      <b>{label}</b>
    </label>
  )
}

function PartRow({
  draft,
  part,
  onChange,
}: {
  draft: SpaceCapsuleCalibrationDraft
  part: CalibrationPartDraft
  onChange: (axis: CalibrationAxis, value: NullableNumber) => void
}) {
  return (
    <div className="cad-part-row">
      <span>
        <strong>{part.label}</strong>
        <small>{part.id}</small>
      </span>
      {(['x', 'y', 'z'] as CalibrationAxis[]).map((axis) => {
        const usesDefault = axis === part.thicknessAxis && part.sizeMm[axis] === null && draft.defaultThicknessApproved
        return (
          <label className={usesDefault ? 'uses-default' : ''} key={axis}>
            <input
              aria-label={`${part.label} ${axis.toUpperCase()} 尺寸`}
              type="number"
              min={0.01}
              step={1}
              placeholder={usesDefault ? String(draft.defaultThicknessMm) : '必填'}
              value={part.sizeMm[axis] ?? ''}
              onChange={(event) => onChange(axis, toNullableNumber(event.target.value))}
            />
            <b>mm</b>
          </label>
        )
      })}
      <em>{part.thicknessAxis.toUpperCase()}</em>
    </div>
  )
}

function HoleRow({
  hole,
  parts,
  onChange,
  onCenterChange,
  onDelete,
}: {
  hole: CalibrationHoleDraft
  parts: CalibrationPartDraft[]
  onChange: (patch: Partial<CalibrationHoleDraft>) => void
  onCenterChange: (axis: CalibrationAxis, value: NullableNumber) => void
  onDelete: () => void
}) {
  return (
    <article className={hole.confirmed ? 'cad-hole-row confirmed' : 'cad-hole-row'}>
      <header>
        <strong>{hole.id}</strong>
        <button type="button" onClick={onDelete} aria-label={`删除 ${hole.id}`}>
          <Trash2 size={16} />
        </button>
      </header>
      <label className="cad-select-field">
        <span>所属板件</span>
        <select value={hole.partId} onChange={(event) => onChange({ partId: event.target.value })}>
          {parts.map((part) => (
            <option value={part.id} key={part.id}>{part.label}</option>
          ))}
        </select>
      </label>
      <NumberInput label="孔径" value={hole.diameterMm} onChange={(diameterMm) => onChange({ diameterMm })} />
      <div className="cad-hole-center">
        <span>中心坐标</span>
        {(['x', 'y', 'z'] as CalibrationAxis[]).map((axis) => (
          <label key={axis}>
            <b>{axis.toUpperCase()}</b>
            <input type="number" step={1} value={hole.centerMm[axis] ?? ''} onChange={(event) => onCenterChange(axis, toNullableNumber(event.target.value))} />
          </label>
        ))}
      </div>
      <label className="cad-select-field">
        <span>孔轴方向</span>
        <select value={hole.axis} onChange={(event) => onChange({ axis: event.target.value as HoleAxis })}>
          {(['+X', '-X', '+Y', '-Y', '+Z', '-Z'] as HoleAxis[]).map((axis) => <option value={axis} key={axis}>{axis}</option>)}
        </select>
      </label>
      <ToggleField label="确认孔位" checked={hole.confirmed} onChange={(confirmed) => onChange({ confirmed })} />
    </article>
  )
}

function loadDraft(): SpaceCapsuleCalibrationDraft {
  const fallback = createSpaceCapsuleCalibrationDraft()
  try {
    const raw = window.localStorage.getItem(calibrationStorageKey)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<SpaceCapsuleCalibrationDraft>
    return {
      ...fallback,
      ...parsed,
      parts: Array.isArray(parsed.parts) ? parsed.parts : fallback.parts,
      holes: Array.isArray(parsed.holes) ? parsed.holes : fallback.holes,
    }
  } catch {
    return fallback
  }
}

function toNullableNumber(value: string): NullableNumber {
  if (value.trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
