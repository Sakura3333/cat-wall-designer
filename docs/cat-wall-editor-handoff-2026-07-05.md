# Cat Wall Editor 3D 编辑器交接文档（2026-07-05）

> **2026-07-16 状态说明：** 本文保留 2026-07-05 前后的历史交接记录；后续已继续完成施工图、禁用区域、真实资产、面板小屏优化、误选修复和商业化/AI CAD 方向文档。继续开发请先读 `docs/cat-wall-editor-handoff-2026-07-16.md`。

本文交接 2026-07-05 前后完成的 3D 编辑器主线开发与后续修复。继续开发前建议先读：

1. `docs/cat-wall-editor-dev-spec.md`
2. `docs/cat-wall-component-system-handoff-2026-07-04.md`
3. 本文档

当前分支为 `main`，最新提交为 `8b19242 fix: anchor wall components on wall surface`。

## 当前结论

编辑器已经从“组件只能默认创建在某个 plane 上”的阶段，推进到“拖拽组件时按屏幕落点 raycast 命中 3D 墙面/地面，并按 wall/floor/free 规则生成、约束、反馈和持久化”的阶段。

当前已具备：

- 工程基线：README、Git 忽略规则、Vitest 单元测试。
- 组件放置管线：dnd-kit drop 点进入 store，由 R3F 场景解析命中的 plane。
- 放置规则：墙面组件贴墙、地面组件落地、自由组件按命中点偏移。
- 边界约束：放置和移动时会把 anchor clamp 到目标 plane 范围内。
- Transform 约束：移动组件后仍保持贴墙/落地；墙面组件跨墙移动时会重新选择最近墙面并更新朝向。
- 用户反馈：错误 surface、边界调整、超大组件都有放置反馈；反馈条会自动消失。
- 真实模型：内置 GLB 资产通过 registry 加载，失败时回退到 box 占位。
- 原比例模型：GLB 加载时只做居中，不再按 catalog 尺寸拉伸模型。
- 项目持久化：本地草稿通过 localStorage + IndexedDB 恢复，支持 JSON 导入导出。
- 墙体联动：移动墙面时，绑定在墙/地面的组件会跟随 plane transform 更新。
- 墙表面锚定：墙面组件锚点修正到可见墙体表面，避免嵌进厚墙。

## 已完成主线

### 1. 工程基线

相关提交：`a2c124a chore: add engineering baseline`

完成内容：

- 增加 `README.md`，写清运行、构建和测试方式。
- 增加 `.gitattributes`、补充 `.gitignore`。
- 引入 Vitest，增加几何和 catalog 基础测试。
- 初始测试覆盖：
  - `src/domain/geometry/buildPolygons.test.ts`
  - `src/domain/scene/componentCatalog.test.ts`

维护建议：

- 新增纯领域逻辑时优先写单元测试，不要一开始就测 R3F 组件。
- 当前测试入口为 `npm run test`。

### 2. 组件 drop 到 3D plane 的命中管线

相关提交：`43be61d feat: resolve component drop targets`

关键文件：

- `src/editor/EditorPage.tsx`
- `src/editor/editorStore.ts`
- `src/features/scene3d/SceneCanvas.tsx`
- `src/domain/scene/types.ts`

完成内容：

- `EditorPage` 不再直接 `addComponent(kind)`，而是记录拖拽结束时的屏幕点。
- `editorStore` 增加：
  - `pendingComponentPlacement`
  - `requestComponentPlacement(kind, clientPoint)`
  - `consumeComponentPlacement(id)`
- `SceneCanvas` 内部增加 `PlacementResolver`，通过 `useThree()` 拿到 camera、canvas、scene、raycaster，把屏幕点转成 raycast 命中。
- `PlaneMesh` 使用 `userData={{ kind: 'plane', planeId, planeType }}` 标记，使 raycast 只解析墙/地面，不把组件自身当放置目标。
- 命中结果保存 `planeId`、`planeType`、命中点、法线和 surface 类型。

当前 surface 约定：

- floor 只接受 `top`。
- wall 接受 `front` / `back`，拒绝厚墙侧边 `side`。
- free 接受任意命中的 plane，但当前无命中时仍会走失败反馈。

