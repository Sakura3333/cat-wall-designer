# Cat Wall Editor 当前状态交接文档（2026-07-16）

> 这是 2026-07-16 之后继续开发前建议先读的最新交接入口。早期文档仍有历史价值，但其中“未完成”“下一步”的描述可能已经过期；当前实现状态以本文为准。

## 建议阅读顺序

1. `README.md`：运行入口、脚本和当前功能总览。
2. `docs/cat-wall-editor-handoff-2026-07-16.md`：当前状态和后续优先级。
3. `docs/construction-drawings-feature-design-2026-07-07.md`：施工图功能设计与落地状态。
4. `docs/cat-wall-editor-commercialization-plan-2026-07-09.md`：商业化目标和产品路线。
5. `docs/cat-wall-editor-commercialization-task-breakdown-2026-07-11.md`：商业化 MVP 任务拆解。
6. `docs/ai-cad-agent-pipeline-design-2026-07-11.md`、`docs/ai-cad-parametric-sketch-editor-design-2026-07-12.md`：AI CAD 方向。

## 当前产品状态

编辑器已经从“3D 猫墙 demo”推进到可用于内部方案设计的工作台：可以搭建墙面/地面场景，拖入真实/占位组件，按墙面或地面规则约束摆放，绘制禁用区域，查看邻近距离，生成每面墙/地的 2D 施工图，并汇总 BOM 和参考价格。

当前更接近“内部设计师工具”而不是面向终端客户的自助配置器。短期商业化主线应继续围绕成交和交付闭环推进：真实 SKU、报价、施工包、客户确认和项目管理。

## 已落地能力

### 3D 场景与组件摆放

- 组件拖入场景时会通过 R3F/Three.js raycast 命中墙面或地面，不再只按默认 plane 创建。
- `wall` 组件贴墙，`floor` 组件落地，`free` 组件可自由放置。
- 组件移动和 Transform 预览会受接触面、边界和禁区约束。
- 墙面组件跨墙移动时会重新绑定最近墙面并更新朝向。
- 组件选中逻辑已加入点击位移阈值，视图旋转后的鼠标弹起不会误选弹起位置的模型。

关键文件：
- `src/domain/scene/componentPlacement.ts`
- `src/features/scene3d/componentTransformPreview.ts`
- `src/features/scene3d/sceneSelection.ts`
- `src/features/scene3d/SceneCanvas.tsx`

### 真实资产与 Catalog

- 组件 catalog 已独立到 `src/domain/scene/componentCatalog.ts`，支持大类、小类、价格、购买链接、资产 key/URL 和参数 schema。
- 组件面板支持自定义小分类 tab，滚轮可横向滚动。
- 组件缩略图已改为 3D 预览。
- GLB 加载走内置 registry 或外部 URL，失败时回退占位盒。
- GLB 模型保持原比例，不再被 catalog 尺寸强行拉伸。
- 修复了非目标材质颜色绑定后部分模型拖入场景变白的问题。

关键文件：
- `src/domain/scene/componentAssets.ts`
- `src/domain/scene/componentCatalog.ts`
- `src/features/scene3d/ComponentAssetThumbnail.tsx`
- `src/features/scene3d/componentGltfMaterials.ts`
- `src/features/component-palette/ComponentPalette.tsx`

### 禁用区域

- 支持在墙面/地面绘制矩形或椭圆禁用区域。
- 禁用区域默认锁定；锁定状态下场景中显示锁图标。
- 禁区内部加入斜线和“禁”字，施工图中也会作为避让区域呈现。
- 组件不能拖入禁区，Transform 预览进入禁区会回退。
- 禁区不能绘制或编辑到已有组件 footprint 上；失败时会给出明确提示。
- 选中禁区时会显示禁区到目标墙面/地面边缘的距离。

关键文件：
- `src/domain/scene/forbiddenZones.ts`
- `src/editor/editorStore.ts`
- `src/features/scene3d/SceneCanvas.tsx`
- `src/features/properties/PropertyPanel.tsx`
- `src/ui/panels/Toolbar.tsx`

### 距离测量

- 组件距离计算已从“全量互相标注”收敛为只显示各方向相邻组件距离，避免组件多时线条杂乱。
- 选中组件时显示组件到邻近组件、plane 边缘和地面的距离。
- 选中禁区时显示禁区到 plane 边缘的距离。

关键文件：
- `src/domain/scene/distanceMeasurements.ts`
- `src/domain/scene/componentFootprints.ts`
- `src/features/scene3d/SceneCanvas.tsx`

### 施工图与 BOM

- 已新增 `/construction_drawings` 路由。
- 每个 wall/floor plane 生成一张正视图施工图。
- 图纸标注组件编号、中心坐标、占用范围、尺寸和边界尺寸。
- 图纸中的密集文字已优化为数据贴近标注线，降低遮挡。
- SVG 下载已补齐 presentation style，修复下载后在部分查看器里变黑的问题。
- 支持浏览器打印/PDF、SVG 下载、BOM CSV 下载。
- BOM 按组件规格汇总数量、参考单价和已知总价，缺价项明确显示待报价。

关键文件：
- `src/domain/scene/constructionDrawings.ts`
- `src/features/construction-drawings/ConstructionDrawingsPage.tsx`
- `src/features/construction-drawings/ConstructionSheetSvg.tsx`
- `src/features/construction-drawings/constructionDrawingExport.ts`
- `src/features/construction-drawings/BillOfMaterialsTable.tsx`

