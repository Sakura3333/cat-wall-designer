# 在线猫墙编辑器交接文档（2026-07-01）

本文档记录当前版本已经实现的功能、主要代码结构和后续改造入口。项目是 Vite + React + TypeScript 前端原型，3D 使用 Three.js、React Three Fiber 和 drei，编辑状态集中在 Zustand store。

> 2026-07-04 补充：组件系统已经新增独立 catalog、`/components_manager` 管理页、三大放置规则和组件属性字段。组件与场景互动的后续开发细节请优先阅读 `docs/cat-wall-component-system-handoff-2026-07-04.md`。

## 1. 当前运行方式

```bash
npm install
npm run dev -- --port 5173
npm run build
```

本地开发地址：

```txt
http://127.0.0.1:5173/
```

注意：Windows PowerShell 直接 `Get-Content` 读取中文时可能显示乱码。源码和文档按 UTF-8 写入，排查中文内容时建议用 `.NET ReadAllText(..., Encoding.UTF8)` 或编辑器查看。

## 2. 已完成功能

### 2.1 图片与标注

- 上传、替换、删除室内图片：为透视标注、贴图和 UV 映射提供原始图片。
- 透视标线：支持左向线、右向线、竖向线；左/右向线用于求消失点，竖向线用于辅助估算 pitch。
- 标尺：用户可输入真实长度，系统用像素比例和透视修正估算标线真实尺寸。
- 四点墙面：保留旧流程，四个角点一组生成墙面四边形，作为透视线不足时的兼容方案。

### 2.2 3D 生成

- 透视模型生成：优先通过透视线生成相机、左/右墙面和地面；透视线不足时回退到四点墙面。
- 模板生成：无图片时可直接生成单面墙、双墙夹角、三墙夹角。
- 厚墙体：墙面和地面使用带厚度的 box geometry，而不是零厚度 plane。
- 地面常驻：生成模型时始终生成地面，地面尺寸覆盖墙体范围。
- 测量尺寸驱动模型：有标尺和透视线测量结果时，生成的墙宽、墙高优先使用测量值。

### 2.3 3D 编辑

- 左侧 3D 工具栏：进入 3D 场景后显示常驻小图标工具栏，支持选择、移动、旋转、撤销、重做、删除。
- 物体变换：选中墙面或组件后，可用 TransformControls 移动或旋转，操作结束后写回 store。
- 删除：D 键或左侧删除按钮删除当前选中的组件或非地面墙面；地面受保护，不允许删除。
- 视图操作：左键旋转视角，滚轮缩放，右键拖动平移。
- 默认相机：非透视生成场景的默认相机已后移，模型主体大约占画面横向 1/2。

### 2.4 属性面板

- 右侧属性面板折叠成窄条，按钮包括位置、旋转、尺寸、贴图、地面、状态。
- 鼠标悬停或键盘聚焦按钮时显示详细数值面板。
- 位置和旋转支持 X/Y/Z 精确输入。
- 墙面和地面尺寸支持滑条与数值输入。
- 贴图开关用于控制选中 plane 使用图片区域还是暖色墙皮材质。

### 2.5 组件面板

- 底部组件面板支持分类 tab 和组件卡片。
- 组件卡片可拖拽到 3D 场景。
- drop 成功后在场景中创建一个组件实例。
- 当前组件以简化 box 渲染，可被选中、移动、旋转和删除。

### 2.6 快捷键

- `Q`：选择
- `W`：移动
- `E`：旋转
- `D`：删除选中 3D 物体
- `Esc`：取消选择并回到选择模式
- `Ctrl+Z`：撤销
- `Ctrl+Y`：重做

## 3. 核心代码结构

### 3.1 页面组合

`src/editor/EditorPage.tsx`

- 包裹 `DndContext`，处理组件拖拽结束事件。
- 注册 `scene-drop-zone`，作为组件 drop 区域。
- 决定显示 `AnnotationLayer` 还是 `SceneCanvas`。
- 组合上传区、模板区、左侧工具栏、右侧属性面板、底部组件面板和快捷键栏。
- 有 3D 模型时，上传/模板区域使用 `top-dock` 样式停靠到顶部，避免遮挡模型。

### 3.2 状态中心

`src/editor/editorStore.ts`

维护的关键状态：

- `project`：当前草稿，包含图片、角点、标尺、透视线、相机、polygons、planes、components 和 settings。
- `mode`：当前编辑模式。
- `selectedId`：当前选中的 plane 或 component id。
- `activeCategory`：组件面板当前分类。
- `activePerspectiveAxis`：当前透视线方向。
- `transformMode`：3D 操作模式，取值为 `select`、`translate`、`rotate`。
- `history` / `future`：撤销和重做栈。
- `geometryErrors`：几何生成错误。

