# 组件系统交接文档（2026-07-04）

本文档交接 2026-07-04 这轮组件系统改造的现状，并把下一阶段“组件与场景互动”的开发方案写细。后续如果继续做贴墙、落地、自由摆放、碰撞、资产加载和属性编辑，优先从本文开始读。

## 1. 当前结论

组件系统已经从“底部面板硬编码几个占位组件”升级为“可编辑组件库 + 组件管理页 + 场景实例使用 catalog 默认属性”的结构。

已经落地：

- 新增 `/components_manager` 页面，用于管理组件。
- 组件库按放置规则固定分为 `wall`、`floor`、`free` 三个大类。
- 每个大类下支持自由添加和删除子类，子类只做组件类型细分，不改变放置规则。
- 组件新增、编辑、复制、删除使用弹出层表单。
- 组件字段扩展了购买链接 `purchaseUrls` 和参考价格 `referencePrice`。
- 组件 catalog 从 UI 中抽离到 `src/domain/scene/componentCatalog.ts`。
- 底部组件面板改为读取 catalog，并按 `wall` / `floor` / `free` 过滤。
- `SceneComponent` 已支持 `placement`、`scale`、`size`、`material`、`params` 等后续互动字段。
- `editorStore.addComponent()` 已按组件大类选择合法 plane：墙面组件只绑定 wall plane，地面组件只绑定 floor plane，自由组件不绑定 plane。
- 3D 占位渲染已使用 catalog 的 `defaultSize` 和 `fallbackColor`。
- 右侧属性面板已支持编辑组件的位置、旋转、尺寸、占位颜色和 catalog `propertySchema` 参数。
- catalog 持久化已升级到 version `3`，并通过 `merge` 兜底规范旧 localStorage 数据，避免新增字段导致白屏。

还没有落地：

- 拖拽 drop 后仍然只创建默认偏移位置，没有使用鼠标落点。
- 没有 Three.js raycast 命中墙面或地面。
- `placement.targetPlaneId` 目前是初始绑定，不代表真实接触面。
- 墙面组件还没有保证“背面贴墙，前方朝房间内”。
- 地面组件还没有保证“底面接触地面，上方朝世界上方向”。
- 自由组件没有空间落点或移动边界。
- TransformControls 仍是通用移动/旋转，没有按组件放置规则做约束。
- `assetKey` / `assetUrl` 还没有被场景渲染消费，当前全部用 box 占位。
- 组件和项目的长期保存、导入导出仍未接入主流程。

## 2. 主要文件

| 文件 | 作用 |
| --- | --- |
| `src/app/App.tsx` | 根据 `window.location.pathname` 切到 `/components_manager` 或主编辑器。 |
| `src/app/routes.tsx` | 保留路由表，已包含 `/components_manager`，当前没有真正接入路由库。 |
| `src/domain/scene/types.ts` | 定义 `ComponentPlacementMode`、`ComponentPlacement`、`SceneComponent`、组件属性 schema 等类型。 |
| `src/domain/scene/componentCatalog.ts` | 组件 catalog、三大放置类、默认子类、默认组件、Zustand 持久化 store、迁移和规范化函数。 |
| `src/features/components-manager/ComponentsManagerPage.tsx` | 组件管理页，包含分类树、组件列表、组件编辑弹窗、子类增删。 |
| `src/features/component-palette/ComponentPalette.tsx` | 底部组件面板，从 catalog 读取组件，按 activeCategory 过滤并作为拖拽源。 |
| `src/editor/EditorPage.tsx` | dnd-kit drop 入口，当前 drop 后调用 `addComponent(kind)`。 |
| `src/editor/editorStore.ts` | 主编辑 store，创建组件实例、更新组件 transform、删除组件、撤销重做。 |
| `src/features/scene3d/SceneCanvas.tsx` | 3D 场景，当前用 box 渲染组件，并通过 TransformControls 写回位置和旋转。 |
| `src/features/properties/PropertyPanel.tsx` | 右侧属性面板，编辑选中组件的 transform、尺寸、颜色和专属参数。 |
| `src/styles.css` | 组件管理页、分类树、弹窗、组件面板和属性面板相关样式。 |

## 3. Catalog 数据模型

### 3.1 三大放置类

类型定义：

```ts
export type ComponentPlacementMode = 'wall' | 'floor' | 'free'
```

当前三大类：

- `wall`：墙面。组件必须与墙面有一个接触面。
- `floor`：地面。组件必须与地面有一个接触面。
- `free`：自由。组件可以不绑定 plane，自由摆放。

