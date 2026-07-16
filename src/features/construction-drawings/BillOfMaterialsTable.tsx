import { formatConstructionDimension, formatPrice, type ConstructionDrawingSet } from '../../domain/scene/constructionDrawings'

export function BillOfMaterialsTable({ drawingSet }: { drawingSet: ConstructionDrawingSet }) {
  const { billOfMaterials } = drawingSet
  return (
    <section className="construction-bom-panel">
      <div className="construction-panel-title">
        <span>组件清单</span>
        <b>{billOfMaterials.items.length}</b>
      </div>
      <div className="construction-total">
        <strong>{formatPrice(billOfMaterials.knownTotal)}</strong>
        <span>{billOfMaterials.pendingQuoteComponentCount > 0 ? `另有 ${billOfMaterials.pendingQuoteComponentCount} 个组件待报价` : '价格已全部汇总'}</span>
      </div>
      <div className="construction-bom-table">
        <div className="construction-bom-head">
          <span>编号</span>
          <span>组件</span>
          <span>规格</span>
          <span>数量</span>
          <span>单价</span>
          <span>小计</span>
        </div>
        {billOfMaterials.items.map((item) => (
          <div className="construction-bom-row" key={item.id}>
            <span>{item.componentCodes.join(' / ')}</span>
            <strong>
              {item.name}
              <small>{item.kind}</small>
            </strong>
            <span>{formatBomSize(item.size)}</span>
            <span>{item.quantity}</span>
            <span>{formatPrice(item.unitPrice)}</span>
            <span>{formatPrice(item.subtotal)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function formatBomSize(size: { x: number; y: number; z: number }) {
  if (size.x < 1 && size.y < 1 && size.z < 1) return `${Math.round(size.x * 100)}×${Math.round(size.y * 100)}×${Math.round(size.z * 100)} cm`
  return `${formatConstructionDimension(size.x)}×${formatConstructionDimension(size.y)}×${formatConstructionDimension(size.z)}`
}
