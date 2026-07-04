# 透视标线相机匹配实现说明

当前版本保留“四点一组生成墙面”的旧流程，同时新增“透视标线”流程。

## 用户流程

1. 上传室内图。
2. 在左侧工具栏选择“左向线”，标 2 条沿左侧墙/地面方向的线。
3. 选择“右向线”，标 2 条沿右侧墙/地面方向的线。
4. 可选选择“竖向线”，标墙角、门框等竖直线。少于 2 条时会默认相机保持水平。
5. 点击“生成透视模型”。

## 数据流

```txt
PerspectiveGuideLine[]
  -> buildPerspectiveRoom()
  -> 求左右消失点
  -> 估算焦距 / FOV / 相机 yaw
  -> 生成两面墙 + 可选地面
  -> SceneCanvas 使用 PerspectiveCamera 渲染
```

## 关键文件

- `src/domain/scene/types.ts`：新增 `PerspectiveGuideLine`、`PerspectiveCalibration`、`SceneCameraSpec`。
- `src/domain/geometry/perspective.ts`：透视线求消失点、估算相机、生成墙角三平面。
- `src/editor/editorStore.ts`：新增透视标线状态和生成逻辑，透视线足够时优先走新流程，不足时回退旧四点流程。
- `src/features/annotation/AnnotationLayer.tsx`：支持拖拽绘制/移动/删除透视线。
- `src/features/scene3d/SceneCanvas.tsx`：有 `sceneCamera` 时使用透视相机，否则保持旧正交预览。

## 当前限制

- 单张图无法恢复绝对尺度，当前墙高/墙宽使用默认值，仍可在属性面板调节。
- 目前生成的是墙角模型：左墙、右墙和可选地面，不会自动切出照片中任意复杂墙面轮廓。
- 未做镜头畸变校正，手机广角图需要用户用标线微调。
- 竖向线用于估算 pitch；没有竖向线时按相机水平处理。