这三个大类是业务规则，不建议允许用户删除或改名。它们决定组件后续能命中哪类场景表面、如何自动朝向、移动时如何被约束。

### 3.2 子类

类型定义：

```ts
export type ComponentSubcategory = {
  id: string
  label: string
  placement: ComponentPlacementMode
}
```

子类只用于组件库细分，例如墙面下的“攀爬结构”“墙面装饰”，地面下的“休息区”“喂食区”。子类不参与 3D 放置校验。

当前行为：

- 用户可以在每个大类下添加子类。
- 用户可以删除子类。
- 删除子类后，原来挂在该子类下的组件会保留，但 `subcategoryId` 会被清空，显示为“未分类”。
- 子类的 `placement` 必须和组件的 `placement` 一致；`normalizeCatalogItem()` 会自动丢弃不匹配的子类绑定。

### 3.3 组件条目

类型定义：

```ts
export type ComponentCatalogItem = {
  kind: SceneComponentKind
  label: string
  detail: string
  icon: string
  placement: ComponentPlacementMode
  subcategoryId?: string
  defaultSize: Vec3
  defaultRotation: Vec3
  fallbackColor: string
  assetKey?: string
  assetUrl?: string
  purchaseUrls: string[]
  referencePrice?: number
  propertySchema: ComponentPropertySchema[]
}
```

字段说明：

| 字段 | 当前用途 | 后续互动用途 |
| --- | --- | --- |
| `kind` | 组件唯一 ID，拖拽和创建实例都靠它查 catalog。 | 需要作为项目保存、资产匹配和统计的稳定 key。 |
| `label` | 管理页、底部组件面板和实例默认名称。 | 可用于场景标签、属性面板标题。 |
| `detail` | 组件卡片和列表说明。 | 可用于选中提示或搜索。 |
| `icon` | 图标 key，当前管理页可编辑，但底部面板仍统一显示 `Boxes` 图标。 | 后续应映射到 lucide icon 或自定义 icon registry。 |
| `placement` | 当前决定底部 tab、组件大类、初始 targetPlane 选择。 | 后续决定 raycast 目标、接触面、移动约束和旋转约束。 |
| `subcategoryId` | 分类树中的小类归属。 | 只做筛选，不应影响放置规则。 |
| `defaultSize` | 当前 `SceneCanvas.ComponentMesh` 的 box 尺寸。 | 后续用于接触面偏移、边界裁剪和碰撞盒。 |
| `defaultRotation` | 创建组件实例时的默认旋转。 | 后续作为贴面/落地后的附加旋转。 |
| `fallbackColor` | 当前 box 占位颜色，属性面板可改。 | 资产加载失败时继续作为 fallback 材质。 |
| `assetKey` | 资产 key，当前没有被渲染消费。 | 后续用于从内置资产 registry 找 GLTF、贴图或程序化组件。 |
| `assetUrl` | 外部资产 URL，当前没有被渲染消费。 | 后续可直接加载用户输入的 GLTF/图片，需做格式和跨域校验。 |
| `purchaseUrls` | 购买链接数组，管理页 textarea 每行一个 URL。 | 后续可在详情页、采购清单、报价导出中使用。 |
| `referencePrice` | 参考价格，管理页列表显示。 | 后续可用于预算统计。 |
| `propertySchema` | 当前右侧属性面板可渲染 number / boolean / color / text 参数。 | 后续应驱动真实模型参数、材质、开关和导出数据。 |

### 3.4 Catalog 持久化

store：

```ts
useComponentCatalogStore
```

localStorage key：

```txt
cat-wall-component-catalog
```

persist version：

```txt
3
```

重要维护规则：

- 给 `ComponentCatalogItem` 增加非可选字段时，必须同步处理旧 localStorage 数据。
- 现在已经有 `migrate` 和 `merge` 双层兜底：
  - `migrateCatalogState()` 用于版本迁移。
  - `merge()` 每次 rehydrate 都会规范 persisted state，防止旧对象缺字段。
- `normalizeCatalogItem()` 会做以下清洗：
  - `kind`、`label`、`detail`、`icon` 去空格。
  - `placement` 归一到 `wall` / `floor` / `free`。
  - `subcategoryId` 必须存在且 placement 匹配。
  - `defaultSize`、`defaultRotation` 兜底为合理 Vec3。
  - `purchaseUrls` 归一为字符串数组，并过滤空值。
  - `referencePrice` 转为 number 或 `undefined`。
  - `propertySchema` 的 `id` 和 `label` 做基本清洗。

