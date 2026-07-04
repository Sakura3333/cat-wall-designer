# 在线猫墙编辑器交接文档

> 2026-07-01 更新：本文保留早期“四点角点生成墙面”的交接记录，部分描述已经过期。当前版本已经改为“透视标线 + 模板 + 3D 变换编辑”工作流。新的编辑器交接入口请优先阅读 `docs/cat-wall-editor-handoff-2026-07-01.md`；当前实现摘要也已追加到 `docs/cat-wall-editor-dev-spec.md` 的第 14 节。
>
> 2026-07-04 更新：组件系统已经新增 `/components_manager` 管理页、独立组件 catalog、三大放置规则和组件属性字段。组件与场景互动的详细开发交接请阅读 `docs/cat-wall-component-system-handoff-2026-07-04.md`。

本文档记录当前版本已经实现的内容，以及每个代码文件承担的职责。项目是一个 Vite + React + TypeScript 的前端原型，目标是把室内图片中的墙面区域手动标点后生成 3D plane，并支持贴图映射、暖色墙皮材质、地面开关和猫墙组件占位。

## 当前状态

- 已实现上传图片、替换图片、删除图片。
- 已实现图片标注：角点、角点删除、四点一组生成墙面四边形。
- 已实现标尺工具：两端点不参与墙面计算，可输入真实长度，墙面虚线边显示厘米长度。
- 已实现 3D plane 生成：按标记区域生成 UV，只把角点区域贴到对应 plane 上。
- 已实现贴图开关：关闭时显示暖色卡通墙皮材质。
- 已实现撤销 / 重做，包含从 3D 生成结果撤销回 2D 标注界面的场景。
- 已实现组件面板的拖拽占位，拖入后在 3D 场景里生成简化盒体组件。

## 运行方式

```bash
npm install
npm run dev -- --port 5173
npm run build
```

开发时通常访问：

```txt
http://127.0.0.1:5173/
```

## 核心数据流

```txt
上传图片
  -> editorStore.setSourceImage()
  -> AnnotationLayer 在图片真实显示区域内记录 image-space 角点
  -> buildPolygons() 按 4 个墙面角点一组生成 polygon 和 UV
  -> buildPlanes() 按 polygon 左右顺序生成 wall plane / floor plane
  -> SceneCanvas 用 Three.js geometry + UV 渲染 3D 场景
  -> PropertyPanel 调整尺寸、贴图映射、地面开关
```

坐标约定：

- 标注点保存在原图坐标系，也就是 image-space。
- 页面点击位置先通过 `viewportToImagePoint()` 转成原图坐标。
- 渲染标点时再通过 `imageToViewportPoint()` 转回当前图片显示区域坐标。
- 3D 贴图 UV 由原图坐标归一化得出，因此 plane 贴的是被标出的墙面区域，不是整张图片。

## 逐文件说明

### 工程入口与配置

| 文件 | 作用 |
| --- | --- |
| `package.json` | 定义项目名、脚本和依赖。核心依赖包括 React、Zustand、Three.js、React Three Fiber、dnd-kit 和 lucide-react。 |
| `index.html` | Vite HTML 入口，承载 React 根节点。 |
| `vite.config.ts` | Vite 配置文件，接入 React 插件。 |
| `tsconfig.json` | TypeScript 项目引用入口。 |
| `tsconfig.app.json` | 前端应用 TypeScript 编译配置。 |
| `tsconfig.node.json` | Node/Vite 配置文件的 TypeScript 编译配置。 |

### `src/main.tsx`

React 应用入口。它把 `App` 渲染到 `#root`，并引入全局样式 `src/styles.css`。当前包在 `React.StrictMode` 里运行，所以副作用、hook 顺序和重复渲染问题会更容易暴露。

### `src/app/App.tsx`

应用壳层入口。当前没有复杂路由逻辑，直接渲染 `EditorPage`。

### `src/app/routes.tsx`

预留的路由配置。当前只有 `/` 指向 `EditorPage`，实际入口暂时没有接入路由库。

### `src/editor/EditorPage.tsx`