### 3. 接触面放置规则和边界 clamp

相关提交：

- `95adc0c feat: place components on contact surfaces`
- `4064f65 test: cover component boundary clamping`

关键文件：

- `src/domain/scene/componentPlacement.ts`
- `src/domain/scene/componentPlacement.test.ts`
- `src/editor/editorStore.ts`
- `src/editor/editorStore.test.ts`

核心函数：

- `canPlaceOnHit(mode, hit)`
- `buildComponentPlacement(spec, hit, planes)`
- `clampAnchorToPlaneBounds(...)`
- `clampAnchorToPlaneBoundsWithWarnings(...)`

当前规则：

- `wall` 组件必须命中 wall plane，组件本地 `-Z` 面贴墙，中心点沿墙面法线偏移 `size.z / 2`。
- `floor` 组件必须命中 floor plane，组件底面落地，中心点沿地面法线偏移 `size.y / 2`。
- `free` 组件按命中点沿命中法线偏移 `0.08`，不绑定 `targetPlaneId`。
- 组件超出 plane 范围时，anchor 会被 clamp 到合法范围，并返回 warning。
- 组件本身大于 plane 时不会被自动缩放，会返回超大 warning。

重要设计选择：

- 不静默缩放组件。用户后来明确要求“模型尺寸不要拉伸，放置时按原尺寸原比例放置”，这个方向和当前实现一致。
- 放置计算依赖 catalog/实例中的 `size` 作为占位尺寸，不依赖 GLB 异步加载后的 bounding box。

### 4. TransformControls 约束和跨墙移动

相关提交：

- `334a5b8 feat: constrain component transforms`
- `18cfe80 fix: constrain component transform previews`
- `0f666b2 fix: reattach wall components across planes`
- `cda6eac fix: track component preview attachment`

关键文件：

- `src/domain/scene/componentPlacement.ts`
- `src/features/scene3d/componentTransformPreview.ts`
- `src/features/scene3d/componentTransformPreview.test.ts`
- `src/features/scene3d/SceneCanvas.tsx`
- `src/editor/editorStore.ts`

完成内容：

- `updateComponentTransform()` 写回前会调用 `constrainComponentTransform()`。
- TransformControls 拖动预览过程中调用 `applyConstrainedComponentTransformPreview()`，让屏幕上预览和最终提交保持一致。
- 墙面组件移动时会持续评估最近 wall plane，跨墙时更新：
  - `targetPlaneId`
  - `placement.anchor`
  - `placement.normal`
  - `position`
  - 必要时更新 `rotation`
- 墙面组件跨墙移动后，朝向会按新墙面重新对齐，避免模型仍保持旧墙朝向。
- 预览阶段会跟踪最新 attachment 状态，避免在两块墙之间反复拖动时朝向漂移。

接手注意：

- 当前逻辑是基于通用 TransformControls 做约束，不是自定义二维 surface gizmo。
- 如果后续要提升手感，可以为墙面组件单独做“墙面局部 X/Y 平面拖动”的 gizmo。
- 目前 wall 组件会在拖动过程中跨墙重绑定；floor 组件仍绑定原 floor。

### 5. 放置反馈

相关提交：

- `bbbd344 feat: surface component placement feedback`
- `9194eb6 fix: keep wall layouts and bound components aligned`

关键文件：

- `src/domain/scene/types.ts`
- `src/editor/editorStore.ts`
- `src/editor/EditorPage.tsx`
- `src/features/properties/PropertyPanel.tsx`
- `src/styles.css`

完成内容：

- `ComponentPlacementFeedback` 区分 `info`、`warning`、`error`。
- drop 到错误 surface 时不再静默创建到默认 plane，而是反馈原因。
- 组件被 clamp 或过大时反馈 warning。
- 属性面板显示绑定对象和放置模式。
- `PlacementFeedbackStrip` 支持关闭按钮。
- 反馈条自动消失：
  - `info` / `warning`：约 3200ms
  - `error`：约 5200ms
- 样式已压缩字体和占位，减少对 3D 编辑区域的遮挡。

### 6. 真实 GLB 资产与原比例放置

相关提交：

