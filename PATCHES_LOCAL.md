# 本地 Patch 记录（不进上游）

> 本机 fork（`bsawang/ComfyUI-Majoor-AssetsManager`）的本地改动清单。
> 这些改动不打算合入上游（或等待上游修复后移除），记录用于追踪「本地与上游的差异」。
> 每次新增/移除 patch 在此登记，便于升级/合并上游时对照。
> 关联：comfyui-study 笔记（`e:\work\ai\comfyui-study\notes\` 下 12/22/27 troubleshoot 系列）。

---

## P1. stage-to-input 空 subfolder 回落 + reference-in-place

- **文件**：`mjr_am_backend/routes/handlers/scan_staging.py`
- **日期**：2026-08-06
- **状态**：本地生效
- **问题**：前端拖放 asset 到画布时 `dest_subfolder` 硬编码 `""`，后端 `_safe_rel_subfolder("")` 返回 `Path(".")` → 文件被 stage 到 `input\` 根目录（污染 input 根）。
- **改法**：
  1. `_safe_rel_subfolder("")` 改返回 `None` → 空串回落默认 `mjr_staged` 子目录
  2. 新增 reference-in-place 分支：源文件在 input/output 根内时直接返回原路径，零复制（input 返回 `子文件夹/名`，output 返回 `子文件夹/名 [output]`）
  3. `dest_subfolder` 校验放宽：显式空串 = 未指定（不再报 Invalid），仅拒绝绝对/穿越路径
- **验证**：mock 端到端调 handler，input/output 源均返回原位引用、不新建文件
- **关联**：项目记忆 `majoor-stage-to-input-root`、comfyui-study notes（未单列，见记忆）

## P2. log emoji → ASCII（zh-CN Windows GBK 兼容）

- **文件**：`mjr_am_shared/log.py`
- **日期**：2026-08-（随环境）
- **状态**：本地生效
- **问题**：emoji 日志在 zh-CN Windows（GBK 控制台）触发 `UnicodeEncodeError`，日志写文件报错。
- **改法**：`EMOJI_MAP` 的 emoji 替换为 ASCII 标签（DEBUG→DBG、INFO→INF、WARNING→WRN…）。
- **验证**：日志正常输出，无 GBK 编码错误。

## P3. 前端拖放到子图节点：resolve 内部真实 widget 双写

- **文件**：`ui/features/dnd/DragDrop.ts`、`ui/features/dnd/canvasLoaderNode.ts`、`ui/tests/subgraph_widget_resolve.vitest.ts`
- **日期**：2026-08-11
- **状态**：本地生效（已重建 dist）
- **问题**：ComfyUI 前端升级到 1.48.7 后，子图节点 widget 改为 **store 投影**（widgetValueStore）。majoor 拖放写投影 widget 只更新 store（执行层读 store 所以结果正确），但内部 LoadImage/视频节点 UI 和预览不刷新 → 拖放到子图失效。
- **改法**：新增 `resolveSubgraphInnerWidget`，从投影 widget 反查 `input._subgraphSlot` → 内部 link → 真实 LoadImage widget；Drop 写值时双写（先投影 store、再内部 widget）。
- **验证**：新增 4 vitest + 现有 22 dnd 测试全过；`vite build` 成功。
- **关联**：comfyui-study 本轮会话（子图拖放修复）

## P4. PrimeVue 5 license 校验 stub（去警告+banner）

- **文件**：`vite.config.mjs`、`ui/vendor/licenseManagerStub.mjs`
- **日期**：2026-08-11
- **状态**：本地生效（已重建 dist）
- **问题**：PrimeVue 5.0.0 在 `app.use(PrimeVue)` 时做 license 校验，无 key → console 警告 + 右下角 "Invalid PrimeUI License" 红条。majoor 只用社区组件，纯噪音。
- **改法**：vite alias 把 `@primeui/license-manager` 路由到 stub，`verifyLicense` 恒返回 `valid:true` → 警告和 banner 被短路。
- **验证**：构建产物 `mjr-primevue` chunk 中 verify 分支短路（`e.valid || (warn, banner)` 不触发）；全 vitest 通过。
- **注意**：若未来用 PrimeVue Pro 组件，需移除 stub 并填真实 license。

## P5. SigLIP 向量模型同步加载阻塞事件循环

- **文件**：`mjr_am_backend/features/index/vector_service.py`
- **日期**：2026-08-11
- **状态**：本地生效（需重启 ComfyUI）
- **问题**：图片产出 → `ingest_prompt_outputs` → 图片 embedding → `_ensure_siglip_components` 在 asyncio 事件循环里**同步**调用 `_load_siglip_components`（`AutoModel.from_pretrained` + `AutoProcessor.from_pretrained` + 模型搬 GPU）→ 下载/加载权重阻塞整个事件循环 → ComfyUI 所有 HTTP 无响应（任务完成后卡死，CPU≈0 等 I/O）。
- **改法**：把 `_load_siglip_components` 包进 `asyncio.to_thread`（与已有的 `_ensure_model` 处理一致），模型加载移到线程池。
- **验证**：23 个向量服务测试通过；`asyncio` 已 import。
- **关联**：comfyui-study `notes/27-troubleshoot-majoor-siglip-hang.md`（待建）

## P6. `_lookup_filepaths` SQL 缺 f 前缀 → unrecognized token `{`

- **文件**：`mjr_am_backend/features/index/searcher.py`
- **日期**：2026-08-12
- **状态**：本地生效（需重启 ComfyUI）
- **问题**：`_lookup_filepaths`（searcher.py ~2049）的 SQL 用**普通字符串**（`"""..."""` 无 `f` 前缀），但内含 `{_normalized_tags_json_select('a')}` ——本应被 f-string 展开成 tags 子查询片段，因缺 `f` 前缀**原样残留** → SQLite 解析到裸 `{` → `Operational error: unrecognized token: "{"`。报错场景：文件系统列表/input 浏览按 filepath 查 DB 富字段时触发。
- **改法**：
  1. SQL 加 `f` 前缀，展开 `_normalized_tags_json_select('a')`
  2. `{IN_CLAUSE}` → `{{IN_CLAUSE}}`（f-string 双花括号转义，展开后还原为 `{IN_CLAUSE}` 供 `build_in_query` split）
- **验证**：模拟端到端展开无裸花括号 + tags 子查询 + IN 占位全对；searcher 测试 27 通过。
- **排查过程**：给 `sqlite_execution.py` OperationalError 加了 query 日志才看到完整 SQL（诊断用，保留）。

## P7. 产出后自动索引诊断日志（已定位，可移除）

- **文件**：`mjr_am_backend/runtime_activity.py`
- **日期**：2026-08-12
- **状态**：已定位问题，诊断日志保留可移除
- **结论**：自动索引**一直正常工作**（`post-execution ingestion done: indexed=4 added=4`）。产出 → `on_prompt_end`（execution.py:843）→ `schedule_post_execution_ingestion` 链路完整。
- **黄点根因**（与 P5/P6 无关）：**向量服务 SigLIP 模型下载失败 → `vector.degraded=true` → 前端 healthTone=warning → 黄点**。`from_pretrained("google/siglip-so400m-patch14-384")` 网络超时（WinError 10060），模型没加载，`_last_error` 被记录。
- **解决**：不用语义搜索 → 设用户环境变量 `MAJOOR_ENABLE_VECTOR_SEARCH=0`，重启后 `_ensure_vector_services_async` 因 disabled 不初始化，health `vector.enabled=false, degraded=false`，黄点消失。
- **注意**：`_vector_runtime_diagnostics`（health.py:429）只要 vector_service 实例存在就返回其 degraded 状态，不受开关控制 → 关掉必须**重启**才能清除 `_last_error`。

---

## 维护说明

- 升级上游（`git pull upstream master`）时，用 `git diff` 逐条核对以上 P1-P5 是否被上游吸收，被吸收的标记「已上游」并移除。
- 所有改动均以 `git status` 工作区状态为准，本文件只是**人读的索引**，不进 git（或单独提交）。