主页面和工作区布局文件。这里组合了顶部标题、中央预览区、上传/替换/删除/生成模型工具栏、标注层、3D 场景、左侧工具栏、右侧属性面板和底部组件面板。

关键逻辑：

- 没有图片时，在预览区中央显示上传按钮。
- 有图片时，顶部显示“替换图片”和“删除图片”。
- 当墙面角点数量大于 0 且是 4 的整数倍时，显示“生成模型”按钮。
- 没有生成 plane 时显示 `AnnotationLayer`，生成 plane 后切换为 `SceneCanvas`。
- 预览区注册 dnd-kit droppable，组件从底部面板拖入后调用 `addComponent()`。

### `src/editor/editorStore.ts`

全局编辑器状态中心，使用 Zustand 实现。大部分业务行为都集中在这里。

主要状态：

- `project`：当前草稿，包含图片、角点、标尺、polygon、plane、组件和设置。
- `mode`：编辑模式，如空状态、标点、标尺、编辑 plane。
- `selectedId`：当前选中的 plane。
- `history` / `future`：撤销和重做栈。
- `geometryErrors`：几何生成错误。

主要动作：

- `setSourceImage()`：设置上传图片，并清空旧角点、标尺、polygon、plane、组件和历史。
- `clearSourceImage()`：清空当前图片和相关草稿。
- `addCorner()` / `deleteCorner()` / `moveCorner()`：添加、删除、移动墙面角点。
- `createRuler()` / `addRulerPoint()` / `moveRulerPoint()` / `updateRulerLength()`：创建和编辑标尺。
- `buildGeometry()`：调用 `buildPolygons()` 和 `buildPlanes()` 生成模型，并把生成前后的快照写入历史。
- `undo()` / `redo()`：通过 `applyHistoryEntry()` 回放或反向回放历史。
- `toggleFloor()`：切换地面 plane，并重新生成 plane 列表。
- `updatePlaneSize()`：调整 plane 长宽。
- `updatePlaneTextureMapping()`：切换指定 plane 使用图片贴图或暖色墙皮。
- `addComponent()`：添加一个简化 3D 组件占位。

维护注意：

- `build-geometry` 是一条历史记录，撤销时只恢复 polygon、plane、mode、selectedId、geometryErrors，不清空角点。这是修复“从 3D 撤销回 2D 后标点消失”的关键。
- 改角点后会清空 polygon 和 plane，让后续生成重新基于最新标点计算。

### `src/editor/historyStore.ts`

历史状态的轻量类型和空值定义。当前主逻辑已经内聚在 `editorStore.ts`，这个文件是后续拆分 history 模块的脚手架。

### `src/domain/scene/types.ts`

领域类型定义。这里定义了 2D/3D 坐标、图片、角点、标尺、polygon、plane、组件、项目状态、编辑模式和历史记录。

重点类型：

- `CornerPoint`：墙面标点，包含 `kind`。
- `RulerSpec`：标尺两端点和真实长度，单位厘米。
- `PolygonSpec`：四边形区域，包含点 id、面积、中心点和 UV。
- `PlaneSpec`：3D plane，包含尺寸、贴图开关、位置和旋转。
- `HistoryEntry`：撤销/重做支持的操作集合。

### `src/domain/scene/selection.ts`

选中 plane 的辅助函数。`getSelectedPlane()` 会优先返回 `selectedId` 对应的 plane；没有选中项时返回第一个墙面 plane，保证属性面板有默认目标。

### `src/domain/geometry/coordinate.ts`

图片显示坐标和原图坐标的转换工具。

- `viewportToImagePoint()`：把鼠标点击位置转成原图坐标。
- `imageToViewportPoint()`：把保存的原图坐标转成当前显示区域坐标。

维护注意：

- 这里会根据 `object-fit: contain` 的规则计算图片实际渲染盒子。
- 标注层还有一个单独的 `.annotation-hitbox`，它必须和真实图片显示区域一致。否则首次点击可能会被算到 `0,0` 或边缘。

### `src/domain/geometry/validateQuad.ts`

四边形校验工具。负责判断：

- 是否正好 4 个点。
- 是否有重复点。
- 是否自交。
- 面积是否太小。
- 点顺序是否需要反转。