### 面板与小屏体验

- 四个浮动面板在 hover/focus 时会提升到最上层，避免互相遮挡。
- 顶部工具区、组件面板、快捷键栏和属性面板已整体压缩。
- 快捷键栏改为贴近屏幕底部的小长条，减少对其他面板的遮挡。
- 组件面板和分类 tab 默认支持横向滚动。

关键文件：
- `src/styles.css`
- `src/editor/EditorPage.tsx`
- `src/features/component-palette/ComponentPalette.tsx`

### 墙面、地面与纹理

- 墙面/地面改为程序化纹理，避免调整尺寸后贴图被拉伸。
- 墙面旋转轴按夹角/铰链关系对齐，减少相邻墙面错位和穿模。
- 墙面变换后会重新计算地面范围，避免墙面超出地面。
- 绑定在墙面/地面上的组件会随 plane transform 同步。

关键文件：
- `src/domain/geometry/buildPlanes.ts`
- `src/domain/geometry/wallTemplates.ts`
- `src/domain/geometry/planeLayout.ts`
- `src/features/scene3d/SceneCanvas.tsx`

### AI CAD 方向

- 已有 AI CAD 总体设计与三视图参数化草图编辑器设计。
- 已新增 `/components_manager/ai-cad` 入口。
- 已有 `src/domain/ai-cad/`、`src/features/ai-cad-agent/`、`workers/`、`schemas/` 和 `fixtures/` 的第一批结构。
- 该方向仍是组件建模生产线，不应替代当前商业化 MVP 主线。

## 近期修复记录

- 修复 OrbitControls 旋转视图后 mouseup 误选模型：`src/features/scene3d/sceneSelection.ts`。
- 修复 SVG 下载后黑色显示：`src/features/construction-drawings/constructionDrawingExport.ts`。
- 修复部分 GLB 拖入场景后变白：`src/features/scene3d/componentGltfMaterials.ts`。
- 修复禁区画到组件上失败但无提示的问题：`src/editor/editorStore.ts`。
- 修复禁区锁定状态表达不清的问题：`src/features/scene3d/SceneCanvas.tsx`。
- 优化组件多时距离线和施工图标注过密的问题。
- 优化面板层级、尺寸、横向滚动和小屏遮挡问题。

## 当前验证状态

建议每轮改动后运行：

```bash
npm run test
npm run build
```

最近一次完整验证记录中，单元测试和构建通过；Vite 仍有 chunk size warning，主要来自 Three/R3F/GLTF 相关依赖，不影响当前运行。

本文档为文档同步改动，未额外运行测试。

## 已知短板

- Catalog 还不是完整 SKU 体系，缺少正式 SKU 字段、上下架、库存、配件包和业务校验。
- 报价目前主要来自 catalog 参考价和 BOM 汇总，尚未有报价领域模型、人工费用、优惠、运费和报价单。
- 项目仍以本地草稿和 JSON 导入导出为主，缺少客户信息、项目状态、项目列表、复制/归档和云端保存。
- 施工图已可用，但距离真正现场交付还缺打孔点、安装顺序、安装方向、配件包、复核清单和客户签字页。
- 安装规则还偏几何约束，尚未形成可解释的业务规则引擎。
- 客户只读预览、分享链接、客户确认和留言流程尚未实现。
- AI CAD 已有设计和部分结构，但还需要真实 golden fixture、Worker 闭环和发布审核流程。

## 建议下一步

1. **商业化 P0：真实 SKU 与报价模型**
   补齐 `ProductSku`、`Quote`、`QuoteItem`、配件包、报价状态和金额按分存储；让 BOM、施工图和报价单使用同一套 SKU/价格来源。

2. **商业化 P0：施工包增强**
   在现有施工图基础上增加打孔点、安装顺序、安装方向、配件清单、复核清单和打印/PDF 版式。

3. **商业化 P0：项目与客户信息**
   增加客户姓名、电话/微信、城市、墙体类型、猫数量/体重、预算、项目状态、本地项目列表、复制和重命名。

4. **体验 P1：规则提示产品化**
   把当前几何错误进一步升级成“对象 + 位置 + 原因 + 建议”的提示，用于设计师解释为什么不能放。

5. **平台 P1：客户预览与确认**
   P0 跑通后再做只读分享链接、客户确认和留言。不要在报价/施工包稳定前提前做复杂协作。

6. **AI CAD P1：先跑确定性闭环**
   先用人工 fixture 跑通 `ComponentSpec -> ModelingPlan -> Worker -> GLB -> Catalog`，再接 Vision/Planner。

## 相关文档状态

- `docs/cat-wall-editor-dev-spec.md`：早期架构/开发规格，仍可读，但组件交互和当前状态已过期。
- `docs/cat-wall-component-system-handoff-2026-07-04.md`：组件系统早期交接，很多“未落地”项已完成。
- `docs/cat-wall-editor-handoff-2026-07-05.md`：7 月 5 日主线交接，保留历史上下文，后续状态以本文为准。
- `docs/construction-drawings-feature-design-2026-07-07.md`：施工图设计方案，核心功能已实现，剩余是商业交付增强。
- `docs/cat-wall-editor-commercialization-plan-2026-07-09.md`：商业化计划，产品方向仍有效。
- `docs/cat-wall-editor-commercialization-task-breakdown-2026-07-11.md`：商业化任务拆解，仍建议作为 MVP 看板来源。