上一次白屏原因是新增 `purchaseUrls` 后旧 localStorage 里没有该字段，页面读取 `.length` 报错。后续类似改字段要先想持久化迁移。

## 4. 组件管理页

访问地址：

```txt
http://127.0.0.1:5173/components_manager
```

页面入口：

- `src/app/App.tsx` 根据 pathname 直接渲染 `ComponentsManagerPage`。
- `src/app/routes.tsx` 中也保留了 `/components_manager` 配置，但当前项目没有接入 React Router。

### 4.1 页面结构

左侧是分类树：

- 根节点固定为墙面、地面、自由。
- 点击根节点显示该大类下所有组件。
- 根节点下面显示可编辑子类。
- 点击子类只显示该子类下的组件。
- 子类旁边有删除按钮。
- 每个大类底部有新增子类输入框。

右侧是组件列表：

- 显示颜色、名称、组件 ID、描述、参考价格、购买链接数量、子类和操作。
- 操作包括编辑、复制、删除。
- 顶部保留新增组件按钮。

组件编辑使用弹出层：

- 新增组件会默认归到当前选中的大类；如果当前选中子类，则默认归到该子类。
- 切换大类时，会自动选择该大类下第一个子类。
- 保存时会用 `normalizeCatalogItem()` 清洗。
- 编辑时如果修改了 `kind`，会先删除旧 ID，再新增新组件。
- 重置按钮会恢复默认 catalog 和默认子类。

### 4.2 购买链接输入

`purchaseUrls` 在弹窗里是 textarea，每行一个链接。

当前实现保留输入中的换行，保存时再通过 `normalizeUrlList()` 过滤空行。这是为了允许用户手动换行输入多个 URL。

维护注意：

- 不要在 textarea 的 `onChange` 里立刻 trim 或 filter 空行，否则用户按 Enter 时尾部空行会消失，看起来像“不能换行”。
- 列表页读取链接数量时继续使用 `(component.purchaseUrls ?? []).length`，避免旧数据缺字段导致白屏。

## 5. 主编辑器中的组件链路

### 5.1 底部组件面板

文件：

```txt
src/features/component-palette/ComponentPalette.tsx
```

当前逻辑：

- 从 `useEditorStore` 读取 `activeCategory`。
- 从 `useComponentCatalogStore` 读取 `components`。
- 根据 `component.placement === activeCategory` 过滤。
- 三个 tab 来自 `componentPlacementGroups`。
- 每个组件卡片通过 `useDraggable({ id: kind, data: { kind } })` 作为 dnd-kit 拖拽源。

当前限制：

- 只按大类过滤，没有显示子类。
- 组件卡片仍统一使用 `Boxes` 图标，没有按 `icon` 映射。
- 没有搜索、收藏、资产预览或价格信息。

### 5.2 Drop 入口

文件：

```txt
src/editor/EditorPage.tsx
```

当前逻辑：

```ts
function handleDragEnd(event: DragEndEvent) {
  if (event.over?.id !== 'scene-drop-zone') return
  const kind = event.active.data.current?.kind as SceneComponentKind | undefined
  if (kind) addComponent(kind)
}
```

当前只知道“拖进了 3D 工作区”，不知道最终鼠标落点，也不知道命中了哪面墙或哪块地。

下一阶段要把 `addComponent(kind)` 改造成带 placement 输入的版本。

### 5.3 创建组件实例

文件：

```txt
src/editor/editorStore.ts
```

当前创建流程：

1. 用 `kind` 查 `getComponentCatalogItem(kind)`。
2. 读取 `catalogItem.placement`，默认 `free`。
3. 如果是 `wall` 或 `floor`：
   - 优先使用当前选中的、类型匹配的 plane。
   - 否则使用第一个类型匹配的 plane。
4. 如果是 `free`，不绑定 plane。
5. 用 catalog 的 `defaultSize`、`defaultRotation`、`fallbackColor`、`propertySchema.defaultValue` 创建实例。
6. position 仍是基于组件数量的默认错位。

当前生成的 `SceneComponent` 主要结构：

```ts
{
  id,
  kind,
  name,
  targetPlaneId,
  placement: {
    mode: placementMode,
    targetPlaneId,
  },
  position,
  rotation,
  scale: { x: 1, y: 1, z: 1 },
  size,
  material: { color: catalogItem?.fallbackColor },
  params,
}
```

### 5.4 场景渲染

文件：

```txt
src/features/scene3d/SceneCanvas.tsx
```

当前组件渲染：