`polygonArea()` 用鞋带公式计算面积，`validateQuad()` 会在面积为负时返回 `reversed: true`，供后续规范点顺序。

### `src/domain/geometry/uvMapping.ts`

把四边形角点映射成 UV 坐标。当前实现是把原图坐标归一化：

- `u = x / imageWidth`
- `v = 1 - y / imageHeight`

这样 Three.js 材质会只采样标记区域对应的图片位置。

### `src/domain/geometry/buildPolygons.ts`

把墙面角点转换成 polygon。

关键逻辑：

- 只使用 `kind !== 'floor'` 的角点，标尺点不在 `corners` 里，因此不参与 polygon 计算。
- 每 4 个点为一组生成一个墙面四边形。
- 每组先通过 `validateQuad()` 校验。
- 校验通过后生成 `PolygonSpec`，包含 id、点 id、面积、中心点和 UV。
- 如果点数不足或校验失败，把中文错误放进 `errors`。

### `src/domain/geometry/buildPlanes.ts`

把 polygon 转成 3D plane。

关键逻辑：

- 先按 `polygon.center.x` 排序，使多个矩形按图片里的左右顺序生成。
- 每个墙面 plane 默认尺寸是 `3.6m x 2.4m`，如果已有同 polygon 的旧 plane，会保留旧尺寸和贴图开关。
- 3 个墙面的特殊布局：左 / 中 / 右三面墙，中间墙正对相机，两侧墙与中间墙互成直角。
- 其他数量的墙面使用横向展开布局，并加轻微旋转区分层次。
- `showFloor` 为 true 时追加地面 plane。

已知待处理：

- 最近一次用户反馈右侧墙面旋转方向不对，右侧面应该以左侧边为旋转轴向左旋转，当前代码尚未修复。相关位置在 `buildWallLayout()` 的三墙布局分支。

### `src/features/upload/ImageUploadButton.tsx`

图片上传按钮组件。它隐藏原生 file input，用按钮触发选择图片。

流程：

- 用户选择图片。
- 创建 `URL.createObjectURL(file)` 作为本地预览地址。
- 调用 `saveBlob('latest-source-image', file)` 写入 IndexedDB。
- 用 `Image()` 读取 naturalWidth / naturalHeight。
- 调用 `setSourceImage()` 写入 store。

当前这个组件同时用于“上传室内图”和“替换图片”，通过 `label` 和 `className` 区分表现。

### `src/features/annotation/AnnotationLayer.tsx`

2D 图片标注层。负责显示上传图片、墙面角点、删除按钮、虚线连线、厘米长度、标尺点和标尺长度输入框。

关键逻辑：

- `useLayoutEffect()` 监听标注层尺寸变化，用 ResizeObserver 更新 `layerSize`。
- `getContainedImageBox()` 计算图片在标注层中的真实显示区域。
- `imageViewport` 通过 `useMemo()` 缓存，后续用于点位渲染。
- 点击空白 hitbox 时：
  - `mode === 'marking-ruler'` 则添加标尺点。
  - 否则添加墙面角点。
- 拖动角点时调用 `moveCorner()`。
- 拖动标尺点时调用 `moveRulerPoint()`。
- 点击角点先选中，再显示“删除”按钮。
- 每组 4 个角点按 1-2-3-4-1 连线，第四个点会连回第一个点。
- 若有有效标尺，会按“线段像素长度 / 标尺像素长度 * 标尺真实厘米数”显示边长标签。

维护注意：

- 所有 hook 必须放在 `if (!project.sourceImage) return null` 之前。之前上传图片白屏就是因为早返回导致 hook 调用顺序变化。
- `.annotation-hitbox` 必须贴合图片实际显示区域，点击和渲染都基于它计算，不能直接用整个舞台区域。

### `src/features/scene3d/SceneCanvas.tsx`

3D 场景渲染。使用 React Three Fiber 的 `Canvas`、Three.js `BufferGeometry` 和 drei 的 `OrbitControls` / `Edges`。

主要内容：