关键 action：

- `setSourceImage()` / `clearSourceImage()`：设置或清空图片，并清空相关几何草稿。
- `createPerspectiveGuide()` / `addPerspectiveGuide()` / `movePerspectiveGuidePoint()` / `deletePerspectiveGuide()`：透视线创建、拖动和删除。
- `createRuler()` / `moveRulerPoint()` / `updateRulerLength()`：标尺创建与真实长度编辑。
- `buildGeometry()`：优先调用 `buildPerspectiveRoom()`，失败时走 `buildPolygons()` + `buildPlanes()`。
- `applyWallTemplate()`：根据模板生成墙面和地面。
- `updatePlaneSize()` / `updatePlaneTextureMapping()` / `updatePlaneTransform()`：墙面尺寸、贴图和变换更新。
- `updateComponentTransform()`：组件位置和旋转更新。
- `deleteSelectedSceneObject()`：删除当前选中组件或非地面 plane。
- `addComponent()`：新增组件实例。

### 3.3 几何与透视

`src/domain/geometry/perspective.ts`

- `buildPerspectiveCalibration()`：根据左/右/竖向透视线计算消失点、焦距和 FOV。
- `estimatePerspectiveGuideLengthCm()`：结合标尺和透视方向估算某条标线的真实长度。
- `buildPerspectiveRoom()`：输出透视相机、墙面和地面。
- 生成 plane 时会优先保留已有 plane 的尺寸和贴图状态，方便用户二次生成后不丢失编辑。

`src/domain/geometry/wallTemplates.ts`

- `buildWallTemplatePlanes()`：生成单墙、双墙夹角、三墙夹角模板。
- 模板始终附带地面，并让地面覆盖墙体范围。

### 3.4 3D 场景

`src/features/scene3d/SceneCanvas.tsx`

- 使用 `Canvas` 渲染场景。
- 有 `project.sceneCamera` 时使用透视标线推导出的相机；否则使用默认相机。
- `OrbitControls` 支持左键旋转、滚轮缩放、右键平移。
- `TransformControls` 绑定当前选中 mesh，用于移动和旋转。
- `PlaneMesh` 渲染墙面/地面。
- `buildThickPlaneGeometry()` 手动创建带厚度的几何体，并保留前表面 UV。
- `TextureMaterial` 用上传图片做贴图。
- `WarmWallMaterial` 用 CanvasTexture 生成暖色墙皮。
- `ComponentMesh` 当前把组件渲染为不同颜色的 box 占位体。

### 3.5 工具栏与快捷键

`src/ui/panels/Toolbar.tsx`

- 非 3D 状态显示完整标注工具：透视线、四点墙面、标尺、撤销/重做、清空标注。
- 3D 状态使用 `compact` 模式，显示左侧常驻小图标工具：选择、移动、旋转、撤销、重做、删除。

`src/ui/panels/ShortcutBar.tsx`

- `ShortcutBar()` 负责底部提示显示。
- `useShortcutKeys()` 绑定键盘事件。
- 输入框、textarea 和 contentEditable 聚焦时，普通快捷键不会打断输入；Ctrl/Meta 撤销重做仍可生效。

### 3.6 属性面板

`src/features/properties/PropertyPanel.tsx`

- 通过 `getSelectedPlane(project, selectedId)` 获取当前 plane；同时直接查找当前 component。
- `PropertyPopover` 定义一个属性按钮和悬浮详情面板。
- `VectorEditor` 编辑 X/Y/Z。
- `MeasureControl` 同时提供 slider 和 number input。
- 当前组件支持位置、旋转、尺寸、占位颜色和专属参数编辑。

相关样式在 `src/styles.css`：

- `.property-rail`
- `.property-rail-button`
- `.property-detail-panel`
- `.metric-row`
- `.axis-input`

## 4. 组件系统重点交接

组件系统已在 2026-07-04 做过一轮集中改造，最新详细交接见 `docs/cat-wall-component-system-handoff-2026-07-04.md`。本节只保留主编辑器交接所需的概要。

### 4.1 当前功能

- `/components_manager` 提供组件管理页，可新增、编辑、复制、删除组件。
- 组件库固定按放置规则分为 `wall`、`floor`、`free` 三大类。
- 三大类下可以自由新增和删除子类，子类只用于细分和筛选，不改变放置规则。
- 组件字段包含名称、描述、图标 key、资产 key、资产 URL、默认尺寸、默认旋转、占位颜色、购买链接、参考价格和专属属性 schema。
- 底部组件面板从 `src/domain/scene/componentCatalog.ts` 读取数据，不再硬编码组件列表。
- 主编辑器中拖入组件后会创建 `SceneComponent` 实例，可选中、移动、旋转、删除，并在右侧属性面板编辑位置、旋转、尺寸、颜色和专属参数。

