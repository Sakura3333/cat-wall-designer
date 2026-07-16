# Phase 0 编译器确认样本

这是一个合成的、尺寸已确认的双孔板件，只用于验证：

- `ComponentSpec` 和 `ModelingPlan` 校验。
- Box 原语。
- `mounting-hole` Difference Boolean。
- Blender 4.5.11 LTS 后台执行。
- GLB、Blend、缩略图和质量报告输出。

它不是太空舱商品的真实规格，也不能发布到组件 Catalog。

运行：

```powershell
npm run cad:worker:sample
```

输出目录 `.ai-cad-work/phase-zero-panel/` 已加入 `.gitignore`。