- `SceneCanvas` 遍历 `project.components`。
- `ComponentMesh` 用 `component.size ?? catalogItem.defaultSize` 作为 `boxGeometry` 尺寸。
- `component.scale` 会传给 mesh scale。
- `component.material.color ?? catalogItem.fallbackColor` 作为占位色。
- 点击组件调用 `selectSceneObject(component.id)`。
- 选中后 `TransformControls` 绑定 mesh，移动或旋转结束后写回 store。

当前没有使用：

- `assetKey`
- `assetUrl`
- `placement.anchor`
- `placement.normal`
- `targetPlaneId` 的真实表面关系

### 5.5 属性面板

文件：

```txt
src/features/properties/PropertyPanel.tsx
```

当前组件已支持：

- 位置：编辑 `component.position`。
- 旋转：编辑 `component.rotation`。
- 尺寸：编辑 `component.size`。
- 颜色：编辑 `component.material.color`。
- 参数：根据 catalog `propertySchema` 编辑 `component.params`。

注意：

- `propertySchema` 现在只是数据面板，不会驱动 `ComponentMesh` 的形状。
- 如果后续真实模型需要参数化，需要在渲染层读取 `params`。

## 6. 组件与场景互动的目标规则

下一阶段建议先明确三大类的物理语义：

### 6.1 墙面组件 `wall`

业务规则：

- 必须绑定一个 `PlaneSpec.type === 'wall'` 的墙面。
- 必须与墙面有接触面。
- 组件中心应从命中点沿墙面法线向房间内偏移 `size.z / 2`，保证背面贴墙。
- 组件局部 `X` 是横向宽度，局部 `Y` 是高度，局部 `Z` 是离墙深度。
- 组件移动时只能在目标墙面的二维范围内移动，不能脱离墙面。
- 默认旋转应让组件正面朝房间内，且保持竖直。

需要保存：

- `placement.mode = 'wall'`
- `placement.targetPlaneId`
- `placement.anchor`：墙面接触点，世界坐标。
- `placement.normal`：墙面向房间内的世界法线。
- `position`：组件中心点，通常是 `anchor + normal * size.z / 2`。
- `rotation`：由墙面 basis 和 catalog defaultRotation 合成。

### 6.2 地面组件 `floor`

业务规则：

- 必须绑定一个 `PlaneSpec.type === 'floor'` 的地面。
- 必须与地面有接触面。
- 组件中心应从命中点沿地面法线向上偏移 `size.y / 2`，保证底面落地。
- 组件局部 `X` 和 `Z` 是地面足迹，局部 `Y` 是高度。
- 组件移动时只能在地面范围内移动。
- 默认只允许绕地面法线旋转，也就是一般场景中的 yaw。

需要保存：

- `placement.mode = 'floor'`
- `placement.targetPlaneId`
- `placement.anchor`：地面接触点，世界坐标。
- `placement.normal`：通常接近世界上方向。
- `position`：组件中心点，通常是 `anchor + normal * size.y / 2`。
- `rotation`：地面对齐旋转 + catalog defaultRotation。

### 6.3 自由组件 `free`

业务规则：

- 可以不绑定 plane。
- 如果 drop 时命中了墙面或地面，可以把命中点作为初始位置参考，但不强制接触。
- 可以自由移动和旋转。
- 后续可选做吸附辅助，但不要隐式改变为 `wall` 或 `floor` 规则。

需要保存：

- `placement.mode = 'free'`
- 可选 `placement.anchor`
- 可选 `placement.normal`
- `targetPlaneId` 通常为空。

## 7. 推荐新增的放置计算模块

建议新增独立领域模块，避免把 raycast、贴面、边界和 store 写成一团：

```txt
src/domain/scene/componentPlacement.ts
```

建议职责：

- 把 raycast 命中结果转成稳定的 `ComponentPlacementInput`。
- 根据组件类型和 plane 类型判断是否可放置。
- 计算墙面/地面的接触点、中心点和旋转。
- 把接触点 clamp 到 plane 边界内。
- 给 TransformControls 提供移动/旋转后的约束函数。

建议类型：

```ts
export type ComponentPlacementHit = {
  planeId: string
  planeType: PlaneType
  point: Vec3
  normal: Vec3
  localPoint: Vec3
  surface: 'front' | 'back' | 'top' | 'side'
}

export type ComponentPlacementInput = {
  mode: ComponentPlacementMode
  targetPlaneId?: string
  anchor?: Vec3
  normal?: Vec3
  position?: Vec3
  rotation?: Vec3
}

export type ComponentPlacementResult = {
  canPlace: boolean
  reason?: string
  placement: ComponentPlacement
  position: Vec3
  rotation: Vec3
}
```

核心函数建议：