- `5c2cf4a feat: load component glb assets`
- `e162e0b fix: preserve glb asset proportions`

关键文件：

- `src/domain/scene/componentAssets.ts`
- `src/domain/scene/componentAssets.test.ts`
- `src/domain/scene/componentCatalog.ts`
- `src/features/scene3d/SceneCanvas.tsx`
- `public/models/cat-wall/*.glb`

完成内容：

- 增加内置资产 registry，当前内置模型位于 `public/models/cat-wall/`。
- catalog 的 `assetKey` 会优先解析到内置 GLB。
- `assetUrl` 只接受 `/...`、`http://...`、`https://...` 开头的 `.glb` / `.gltf` URL。
- GLB 加载失败时回退到 box 占位，避免整个场景白屏。
- 选中真实模型时用透明 selection bounds 显示 catalog/实例尺寸。
- `buildOriginalAssetTransform(center)` 只根据模型 bounding box 中心做 offset，`scale` 固定为 `{ x: 1, y: 1, z: 1 }`，不再拉伸模型。

当前内置资产举例：

- `wall-two-step-ladder`
- `wall-three-step-platform-left`
- `wall-three-step-platform-right`
- `wall-cat-house-left`
- `wall-cat-house-right`
- `wall-soft-ladder`

接手注意：

- `defaultSize` / `size` 仍用于放置、边界和选择框。
- GLB 的真实视觉尺寸不会被强行拉到 `defaultSize`。
- 如果未来要让 catalog 尺寸与模型尺寸完全一致，应在资产制作或 registry size 数据上校准，而不是运行时拉伸模型。

### 7. 本地项目持久化、导入导出与路由

相关提交：`eb5f7f3 feat: persist projects and refine editor shell`

关键文件：

- `src/app/App.tsx`
- `src/editor/EditorPage.tsx`
- `src/editor/editorStore.ts`
- `src/features/upload/ImageUploadButton.tsx`
- `src/persistence/serializers.ts`
- `src/persistence/projectApi.ts`
- `src/persistence/indexedDb.ts`
- `src/persistence/serializers.test.ts`

完成内容：

- `App.tsx` 接入 `react-router-dom`，使用 `BrowserRouter`、`Routes`、`Route`、`Navigate`。
- 项目 JSON 改为带版本 envelope：

```json
{
  "schema": "cat-wall-project",
  "version": 1,
  "project": {}
}
```

- `deserializeProject()` 兼容旧的裸 project JSON。
- `normalizeProject()` 为旧项目补齐：
  - `id`
  - `name`
  - `sourceImage`
  - `corners`
  - `ruler`
  - `perspectiveGuides`
  - `perspectiveCalibration`
  - `sceneCamera`
  - `polygons`
  - `planes`
  - `components`
  - `settings`
- 旧组件会补齐：
  - `kind`
  - `name`
  - `scale`
  - `params`
- localStorage 保存 project JSON。
- IndexedDB 保存 source image blob。
- 上传图片时同时保存到项目专属 key 和 legacy key。
- `loadLatestProject()` 恢复最近项目，并把 IndexedDB 里的 image blob 转为 object URL，回填 `sourceImage.url` 和 plane texture URL。
- 编辑器入口增加项目 JSON 导入/导出按钮。
- store 增加 `loadProject(project)`，加载后按项目内容恢复 mode。

当前限制：

- JSON 导出不包含图片二进制，只包含项目元数据。
- 导入项目后，图片只能在本机存在匹配 blob 或 legacy blob 时自动恢复。
- 目前仍是浏览器本地草稿，不是后端同步。

### 8. 三墙方向、默认墙体对齐、墙体联动和墙表面锚定

相关提交：

- `eb5f7f3 feat: persist projects and refine editor shell`
- `9194eb6 fix: keep wall layouts and bound components aligned`
- `8b19242 fix: anchor wall components on wall surface`

关键文件：

- `src/domain/geometry/buildPlanes.ts`
- `src/domain/geometry/buildPlanes.test.ts`
- `src/domain/geometry/wallTemplates.ts`
- `src/domain/geometry/wallTemplates.test.ts`
- `src/domain/scene/componentPlacement.ts`
- `src/editor/editorStore.ts`
- `src/features/scene3d/SceneCanvas.tsx`

