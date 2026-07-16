# PSD3 CAD Local Worker Prototype

当前 Phase 0 Worker 是本地 CLI 技术切片，不是最终安装包或常驻服务。

## 运行

项目根目录需要存在已锁定的 Blender：

```text
blender/blender-4.5.11-windows-x64/blender-4.5.11-windows-x64/blender.exe
```

执行合成双孔板件样本：

```powershell
npm run cad:worker:sample
```

也可以显式传入文件：

```powershell
npx tsx workers/cad-worker/runLocal.ts `
  --spec fixtures/ai-cad/compiler/phase-zero-panel/component-spec.json `
  --plan fixtures/ai-cad/compiler/phase-zero-panel/modeling-plan.json `
  --out .ai-cad-work/custom-run
```

Blender 路径可通过 `--blender` 或 `BLENDER_EXECUTABLE` 覆盖。

## 当前安全边界

- Worker 先执行 JSON Schema 校验。
- 未确认的硬尺寸、施工孔和阻断假设不能进入 Blender。
- Plan 不能修改已确认的孔径、孔中心或轴向。
- Plan 只允许 v1 Schema 中的 `box` 和 `mounting-hole`。
- Blender 只运行仓库内受信任的 `compile_plan.py`，不执行 Plan 中的 Python。

## 当前产物

- `model.glb`
- `model.blend`
- `thumbnail.png`
- `quality-report.json`

下一阶段再加入设备配对、任务租约、签名下载/上传、取消、自动更新和 Windows 安装包。