```ts
export function canPlaceOnHit(
  mode: ComponentPlacementMode,
  hit: ComponentPlacementHit,
): boolean

export function buildComponentPlacement(
  catalogItem: ComponentCatalogItem,
  hit: ComponentPlacementHit | null,
  planes: PlaneSpec[],
): ComponentPlacementResult

export function clampAnchorToPlaneBounds(
  anchor: Vec3,
  plane: PlaneSpec,
  componentSize: Vec3,
  mode: ComponentPlacementMode,
): Vec3

export function constrainComponentTransform(
  component: SceneComponent,
  patch: Partial<SceneComponent>,
  planes: PlaneSpec[],
  catalogItem?: ComponentCatalogItem,
): Partial<SceneComponent>
```

## 8. Raycast drop 实现建议

当前 `EditorPage.handleDragEnd()` 在 React DOM 层，拿不到 R3F 内部的 camera、scene 和 raycaster。推荐不要在 `EditorPage` 里直接做 Three.js 计算，而是把 drop 请求放进 store，由 `SceneCanvas` 内部解析。

### 8.1 推荐数据流

```txt
ComponentPalette useDraggable
  -> EditorPage.handleDragEnd()
  -> editorStore.requestComponentPlacement({ kind, clientPoint })
  -> SceneCanvas 内部 PlacementResolver 监听 pending request
  -> 使用 useThree() 的 camera / gl / raycaster 做 raycast
  -> 得到 ComponentPlacementHit
  -> editorStore.addComponent(kind, placementInput)
```

### 8.2 DragEnd 中计算屏幕点

dnd-kit `DragEndEvent` 可以优先用拖拽元素 translated rect 的中心点作为 drop 点：

```ts
const rect = event.active.rect.current.translated ?? event.active.rect.current.initial
const clientPoint = rect
  ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  : null
```

如果 rect 为空，再 fallback 到当前鼠标位置缓存。鼠标位置缓存可以在 `onDragMove` 中更新。

### 8.3 SceneCanvas 内部解析

建议在 `SceneCanvas.tsx` 里新增一个很小的内部组件：

```tsx
function PlacementResolver() {
  const pendingPlacement = useEditorStore((state) => state.pendingPlacement)
  const consumePlacement = useEditorStore((state) => state.consumePlacement)
  const addComponent = useEditorStore((state) => state.addComponent)
  const { camera, gl, scene, raycaster } = useThree()

  useEffect(() => {
    if (!pendingPlacement) return
    const hit = resolveSceneHit(pendingPlacement.clientPoint, camera, gl, scene, raycaster)
    addComponent(pendingPlacement.kind, hit)
    consumePlacement(pendingPlacement.id)
  }, [pendingPlacement, camera, gl, scene, raycaster])

  return null
}
```

注意：上面是结构示意，不是可直接粘贴的最终代码。`addComponent()` 的签名需要先扩展。

### 8.4 只命中 plane，不命中组件

当前组件也是 mesh，raycast 时应只测试墙面和地面 mesh。建议给 plane mesh 加：

```ts
mesh.userData = {
  kind: 'plane',
  planeId: plane.id,
  planeType: plane.type,
}
```

解析时只保留 `object.userData.kind === 'plane'` 的命中。

如果使用 thick box 墙体，raycast 可能命中墙体侧边。需要根据 `intersection.face.normal` 转世界法线后筛掉不合法表面：

- `wall` 组件：只接受 `plane.type === 'wall'`，并且命中法线主要是水平面法线，不接受墙体厚度侧边。
- `floor` 组件：只接受 `plane.type === 'floor'`，并且命中法线接近向上。
- `free` 组件：可接受任意 plane 命中，也可在没有命中时放到默认位置。

## 9. 对齐、接触和旋转算法

### 9.1 墙面组件

假设 box 的局部轴约定：

- 局部 `X`：组件宽度。
- 局部 `Y`：组件高度。
- 局部 `Z`：组件深度，正方向朝房间内。

放置计算：

```txt
anchor = clamp(hit.point, wall plane bounds)
normal = wall front normal
position = anchor + normal * (size.z * scale.z / 2)
rotation = rotationFromBasis(wallRight, wallUp, normal) + defaultRotation
```

墙面 basis：

- `normal` 来自命中面世界法线，方向必须朝房间内。
- `wallUp` 建议先用世界上方向 `{ x: 0, y: 1, z: 0 }` 投影到墙面平面，如果太接近平行再用 plane 自身 local up。
- `wallRight = normalize(cross(wallUp, normal))`。
- 重新计算 `wallUp = normalize(cross(normal, wallRight))`，保证正交。