完成内容：

- 三墙布局右墙旋转修正为 `-Math.PI / 2`。
- 墙体视觉厚度为 0.1m，`PlaneMesh` 中 wall depth 使用 `0.1`，floor depth 使用 `0.08`。
- `buildPlanes.ts` 和 `wallTemplates.ts` 中引入 `WALL_THICKNESS = 0.1`，默认夹角墙中心按半厚度偏移，避免默认墙体相互交叉。
- `updatePlaneTransform()` 移动/旋转 plane 时，会对绑定组件调用 `transformBoundComponentWithPlane()`。
- undo/redo 处理 plane transform 时，也会带动绑定组件同步变化。
- `loadProject()` 会调用 `normalizeBoundComponentAttachments()`，把旧草稿里已经偏离目标 plane 的绑定组件重新投影回目标 surface。
- `componentPlacement.ts` 引入 `WALL_SURFACE_LOCAL_Z = 0.05`，墙面 anchor 统一归一到可见墙体表面。

非常重要的不变量：

- 当前 wall mesh 是有厚度的 box，不是无厚度平面。
- 可见的室内朝向墙面表面位于 plane-local `z = +0.05`。
- 墙面组件的本地 `-Z` 面贴住该 surface。
- 墙面组件中心 = `anchor + normal * size.z / 2`。
- 如果后续修改 wall 厚度，必须同步修改或集中管理 `WALL_THICKNESS` 和 `WALL_SURFACE_LOCAL_Z`。

## 本轮新增设计：3D 距离测量

目标是在 3D 场景中直接显示可读的实体测量线和文字，覆盖三类距离：

1. 组件到组件：同一绑定 plane 内，按组件在 plane surface 上的 2D 占位矩形计算最近净距；重叠时距离为 `0`。
2. 组件到墙边/plane 边：按组件占位矩形到目标 plane 四条边的剩余距离计算；wall 使用 local X/Y，floor 使用 local X/Y 作为平面 footprint。
3. 组件到地面：按组件底部到 floor 顶面或 `y = 0` 的竖向净距计算；wall 组件优先使用其贴附墙面的底边点，free 组件用自身包围盒底部估算。

设计约束：

- 测量使用 catalog/实例中的 `size` 作为稳定占位尺寸，不依赖异步 GLB 真实 bounding box，保持与放置、边界 clamp 和选择框一致。
- 测量计算放在纯 domain 模块中，R3F 层只负责把结果渲染成实体线和文本，避免把几何语义散落在 React 组件里。
- 先做聚焦式显示：选中组件时显示该组件到同 plane 其他组件、四条 plane 边和地面的测量；未选中组件时只显示每个 plane 内最近的一组组件间距，避免线条过密。
- 测量线应在 plane surface 法线方向轻微外推，避免与墙面/地面 z-fighting；文字用 billboard 面向相机。
- 单位按场景米制计算，小于 `1m` 显示为 `cm`，大于等于 `1m` 显示为 `m`。

拆解计划：

1. 几何基础：
   - 新增共享常量 `src/domain/geometry/planeGeometryConstants.ts`，集中 `WALL_THICKNESS`、`FLOOR_THICKNESS`、`WALL_SURFACE_LOCAL_Z`。
   - 抽出 plane 坐标换算工具 `src/domain/scene/planeMath.ts`，供放置约束和测量模块共用。
2. 测量计算：
   - 新增 `src/domain/scene/distanceMeasurements.ts`，输出 `DistanceMeasurement[]`。
   - 覆盖同 plane 组件最近净距、组件到四边、组件到底面的纯函数测试。
3. 3D 渲染：
   - 在 `SceneCanvas.tsx` 中按当前 `selectedId` 构建测量结果。
   - 使用 Drei `Line` 渲染实体线，`Billboard + Text` 渲染标签。
4. UI 与持久化：
   - 在 `Project.settings` 中新增 `showMeasurements`，旧项目默认开启。
   - 在紧凑 3D 工具栏增加测量开关，支持项目 JSON 持久化。
