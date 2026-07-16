# 施工图生成设计方案（2026-07-07）

> **2026-07-16 实现状态：** 核心施工图能力已落地：`/construction_drawings` 路由、每面墙/地一张正视图、组件坐标/尺寸/占用范围标注、禁区叠加、BOM 汇总、打印/PDF、SVG 下载和 BOM CSV 下载均已实现。后续商业化增强重点是打孔点、安装顺序、安装方向、配件包、现场复核清单和客户签字确认页。当前总体状态请看 `docs/cat-wall-editor-handoff-2026-07-16.md`。

## 目标

从当前 3D 场景的 `Project` 数据生成一套 2D 施工图包：

- 每个 wall plane 输出一张墙面正视施工图。
- 每个 floor plane 输出一张地面正投影施工图。
- 每张图标注组件摆放位置、占用范围和尺寸。
- 生成组件清单，按 catalog 单价汇总数量和总价。
- 支持预览、打印成 PDF、下载 SVG；第一版不引入额外 PDF 依赖。

## 当前工程可复用基础

| 能力 | 当前位置 | 用法 |
| --- | --- | --- |
| plane 尺寸/类型/变换 | `src/domain/scene/types.ts` | `PlaneSpec.width/height/type/position/rotation` 是施工图画布基础 |
| 组件实例尺寸/绑定 | `src/domain/scene/types.ts` | `SceneComponent.size/placement/targetPlaneId/position/rotation` 用来计算平面 footprint |
| catalog 单价 | `src/domain/scene/componentCatalog.ts` | `ComponentCatalogItem.referencePrice` 用于 BOM 总价 |
| plane local 坐标转换 | `src/domain/scene/planeMath.ts` | `worldToPlaneLocal()` / `planeLocalToWorld()` 避免依赖 Three.js 画面 |
| 组件 footprint 语义 | `src/domain/scene/distanceMeasurements.ts`、`src/domain/scene/forbiddenZones.ts` | wall 使用 local X/Y + size.x/size.y；floor 使用 local X/Y + size.x/size.z |
| 导出入口 | `src/editor/EditorPage.tsx` | 现有项目文件工具栏已有 JSON 导入/导出按钮，可放施工图入口 |
| 路由 | `src/app/App.tsx` | 可新增 `/construction_drawings` 预览页 |

## 核心决策

### 1. 坐标系

施工图坐标使用“每张 plane 自己的二维施工坐标”，不直接暴露世界坐标。

- plane 原点：左下角或近左角，单位米。
- plane local 原点仍在中心，转换公式：
  - `drawingX = local.x + plane.width / 2`
  - `drawingY = local.y + plane.height / 2`
- 墙面图：X 向右，Y 向上。
- 地面图：X 向右，Y 向远端；视觉上是沿地面法线看的正投影，不做透视。

这样施工人员看到的位置都是从该墙/地面的左下角开始量，读数更自然。

### 2. 组件尺寸和占用范围

第一版以 catalog/实例里的占位尺寸为准，和放置、边界约束、测距保持一致：

- wall 组件：
  - 长度 = `size.x`
  - 宽/高 = `size.y`
  - 深度 `size.z` 不画进正视图，但在明细里保留
- floor 组件：
  - 长度 = `size.x`
  - 宽/深 = `size.z`
  - 高度 `size.y` 不画进地面图，但在明细里保留

每个组件输出：

- 编号：`C01`、`C02`...
- 名称：实例名优先，fallback 到 catalog label。
- 中心点：`x/y`。
- 占用范围：`xMin/xMax/yMin/yMax`。
- 尺寸：`长 x 宽`。
- 绑定面：plane name/id。
- 如存在平面内旋转，标注角度；MVP 可以先画轴对齐占用矩形，第二阶段支持旋转矩形。

### 3. 价格计算

BOM 按 `kind + 尺寸参数签名` 分组，避免同一类组件不同尺寸被误合并。

每行包含：

- 组件名称
- kind
- 规格：长 x 宽 x 高
- 数量
- 单价：`referencePrice`
- 小计：数量 x 单价
- 购买链接：使用 catalog `purchaseUrls`

价格规则：

- `referencePrice` 存在：参与总价。
- `referencePrice` 缺失：标记“待报价”，不静默按 0 元计入总价。
- 总价显示为“已知小计 + 待报价项数量”，例如：`已知合计 ¥1,236，另有 2 项待报价`。

## 推荐实现方案

### 新增 domain 模块

新增 `src/domain/scene/constructionDrawings.ts`，保持纯函数、可单元测试。

建议类型：

```ts
export type ConstructionDrawingSet = {
  projectId: string
  projectName: string
  generatedAt: string
  sheets: ConstructionSheet[]
  billOfMaterials: BillOfMaterials
  warnings: ConstructionDrawingWarning[]
}

export type ConstructionSheet = {
  id: string
  planeId: string
  title: string
  planeType: 'wall' | 'floor'
  width: number
  height: number
  scale: number
  components: ConstructionComponentMark[]
}

export type ConstructionComponentMark = {
  id: string
  componentId: string
  code: string
  name: string
  kind: string
  center: { x: number; y: number }
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  size: { length: number; width: number; depthOrHeight: number }
  rotationDegrees?: number
  price?: number
}
```