接触关系：

- 组件背面接墙。
- 组件中心点一定沿 normal 偏离半个 depth。
- 如果用户改尺寸，position 要重新根据 anchor 和新 depth 计算，否则会穿墙或离墙。

### 9.2 地面组件

假设 box 的局部轴约定：

- 局部 `X`：宽度。
- 局部 `Y`：高度。
- 局部 `Z`：深度。

放置计算：

```txt
anchor = clamp(hit.point, floor plane bounds)
normal = floor top normal
position = anchor + normal * (size.y * scale.y / 2)
rotation = floorAlignedYaw + defaultRotation
```

第一版可以简单把地面 normal 视作世界上方向。后续如果地面允许倾斜，再按 normal 构建 basis。

### 9.3 自由组件

推荐第一版策略：

- drop 命中 plane：`position = hit.point + hit.normal * 0.08`。
- drop 未命中：沿相机方向投影到工作区默认平面，例如 `y = 0.5`。
- `rotation = catalog.defaultRotation`。
- 不设置 `targetPlaneId`。

## 10. 边界约束

### 10.1 为什么必须做边界约束

墙面和地面组件的“接触面”只有在组件接触点落在 plane 内部时才成立。如果只保存世界坐标，用户移动组件后很容易出现：

- 墙面挂件悬在墙外。
- 地面猫窝半个露出地面范围。
- 组件中心还在墙上，但真实尺寸已经穿出边界。

### 10.2 墙面边界

用墙面局部坐标判断：

```txt
minX = -plane.width / 2 + componentWidth / 2
maxX =  plane.width / 2 - componentWidth / 2
minY = -plane.height / 2 + componentHeight / 2
maxY =  plane.height / 2 - componentHeight / 2
```

将 anchor 转到 plane local space 后 clamp `x` 和 `y`，再转回世界坐标。

### 10.3 地面边界

用地面局部坐标判断：

```txt
minX = -plane.width / 2 + componentWidth / 2
maxX =  plane.width / 2 - componentWidth / 2
minZ = -plane.height / 2 + componentDepth / 2
maxZ =  plane.height / 2 - componentDepth / 2
```

地面 `PlaneSpec.height` 当前代表第二个平面尺寸，不一定语义叫“深度”，写代码时要注意命名，最好在 placement helper 里封装。

### 10.4 超大组件处理

如果组件尺寸大于 plane：

- 第一版建议允许创建，但把 anchor clamp 到中心，并在属性面板或场景描边显示警告。
- 不建议静默缩放组件，否则用户会困惑 catalog 默认尺寸为什么变了。
- 后续可加“自动适配到墙面/地面”按钮，由用户明确触发。

## 11. 移动和旋转约束

当前 TransformControls 允许任意移动和旋转。下一阶段建议先在 commit 时做约束，再考虑实时预览约束。

### 11.1 第一版 commit 约束

在 `updateComponentTransform()` 前增加：

```txt
raw transform from TransformControls
  -> constrainComponentTransform()
  -> write constrained position / rotation / placement
```

规则：

- `wall`：把移动后的中心点反推为 `anchor = center - normal * depth / 2`，投影回目标 wall plane，再 clamp 到墙面范围，最后重新计算 center。
- `floor`：把移动后的中心点反推为 `anchor = center - normal * height / 2`，投影回目标 floor plane，再 clamp 到地面范围，最后重新计算 center。
- `free`：保持原 transform。

### 11.2 实时约束

后续如果需要拖动过程中就贴面，可以监听 TransformControls 的 `onObjectChange`：

- 每一帧把 mesh 的 position 投影回合法 plane。
- 选中 wall 组件时禁用会脱离墙面的轴。
- 选中 floor 组件时禁用垂直移动轴。

如果使用 drei `TransformControls` 难以细化轴限制，可以后续改成自定义 2D surface gizmo：

- 墙面组件：在墙面局部 X/Y 平面拖动。
- 地面组件：在地面局部 X/Z 平面拖动。
- 自由组件：继续用通用 gizmo。

### 11.3 旋转约束

建议规则：

- `wall`：第一版只允许绕墙面 normal 旋转，也就是挂件在墙上转角度；不允许绕 X/Y 使背面脱墙。
- `floor`：第一版只允许绕地面 normal 旋转，也就是 yaw。
- `free`：允许全轴旋转。

实现上可以先在 commit 时清洗 rotation，再在 UI 上逐步隐藏非法轴。

## 12. 组件碰撞和间距

碰撞不必第一天做成强阻止，但需要尽早设计数据结构。