5. 验证：
   - 跑 `npm run test` 验证 domain 计算。
   - 跑 `npm run build` 验证 R3F/Drei 类型和生产构建。

本轮实施状态（2026-07-05）：

- 已完成共享几何常量：`WALL_THICKNESS`、`FLOOR_THICKNESS`、`WALL_SURFACE_LOCAL_Z` 统一到 `src/domain/geometry/planeGeometryConstants.ts`。
- 已完成 plane 数学工具抽取：`src/domain/scene/planeMath.ts`，`componentPlacement.ts` 和测量模块共用同一套 world/local 换算。
- 已完成测量计算模块：`src/domain/scene/distanceMeasurements.ts`，支持选中组件的组件间距、四边距离、离地距离；未选中组件时显示每个 plane 内最近组件间距。
- 已完成 3D 渲染接入：`SceneCanvas.tsx` 使用 Drei `Line` 渲染实体线，`Billboard + Text` 渲染面向相机的距离文字。
- 已完成测量开关：`Project.settings.showMeasurements` 旧项目默认开启，紧凑 3D 工具栏提供开关并随 JSON 持久化。

## 当前测试与验证

自动化测试文件：

- `src/domain/geometry/buildPolygons.test.ts`
- `src/domain/geometry/buildPlanes.test.ts`
- `src/domain/geometry/wallTemplates.test.ts`
- `src/domain/scene/componentAssets.test.ts`
- `src/domain/scene/componentCatalog.test.ts`
- `src/domain/scene/distanceMeasurements.test.ts`
- `src/domain/scene/componentPlacement.test.ts`
- `src/editor/editorStore.test.ts`
- `src/features/scene3d/componentTransformPreview.test.ts`
- `src/persistence/serializers.test.ts`

最近验证记录：

- `npm run test` 已通过，覆盖 10 个测试文件、62 个测试。
- `npm run build` 已通过。
- 构建时仍有 Vite chunk size warning，这是已知问题，不影响当前运行。
- 浏览器冒烟验证过 `http://127.0.0.1:5174/`：
  - 桌面视口 1280x720：单面墙模板生成后 3D 场景非空，测距开关显示并默认开启。
  - 移动视口 390x844：canvas 占满视口，测距开关仍可见。
  - 测量线的几何语义由 `distanceMeasurements.test.ts` 覆盖；浏览器冒烟未额外拖放组件生成可视测量线。
- 浏览器手测过 `http://localhost:5173/`：
  - 默认夹角墙不再明显交叉。
  - 移动墙体时，墙上组件会随墙移动。
  - 放置反馈条会自动消失。
  - 墙面组件从墙中心线移到可见墙表面，不再嵌进墙体。

## 后续开发建议

### P0：集中几何常量

当前 `WALL_THICKNESS = 0.1` 出现在 `buildPlanes.ts`、`wallTemplates.ts`，`WALL_SURFACE_LOCAL_Z = 0.05` 出现在 `componentPlacement.ts`，视觉厚度出现在 `SceneCanvas.tsx` 的 `buildThickPlaneGeometry(...)` 调用里。

建议新增共享常量模块，例如：

```txt
src/domain/geometry/planeGeometryConstants.ts
```

统一导出：

- `WALL_THICKNESS`
- `FLOOR_THICKNESS`
- `WALL_SURFACE_LOCAL_Z`

这样后续改墙体厚度时不会出现“视觉厚度变了，但贴墙锚点没变”的回归。

### P0：继续打磨 Transform 交互手感

当前约束是基于 TransformControls 的提交和预览修正完成的，规则正确，但交互仍是通用 3D gizmo。

建议后续：

- wall 组件使用墙面局部 X/Y 平面拖动。    已完成
- floor 组件使用地面局部 X/Z 平面拖动。   已完成
- 隐藏或禁用会破坏接触面的轴向。          已完成
- 旋转按 wall/floor/free 分别限制合法轴。

### P1：组件碰撞和间距

当前只保证组件与目标 plane 的接触关系和边界合法，还没有同 plane 组件之间的碰撞或间距检查。

建议先做 warning 模式：

- 同一 `targetPlaneId` 内计算 2D 占位矩形。
- wall 用 plane local X/Y。
- floor 用 plane local X/Z。
- 重叠时提示，不先强阻止。

