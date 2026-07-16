# AI CAD Agent 设计决策记录（2026-07-11）

> 状态：APPROVED（2026-07-11）

## 结论

已确认采用“受约束几何 IR + Agent Planner，产品族模板兜底”的路线。完整设计见：

`docs/ai-cad-agent-pipeline-design-2026-07-11.md`

## 已确认前提

- 当前主要使用者只有项目负责人本人，首版是公司内部生产工具。
- 当前手工使用 Blender，一个典型组件约 10 分钟，待建约 30 个；组件库会持续扩大。
- 后续计划开放给用户，让用户上传网上看中的商品图生成 Web 3D 展示模型。
- 首版输入是单张斜视角、带尺寸标注的商品图。
- 用户在流水线每一步参与校准，并人工标注施工孔位。
- 支持板件/跳台、梯子、盒体猫屋、圆柱抓柱、软体织物和规则圆形曲面；不支持不规则自由曲面。
- 整体尺寸、板件尺寸、孔径和孔位是硬约束。
- 隐藏结构只需比例合理，未标注板厚允许用合适默认值。
- 产物只用于 Web 3D 展示，不承担制造级 CAD 责任。
- 云端模型 API 可用。

## 关键架构决策

- Vision 输出观察 JSON，不能直接成为产品事实。
- 用户确认后形成 `ComponentSpec`。
- Planner 只输出符合 Schema 的 `ModelingPlan`。
- `bpy` 由确定性编译器生成，不执行 LLM 自由编写的 Python。
- 孔是一级语义对象，不能只保存为匿名 Boolean。
- Blender 在隔离 Worker 中异步执行，Web 端负责校准、审批和预览。
- 内部版本必须安装本地 Worker，Blender 计算使用本机资源，云端首期不部署 Blender Worker。
- 本地 Worker 使用签名 Windows 安装包，内含固定 Blender Portable、受信任编译器、Schema 和校验工具。
- Worker 主动通过 CAD API 配对、拉取签名任务和上传产物；浏览器不直接启动 EXE，也不依赖访问本机端口。
- 执行协议保留 `local-device | cloud-worker` 抽象，未来可扩展为“本地优先、云端付费/限额兜底”。
- GLB 是主发布格式，Blend、脚本、Spec、Plan 和 QA 报告用于留档。
- 生成成功与 Catalog 发布分离，发布必须通过自动 QA 和人工批准。

## 下一步

先执行设计文档中的 Phase 0：建立 12 个黄金样本、锁定 Blender 版本和资产规范，并完成本地 Worker 安装包/设备配对技术 Spike，用手写 `ModelingPlan` 跑通 Web 创建设备任务 -> 本地认领 -> Blender -> 上传 GLB -> 当前 Web 编辑器的确定性闭环。