- `SceneCanvas()`：读取 project、selectedId，渲染所有 plane 和组件。
- `PlaneMesh()`：按 `PlaneSpec` 创建 mesh，并处理选中态。
- `buildPlaneGeometry()`：手动创建带 UV 的 plane geometry，而不是直接使用默认 PlaneGeometry，确保四边形标记区域能映射到 plane。
- `TextureMaterial()`：加载上传图片作为贴图。
- `WarmWallMaterial()`：用 CanvasTexture 生成暖色、纸感、轻微纹理的墙皮材质。
- `ComponentMesh()`：把组件占位渲染成简化 box。

维护注意：

- `textureEnabled && textureUrl` 时使用图片贴图，否则墙面使用暖色墙皮材质。
- 当前 floor 如果有贴图也会使用图片材质；否则用单色暖色地面。
- `WarmWallMaterial()` 内部使用 `Math.random()` 生成纹理点，因为 `useMemo([])`，单个组件生命周期里纹理稳定。

### `src/features/properties/PropertyPanel.tsx`

右侧属性面板。负责选中 plane 的尺寸、贴图映射开关、地面开关和草稿统计。

功能：

- 读取 `getSelectedPlane()` 得到当前 plane。
- 墙面/地面都有长宽滑杆，单位显示为米。
- 贴图映射是 checkbox，开启显示“角点区域”，关闭显示“暖色墙皮”。
- 地面 plane 使用独立开关控制。
- 草稿状态显示角点数、四边形数和组件数。

### `src/features/component-palette/ComponentPalette.tsx`

底部组件面板。使用 dnd-kit 的 `useDraggable()` 让组件卡片可以拖到场景区域。2026-07-04 后，组件列表已经改为读取 `src/domain/scene/componentCatalog.ts`，不再在该文件内硬编码。

当前组件大类固定为：

- `wall`：墙面组件。
- `floor`：地面组件。
- `free`：自由组件。

注意：组件仍以占位 box 渲染，`assetKey` / `assetUrl` 尚未接入真实模型；drop 后仍没有使用鼠标落点做 raycast 放置。组件管理页和后续贴墙/落地互动方案见 `docs/cat-wall-component-system-handoff-2026-07-04.md`。

### `src/ui/panels/Toolbar.tsx`

左侧工具栏。

功能：

- 角点标记：切回 `marking-corners`。
- 标尺：调用 `createRuler()` 创建或进入标尺模式。
- 四边形拆分、吸附校准：目前是 UI 占位按钮。
- 撤销 / 重做：调用 store 的 `undo()` 和 `redo()`，并根据 history/future 长度禁用按钮。
- 重置视角：当前实际调用 `resetCorners()`，会清空角点和几何数据。

维护注意：

- “生成模型”不在左侧工具栏触发，而是在顶部图片工具栏触发。
- “重置视角”当前命名和实际行为不完全一致，后续可以改成真正重置相机，或把文案改成“清空标点”。

### `src/ui/controls/Legend.tsx`

页面底部图例，说明红色角点、绿色可选地面、紫色组件分类和暖色手绘卡片风格。

### `src/ui/icons/PaperPlaneMark.tsx`

纸片 plane 装饰图标组件。当前样式里仍有 `.paper-plane-mark`，但主界面没有实际使用这个组件。可以保留作为后续空状态装饰，也可以在清理时删除。

### `src/persistence/indexedDb.ts`

IndexedDB 简单封装。

- 数据库名：`cat-wall-editor`
- object store：`drafts`
- `saveBlob()`：按 key 保存 Blob。
- `loadBlob()`：按 key 读取 Blob。

当前上传图片会保存到 `latest-source-image`，但页面刷新后的恢复流程还没有完整接上。

### `src/persistence/projectApi.ts`

LocalStorage 项目 API 草稿。

- `createProject()`
- `loadProject()`
- `updateProject()`

当前 UI 主流程尚未接入这些 API，后续可用于本地项目草稿保存。

### `src/persistence/serializers.ts`

项目序列化和反序列化工具。

- `serializeProject(project)`
- `deserializeProject(value)`