### P1：真实资产和 catalog 进一步产品化

后续可以继续做：

- 组件卡片展示真实模型缩略图。
- catalog 管理页暴露内置 `assetKey` 选择器。
- 外部 GLB URL 增加加载状态、失败原因和格式校验反馈。
- `propertySchema` 参数真正驱动模型材质、部件开关或尺寸变体。

### P1：项目导入导出补图片

当前 JSON 不包含图片 blob。后续如果要让项目文件跨机器可恢复，需要扩展导出格式：

- 方案 A：导出 zip，包含 `project.json` 和图片。
- 方案 B：图片上传到后端对象存储，JSON 保存稳定 URL。
- 方案 C：小图内联 base64，不建议用于大图。

### P2：后端与正式项目管理

等前端空间语义稳定后再接后端，避免过早固化仍在变化的数据结构。

建议后端范围：

- 项目 CRUD。
- 图片上传和对象存储。
- 组件库同步。
- 导出任务。
- 用户/多项目管理。

### P2：性能和代码分割

当前 Vite 构建存在 chunk size warning。主要来源是 Three/R3F/GLTF 相关依赖。

可选优化：

- 路由级 code splitting。
- `EditorPage` 与 `ComponentsManagerPage` 分块。
- Three scene 延迟加载。
- 资产预加载策略优化。

## 接手排查清单

如果后续再出现贴墙、穿墙、跨墙朝向问题，优先检查：

1. `SceneCanvas.tsx` 中 wall mesh 厚度是否仍为 `0.1`。
2. `componentPlacement.ts` 中 `WALL_SURFACE_LOCAL_Z` 是否仍等于 wall 厚度的一半。
3. `planeSurfaceNormal(plane)` 是否仍以 plane local `+Z` 为室内法线。
4. `transformBoundComponentWithPlane()` 是否保留旧 plane 上的 local anchor，再投到新 plane。
5. `constrainComponentTransform()` 的 wall 分支是否仍在每次移动时检查所有 wall plane。
6. `componentTransformPreview.ts` 是否仍在预览阶段把 constrained transform 写回 object。
7. `editorStore.loadProject()` 是否仍调用 `normalizeBoundComponentAttachments()` 修复旧草稿。

如果后续再出现导入/刷新后项目丢数据，优先检查：

1. `serializers.ts` 的 `PROJECT_SCHEMA_VERSION` 和 `normalizeProject()`。
2. `projectApi.ts` 中最新项目 id key：`cat-wall-project:latest-id`。
3. `indexedDb.ts` 的 `sourceImageBlobKey(projectId)`。
4. 上传时是否同时保存项目专属 blob key。
5. 导入 JSON 后是否调用 `updateProject(nextProject)` 再 `loadProjectIntoStore(...)`。

## 文件索引

| 文件 | 当前作用 |
| --- | --- |
| `src/editor/EditorPage.tsx` | 编辑器入口、drop 事件、项目导入导出、反馈条 |
| `src/editor/editorStore.ts` | 主状态、历史记录、组件创建、Transform 写回、项目加载 |
| `src/features/scene3d/SceneCanvas.tsx` | R3F 场景、plane raycast、GLB 渲染、TransformControls |
| `src/features/scene3d/componentTransformPreview.ts` | TransformControls 拖动预览约束 |
| `src/domain/scene/componentPlacement.ts` | 放置、边界、贴墙/落地、跨墙重绑定核心逻辑 |
| `src/domain/scene/componentAssets.ts` | GLB registry、外部 URL 校验、模型居中不缩放 |
| `src/domain/scene/componentCatalog.ts` | 组件 catalog、默认尺寸、默认资产 key、catalog 持久化 |
| `src/domain/geometry/buildPlanes.ts` | 根据标注 polygon 生成 plane，包含三墙布局 |
| `src/domain/geometry/wallTemplates.ts` | 默认单墙/双墙/三墙模板 |
| `src/persistence/serializers.ts` | 项目 JSON 版本 envelope 与旧数据归一化 |
| `src/persistence/projectApi.ts` | localStorage 项目读写和图片 blob 恢复 |
| `src/persistence/indexedDb.ts` | 图片 blob 本地存储 key |
| `src/features/properties/PropertyPanel.tsx` | 右侧属性面板，包含绑定对象/放置模式展示 |
| `src/styles.css` | 编辑器、反馈条、项目文件工具栏等样式 |