推荐第一版检测：

- 对于 `wall` 和 `floor`，在目标 plane 的局部二维坐标中计算矩形。
- 墙面矩形：`anchor.x/y + size.x/y`。
- 地面矩形：`anchor.x/z + size.x/z`。
- 只检测同一 `targetPlaneId` 上的组件。
- `free` 组件可以先跳过碰撞。

可用策略：

- `allow`：允许重叠，只显示提示。
- `warn`：保存但标黄。
- `block`：阻止放置。

建议第一版用 `warn`，因为组件资产和尺寸还不稳定，强阻止会影响试错。

## 13. 资产加载计划

当前 `assetKey` 和 `assetUrl` 都只是 metadata。

推荐分两步：

### 13.1 内置资产 key

新增资产 registry：

```txt
src/domain/scene/componentAssets.ts
```

示意：

```ts
export const componentAssetRegistry = {
  'cat-shelf-placeholder': {
    type: 'procedural',
    renderer: 'catShelfBox',
  },
  'cat-bed-gltf-v1': {
    type: 'gltf',
    url: '/assets/components/cat-bed.glb',
  },
}
```

优先使用 `assetKey` 找内置资产，找不到时 fallback 到 box。

### 13.2 外部 assetUrl

`assetUrl` 可用于用户输入外部模型地址，但需要注意：

- 只允许明确支持的格式，例如 `.glb` / `.gltf`。
- 处理跨域失败。
- 加载失败时回退 `fallbackColor` box。
- 未来如果保存项目，需要考虑外链失效问题。

渲染层建议：

- `ComponentMesh` 根据 asset 选择 GLTF、程序化 mesh 或 fallback box。
- 无论使用哪种资产，都必须保持统一外层 group 的 position / rotation / scale。
- 接触和碰撞先以 catalog `defaultSize` 或实例 `size` 为准，不要直接依赖模型 bounding box，避免加载异步导致放置结果跳动。

## 14. 数据保存和迁移

组件 catalog 和场景实例是两套数据：

- catalog：组件库定义，存在 `cat-wall-component-catalog` localStorage。
- scene component：某个项目里的组件实例，存在 `project.components`。

后续项目持久化时必须保存实例字段：

```ts
SceneComponent {
  id,
  kind,
  name,
  targetPlaneId,
  placement,
  position,
  rotation,
  scale,
  size,
  material,
  params,
}
```

注意：

- `kind` 应稳定指向 catalog；如果 catalog 删除了该 kind，项目仍应能用实例内保存的 `name`、`size`、`material` 做 fallback 渲染。
- `placement.targetPlaneId` 如果对应 plane 被删除，需要提供重新吸附或转自由摆放的降级策略。
- catalog 字段升级要继续 bump persist version。
- 项目字段升级应放在 `src/persistence/serializers.ts` 做版本迁移，当前 serializers 还只是 `JSON.stringify()` / `JSON.parse()`。

## 15. 建议开发步骤

### Step 1：扩展 store 的放置请求

目标：

- `EditorPage` 不再直接调用 `addComponent(kind)`。
- 先把 drop 点放进 store，交给 `SceneCanvas` 解析。

建议改动：

- `EditorStore` 新增 `pendingComponentPlacement`。
- 新增 action：
  - `requestComponentPlacement(kind, clientPoint)`
  - `consumeComponentPlacement(id)`
  - `addComponent(kind, placementInput?)`

验收：

- 旧行为仍可 fallback 创建组件。
- 不会影响已有拖拽。

### Step 2：SceneCanvas raycast 命中 plane

目标：

- 根据 drop 点命中 3D 中的墙面或地面。

建议改动：

- 给 `PlaneMesh` 标记 `userData`。
- 新增 `PlacementResolver`。
- 新增 `resolveScenePlacementHit()`。

验收：

- 拖墙面组件到墙上，能拿到 wall plane id、世界命中点和 normal。
- 拖地面组件到地上，能拿到 floor plane id、世界命中点和 normal。
- 拖错表面时 fallback 或提示，不产生非法绑定。

### Step 3：实现接触面放置

目标：

- wall 组件真的贴墙。
- floor 组件真的落地。
- free 组件保持自由。

建议改动：

- 新增 `src/domain/scene/componentPlacement.ts`。
- `addComponent(kind, placementInput)` 调用 placement helper。
- 创建实例时保存 `placement.anchor` 和 `placement.normal`。

验收：

- 墙面组件中心与墙面距离约等于 `size.z / 2`。
- 地面组件中心高度约等于 `size.y / 2`。
- 自由组件不会绑定 targetPlane。