核心函数：

- `buildConstructionDrawingSet(project: Project): ConstructionDrawingSet`
- `buildConstructionSheet(plane, components): ConstructionSheet`
- `buildConstructionComponentMark(component, plane, catalogItem): ConstructionComponentMark | null`
- `buildBillOfMaterials(marks, catalog): BillOfMaterials`
- `formatConstructionDimension(valueMeters): string`
- `formatPrice(value): string`

建议把 `distanceMeasurements.ts` 和 `forbiddenZones.ts` 中重复的 footprint 计算抽到 `src/domain/scene/componentFootprints.ts`，施工图、测距、禁摆区共用，避免三份几何语义以后漂移。

### 新增 UI

新增目录 `src/features/construction-drawings/`：

- `ConstructionDrawingsPage.tsx`
- `ConstructionSheetSvg.tsx`
- `BillOfMaterialsTable.tsx`
- `constructionDrawingExport.ts`

页面结构：

- 顶部工具条：返回编辑器、打印/PDF、下载全部 SVG、下载 BOM CSV。
- 左侧 sheet 列表：按 wall/floor 分组。
- 中间施工图预览：SVG，固定 A4 比例或自适应。
- 右侧/底部：组件清单与总价。

SVG 内容：

- plane 外框和尺寸标注。
- 组件占用矩形。
- 组件编号气泡。
- 中心点十字和 `x/y` 文本。
- 占用范围文本：`X 0.42-1.02m / Y 0.80-1.20m`。
- 尺寸文本：`L 60cm / W 40cm`。
- 图纸标题、比例尺、单位说明。

### 入口与导出

新增路由：

- `/construction_drawings`

在 `ProjectFileActions` 增加一个图纸按钮，只有 `project.planes.length > 0` 时可用。

导出第一版优先级：

1. 打印成 PDF：施工图页提供 print stylesheet，用户用浏览器保存 PDF。
2. 下载单张/全部 SVG：直接序列化 SVG。
3. 下载 BOM CSV：方便报价和采购。

先不引入 `jspdf` / `html2canvas`，因为当前项目没有 PDF 依赖，SVG + print 更轻，和 Vite chunk size warning 也更友好。

## 边界规则

- 未绑定到 wall/floor 的 `free` 组件：不画进某张施工图，进入“未纳入施工图”警告列表。
- 绑定 plane 已删除或找不到：进入警告列表，不阻塞其他图纸生成。
- 组件超出 plane：照实画出超出部分，并在 sheet 警告里标记“超出边界”。
- 禁止摆放区：可作为淡红色区域叠加在图纸上，帮助施工避让；默认显示。
- 图片纹理：施工图第一版不把墙面照片作为底图，避免打印干扰；后续可加“显示背景图”开关。
- 单位：内部米，展示小于 1m 用 cm，大于等于 1m 用 m。

## 验收标准

1. 有 2 面墙 + 1 个地面的项目会生成 3 张施工图。
2. 每张图只显示绑定到该 plane 的组件。
3. wall 组件显示 `x/y`、占用范围和 `size.x/size.y`。
4. floor 组件显示 `x/y`、占用范围和 `size.x/size.z`。
5. BOM 按组件规格汇总数量，并用 catalog `referencePrice` 计算已知总价。
6. 缺少单价的组件明确显示“待报价”，总价不把它当作 0 元静默计入。
7. 未绑定或绑定丢失的组件出现在警告列表。
8. `npm run test`、`npm run build` 通过。
9. 浏览器打印预览中每张 sheet 独立分页，文字不重叠。

## 开发拆分

### P0：纯数据生成

- 抽取 `componentFootprints.ts`。
- 新增 `constructionDrawings.ts`。
- 覆盖坐标转换、wall/floor footprint、BOM 汇总、缺价警告测试。

### P1：施工图预览页

- 新增 `/construction_drawings` 路由和页面。
- SVG 渲染 sheet。
- BOM 表格和警告列表。
- 编辑器工具栏入口。

### P1：导出能力

- print stylesheet。
- SVG 下载。
- BOM CSV 下载。

### P2：高级图纸语义

- 支持旋转组件的 oriented footprint。
- 支持图纸比例尺选择和持久化。
- 支持禁摆区开关、背景图开关。
- 支持品牌化 PDF 页眉页脚。

## 不在第一版范围

- 不修改 Project schema，施工图从当前项目实时生成。
- 不引入后端导出任务。
- 不自动根据 GLB 真实 bounding box 重新计算施工尺寸。
- 不把纹理照片默认印进施工图。
- 不把缺价组件按 0 元加入总价。