当前只是 `JSON.stringify()` 和 `JSON.parse()` 的轻量封装，后续如果项目结构升级，可以在这里做版本迁移。

### `src/styles.css`

全局视觉和布局样式。整体遵守参考图的手绘卡片、暖色纸面、粗描边、圆角、轻阴影风格。

重点区域：

- 根变量：定义背景、纸张、文字、线条、红/绿/紫/暖棕等色值。
- `.page-shell` / `.editor-frame` / `.preview-stage`：页面和中央工作区骨架。
- `.center-upload-zone` / `.image-action-toolbar`：无图时居中上传，有图时顶部图片工具栏。
- `.annotation-layer` / `.annotation-hitbox` / `.corner-pin` / `.ruler-pin`：图片标注、角点和标尺表现。
- `.toolbar-panel`：左侧工具栏。
- `.property-panel`：右侧属性面板。
- `.component-panel`：底部组件面板。
- mobile media query：窄屏下工具栏、属性面板、组件面板改为文档流布局，避免遮挡标注区域。

维护注意：

- 当前 `.annotation-layer` 的 inset 专门缩小了图片标注区域，避免被左侧工具栏、右侧属性面板、底部组件面板和顶部工具栏挡住。
- 如果调整面板尺寸，需要同步检查 `.annotation-layer` 在桌面和移动端的 inset。

## 关键交互说明

### 图片工具栏

- 无图片：上传按钮在屏幕中间。
- 有图片：顶部工具栏显示替换图片、删除图片。
- 角点数量为 4 的整数倍时：显示生成模型按钮。

### 角点标注

- 点击图片实际显示区域添加角点。
- 每 4 个角点组成一个墙面矩形。
- 点击某个角点会显示删除按钮，再点击删除即可删除该角点。
- 完整四边形会闭合连线，即第 4 个点连回第 1 个点。

### 标尺和长度

- 点击左侧“标尺”工具会添加一条绿色标尺线。
- 标尺两个端点不参与四边形计算。
- 用户可以输入标尺真实长度，单位厘米。
- 墙面角点之间的虚线会显示换算后的厘米长度。

### 贴图映射

- 开启时：plane 使用上传图片中被角点标记出来的区域。
- 关闭时：墙面使用程序生成的暖色卡通墙皮材质。

### 撤销 / 重做

- 支持角点新增、删除、移动、生成模型、地面开关、plane 属性更新。
- 从 3D 界面撤销回 2D 标注界面时，角点应继续显示。

## 已知问题和后续事项

- 右侧墙面三墙布局旋转方向仍需修复：右侧 plane 应该以左侧边为轴向左旋转，避免背面朝内。
- `Toolbar` 里的“四边形拆分”和“吸附校准”目前还是占位。
- “重置视角”当前会清空角点，不是真正重置 3D 相机。
- IndexedDB 已保存图片 Blob，但刷新恢复草稿还没打通。
- LocalStorage 项目 API 和 serializers 还没接入主流程。
- 组件拖拽只是生成占位盒体，还没有贴墙定位、吸附、尺寸编辑和材质。
- 当前没有自动化测试，主要验证方式是 `npm run build` 和浏览器手测。
- `vite-dev.log` 是运行时日志产物，后续提交代码时一般不需要纳入版本管理。
- `docs/cat-wall-editor-dev-spec.md` 当前内容出现编码乱码，建议后续重新以 UTF-8 修复或重写。

## 维护注意事项

- `AnnotationLayer` 里不要在 hook 之前提前 return，否则会再次触发 React hook 顺序错误。
- 标注点必须始终保存为原图坐标，不要保存 DOM 坐标，否则窗口尺寸变化后点位会偏。
- `.annotation-hitbox` 必须等于图片 contain 后的真实显示区域，否则首次标点会落到错误位置。
- 修改角点、标尺或图片时，要确认 polygon、plane、history 的清理策略是否符合撤销预期。
- 修改 `buildPlanes()` 时，需要同时考虑 polygon 左右排序、plane 朝向、贴图正反面和三墙直角关系。
- 修改 `SceneCanvas` 的 geometry 顶点顺序时，要同步检查 UV 顺序和 Three.js 正面朝向。