### Step 4：边界 clamp

目标：

- 组件不会初始放到墙外或地面外。

建议改动：

- `clampAnchorToPlaneBounds()`。
- 大组件超界时返回 warning。

验收：

- 拖到墙边时组件仍完全在墙面范围内。
- 拖到地面边缘时组件不会半个露出地面。

### Step 5：TransformControls commit 约束

目标：

- 用户移动已放置组件后，仍保持贴墙或落地规则。

建议改动：

- 在 `updateComponentTransform()` 中调用 `constrainComponentTransform()`。
- 或新建 `commitComponentTransform()` 专门处理 TransformControls 提交。

验收：

- wall 组件移动后仍贴目标墙。
- floor 组件移动后仍贴目标地面。
- free 组件不受限制。
- 撤销/重做仍恢复正确位置。

### Step 6：组件互动状态和提示

目标：

- 用户知道为什么某个组件不能放在某个位置。

建议改动：

- drop 错表面时显示短提示。
- 组件超出边界时显示警告状态。
- 属性面板显示绑定对象：墙面 / 地面 / 自由。

验收：

- 墙面组件拖到地面时不会静默跑到默认墙面。
- 地面组件拖到墙面时有明确反馈。

### Step 7：资产加载

目标：

- 组件从 box 占位逐步过渡到真实模型。

建议改动：

- 新增 asset registry。
- `ComponentMesh` 增加资产分支。
- 加载失败继续 fallback box。

验收：

- 未配置资产的组件保持现有 box。
- 配置 `assetKey` 的组件能显示对应模型。
- 资产加载不影响 placement 计算。

## 16. 测试建议

当前项目没有自动化测试，建议在做组件互动时补最小单元测试。优先测纯函数，避免一开始就测 R3F。

建议测试文件：

```txt
src/domain/scene/componentPlacement.test.ts
src/domain/scene/componentCatalog.test.ts
```

建议测试点：

- `normalizeCatalogItem()` 能补齐旧数据缺失的 `purchaseUrls`。
- 子类 placement 不匹配时会被清空。
- wall 组件只能放在 wall hit。
- floor 组件只能放在 floor hit。
- free 组件可接受无 hit。
- wall position = anchor + normal * depth / 2。
- floor position = anchor + normal * height / 2。
- anchor 会被 clamp 到 plane 范围内。
- 超大组件会返回 warning。
- `propertySchema.defaultValue` 能生成 `component.params`。

浏览器手测清单：

- 打开 `/components_manager` 不白屏。
- 新增子类、删除子类、重置 catalog 正常。
- 新增组件填写多个购买链接，手动换行保留。
- 编辑参考价格后列表显示价格。
- 主编辑器底部 tab 按墙面、地面、自由过滤。
- 墙面组件不会默认绑定地面。
- 地面组件不会默认绑定墙面。
- 自由组件不绑定 plane。
- 选中组件后右侧属性面板能改位置、旋转、尺寸、颜色和专属参数。
- 移动组件后撤销/重做正常。

## 17. 当前风险

- `App.tsx` 用 pathname 手写路由，后续多页面增加时建议正式接入路由。
- catalog store 和 editor store 分离，组件库改动会影响新创建组件，但不会自动迁移已存在实例。
- `icon`、`assetKey`、`assetUrl` 当前可编辑但未消费，容易让用户误解为已经生效。
- `referencePrice` 当前只能填单个数字，没有币种和区间。
- `purchaseUrls` 当前只保存 URL 字符串，没有平台名、备注、是否首选。
- TransformControls 不受规则约束，做贴墙/落地前不要宣称组件已满足真实放置规则。
- thick wall geometry 有厚度，raycast 时必须筛掉侧边命中，否则墙面组件可能吸到墙体边缘。
- 如果后续墙体 rotation / size 变化，已绑定组件需要跟随更新，当前还没有“plane transform 影响子组件”的机制。

## 18. 推荐阅读顺序

继续开发组件互动时建议按这个顺序读：

1. `docs/cat-wall-component-system-handoff-2026-07-04.md`
2. `src/domain/scene/types.ts`
3. `src/domain/scene/componentCatalog.ts`
4. `src/editor/editorStore.ts` 中 `addComponent()`、`updateComponentTransform()` 和 history 相关分支
5. `src/editor/EditorPage.tsx` 中 dnd-kit drop 入口
6. `src/features/scene3d/SceneCanvas.tsx`
7. `src/features/properties/PropertyPanel.tsx`
8. `src/features/components-manager/ComponentsManagerPage.tsx`