### 4.2 数据模型

关键类型定义在 `src/domain/scene/types.ts`：

```ts
export type ComponentPlacementMode = 'wall' | 'floor' | 'free'

export type ComponentPlacement = {
  mode: ComponentPlacementMode
  targetPlaneId?: string
  anchor?: Vec3
  normal?: Vec3
}

export type SceneComponent = {
  id: string
  kind: SceneComponentKind
  name: string
  targetPlaneId?: string
  placement?: ComponentPlacement
  position: Vec3
  rotation: Vec3
  scale?: Vec3
  size?: Vec3
  material?: ComponentMaterial
  params?: Record<string, ComponentPropertyValue>
}
```

组件 catalog 定义在 `src/domain/scene/componentCatalog.ts`，核心字段包括 `kind`、`placement`、`subcategoryId`、`defaultSize`、`defaultRotation`、`fallbackColor`、`assetKey`、`assetUrl`、`purchaseUrls`、`referencePrice` 和 `propertySchema`。catalog 通过 localStorage key `cat-wall-component-catalog` 持久化，当前版本是 `3`。

### 4.3 当前拖拽链路

- `ComponentPalette` 使用 `useDraggable({ id: kind, data: { kind } })` 作为拖拽源。
- `EditorPage` 注册 `scene-drop-zone`。
- `handleDragEnd()` 仍只判断是否 drop 到场景区域，然后调用 `addComponent(kind)`。
- `editorStore.addComponent()` 会读取 catalog placement：墙面组件只绑定 wall plane，地面组件只绑定 floor plane，自由组件不绑定 plane。
- 当前 position 仍是默认偏移，不是鼠标命中点。

### 4.4 当前渲染和编辑链路

- `SceneCanvas.ComponentMesh` 仍用 box 占位渲染组件。
- box 尺寸来自实例 `component.size` 或 catalog `defaultSize`。
- 颜色来自实例 `component.material.color` 或 catalog `fallbackColor`。
- `assetKey` 和 `assetUrl` 当前还没有被渲染消费。
- TransformControls 操作完成后调用 `updateComponentTransform()` 写回 store。
- `update-component`、`delete-component` 的撤销/重做分支已经存在。

### 4.5 下一步关键点

组件下一步不是继续扩 catalog 字段，而是实现真实场景互动：

- drop 时把 dnd-kit 的屏幕落点传给 `SceneCanvas`。
- 在 R3F 内部用 raycaster 命中 wall / floor plane。
- wall 组件必须背面贴墙，保存 `placement.anchor` 和 `placement.normal`。
- floor 组件必须底面落地，保存接触点和地面法线。
- free 组件可以使用命中点作为初始位置，但不强制绑定 plane。
- 移动和旋转后要按 placement 做边界 clamp 和 TransformControls commit 约束。
- 真实资产加载应放在接触面规则稳定之后，优先用 `assetKey` 做内置资产 registry，再考虑外部 `assetUrl`。

## 5. 已知限制和风险

- 透视标线相机估算是近似模型，没有做镜头畸变校正。
- 单张图片无法恢复绝对尺度，当前依赖用户标尺和透视线估算。
- 透视生成只输出简化墙角模型，不会自动分割照片里的复杂墙面轮廓。
- 组件 drop 当前只创建默认位置，不使用鼠标落点。
- 组件仍是占位 box，未接入真实模型资产。
- `update-component` 的撤销/重做分支已经补齐，但 TransformControls 仍未按 wall / floor / free 放置规则做约束。
- 地面常驻后，旧的 `toggleFloor()` 类型和 action 仍存在于 store，后续可清理或改成内部工具。
- 目前没有自动化测试，主要验证方式是 `npm run build` 和浏览器手测。

## 6. 建议下一步

优先继续做组件与场景互动，因为组件 catalog 和管理页已经落地，下一步的瓶颈是“组件如何真实落到墙面、地面或空间中”：

1. 给 `EditorPage` / `SceneCanvas` 增加 drop 落点传递和 raycast 解析，把鼠标落点转换成命中的 wall / floor plane。
2. 扩展 `addComponent()`，接受 placement 参数，写入 `placement.anchor`、`placement.normal`、`targetPlaneId`、position 和 rotation。
3. 按 `wall` / `floor` / `free` 三类实现接触面规则：墙面背面贴墙、地面底面落地、自由组件不强制绑定。
4. 增加边界 clamp 和 TransformControls commit 约束，移动后仍保持贴墙或落地。
5. 再接入 `assetKey` / `assetUrl` 的真实资产加载，并让 `propertySchema` 参数影响模型或材质。