## 最后状态

截至 `8b19242`，计划中的 7、8 步已经完成，并且补上了用户后续反馈的三类关键问题：

1. 默认墙体交叉。
2. 移动墙体时组件不跟随。
3. 组件跟随墙体后嵌入墙体。

下一轮最建议先做“集中几何常量 + Transform 交互手感”，再进入碰撞、图片导出和后端项目管理。

## 2026-07-06 新增设计：墙面/地面禁止摆放区域

目标：允许用户在 wall / floor plane 上绘制不可摆放区域，并在 3D 场景中持续可见、可选中、可编辑。组件拖入或移动提交时，如果绑定面的 2D footprint 与禁止区域相交，应拒绝本次摆放或移动。

数据模型：
- 在 `Project` 上新增 `forbiddenZones: ForbiddenZone[]`。
- `ForbiddenZone` 绑定到一个 `planeId`，坐标统一保存为该 plane 的 local X/Y。
- 形状保留两类：`polygon` 与 `ellipse`。矩形工具生成 4 点 polygon，后续可通过加锚点变成任意多边形；椭圆工具生成 ellipse，保存 `center / radiusX / radiusY`。
- 旧项目反序列化时 `forbiddenZones` 默认为空数组。

交互设计：
- 紧凑 3D 工具栏新增两个区域绘制模式：矩形禁止区、椭圆禁止区。
- 紧凑 3D 工具栏新增禁止区锁定按钮。默认锁定，此时禁止区只能选中查看/改属性，不能在场景中自由拖动；解锁后才允许拖动整个区域或拖动 polygon 锚点。
- 进入绘制模式后，在墙面或地面按下并拖动生成区域；松开后写入 store 并选中新区域。
- 选中区域时，3D 场景显示半透明填充、实线边框和锚点。polygon 锚点可拖动；整个区域可拖动平移。ellipse 通过中心和半径编辑。
- 右侧属性面板在选中禁止区时显示中心、尺寸、绑定面、形状信息；polygon 额外显示锚点列表，支持加锚点、删锚点和精确调整锚点坐标。
- 右上项目文件工具栏新增“清空草稿”按钮，点击后通过确认弹窗清空图片、标注、几何、组件、禁止区、历史和临时反馈，项目 id/name 保持不变。

几何与校验：
- 组件 footprint 沿用放置/测距语义：wall 用 plane local X/Y + 组件 width/height；floor 用 plane local X/Y + 组件 width/depth。
- polygon 与组件矩形相交：检查矩形角点在多边形内、多边形点在矩形内、边线相交。
- ellipse 与组件矩形相交：把矩形投影到 ellipse 的轴对齐局部空间，检查中心到矩形最近点的归一化距离。
- `addComponent()` 创建前检查禁止区域，命中则不创建并显示错误反馈。
- `updateComponentTransform()` 提交前检查禁止区域，命中则保留原位置并显示错误反馈。

开发拆解：
1. 扩展 `src/domain/scene/types.ts`、`src/persistence/serializers.ts` 和 store 初始项目，补齐旧项目默认值。
2. 新增 `src/domain/scene/forbiddenZones.ts` 与单元测试，覆盖拖拽建形、尺寸/中心计算、锚点编辑、组件 footprint 冲突判断。
3. 扩展 `editorStore.ts`：区域绘制模式、增删改区域、撤销/重做、选中删除、组件摆放/移动冲突反馈。
4. 扩展 `SceneCanvas.tsx`：plane 上拖拽绘制、区域可视化、区域/锚点拖动编辑、禁用绘制时的相机误触。
5. 扩展 `Toolbar.tsx` 和 `PropertyPanel.tsx`：绘制工具入口与右侧参数编辑。
6. 跑 `npm run test`、`npm run build`，并在 `http://localhost:5173/` 验证矩形/椭圆创建、编辑、阻止组件放入禁区。
