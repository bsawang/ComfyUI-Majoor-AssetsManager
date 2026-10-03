# AGENT-LOGGER —— majoor-assetsmanager 本地定制改动日志

> 记录对 majoor 的全部本地修复/定制。逐条追加、永不覆盖。
> 详细每条（问题/改法/验证）见 `PATCHES_LOCAL.md`（P1-P7 索引），本文件是 agent-logger 格式的事件记录。
> 深查：先看本文件，再翻 PATCHES_LOCAL.md。

## 2026-08-06：P1 stage-to-input 空 subfolder 回落 + reference-in-place
**背景**：前端拖放 asset 到画布时 `dest_subfolder` 硬编码 `""`，后端 `_safe_rel_subfolder("")` 返回 `Path(".")` → 文件被 stage 到 input 根（污染）。
**改动**：`scan_staging.py` — 空串回落默认 `mjr_staged`；input/output 内源文件原位引用（零复制）；校验放宽（仅拒绝对/穿越路径）。
**相关**：记忆 `majoor-stage-to-input-root`。

## 2026-08-（环境部署）：P2 log emoji → ASCII（GBK 兼容）
**背景**：emoji 日志在 zh-CN Windows GBK 控制台触发 `UnicodeEncodeError`。
**改动**：`log.py` — EMOJI_MAP 改 ASCII 标签（DEBUG→DBG 等）。
**相关**：GBK 日志坑。

## 2026-08-11：P3 前端拖放子图节点：resolve 内部真实 widget 双写
**背景**：ComfyUI 前端 1.48.7 子图 widget 改 store 投影，majoor 拖放写投影不刷新内部 LoadImage/视频节点 UI → 子图拖放失效。
**改动**：`ui/features/dnd/DragDrop.ts` + `canvasLoaderNode.ts` — 新增 `resolveSubgraphInnerWidget` 反查内部真实 widget，Drop 双写（投影 + 内部）。
**验证**：4 新 vitest + 22 dnd 测试过，vite build 成功（已重建 dist）。

## 2026-08-11：P4 PrimeVue 5 license 校验 stub
**背景**：PrimeVue 5.0.0 license 校验无 key → console 警告 + 右下角红条（只用社区组件，纯噪音）。
**改动**：`vite.config.mjs` + `ui/vendor/licenseManagerStub.mjs` — alias 把 `@primeui/license-manager` 路由到 stub，`verifyLicense` 恒 valid。
**注意**：未来用 PrimeVue Pro 需移除 stub。

## 2026-08-11：P5 SigLIP 向量模型同步加载阻塞事件循环
**背景**：图片产出 → embedding → `_ensure_siglip_components` 在事件循环里同步 `AutoModel.from_pretrained` → 阻塞整个 asyncio → ComfyUI HTTP 卡死（任务完成后无响应）。
**改动**：`vector_service.py` — `_load_siglip_components` 包进 `asyncio.to_thread`。
**验证**：23 向量服务测试过。**需重启 ComfyUI 生效。**
**相关**：记忆 `majoor-http-hang-execution-grouping`。

## 2026-08-12：P6 `_lookup_filepaths` SQL 缺 f 前缀 → unrecognized token `{`
**背景**：`searcher.py` `_lookup_filepaths` SQL 普通字符串含 `{_normalized_tags_json_select('a')}` 未展开 → SQLite `unrecognized token: "{"`。列表浏览按 filepath 查 DB 富字段时触发。
**改动**：`searcher.py` — SQL 加 `f` 前缀展开 JSON 标签子查询；`{IN_CLAUSE}` → `{{IN_CLAUSE}}` 转义留给 `build_in_query` split。
**验证**：searcher 测试 27 过。**需重启 ComfyUI 生效。**
**排查过程**：给 `sqlite_execution.py` OperationalError 加 query 日志才看到完整 SQL（诊断用，**2026-08-13 已回滚**）。

## 2026-08-12：P7 产出后自动索引诊断日志（已定位）
**背景**：黄点排查——自动索引实际一直正常（`ingestion done: indexed=4 added=4`），黄点根因是 SigLIP 模型下载失败（网络超时）→ `vector.degraded=true`。
**改动**：`runtime_activity.py` — 加 ingestion 日志（诊断，可移除）。
**解决**：不用语义搜索 → 设 `MAJOOR_ENABLE_VECTOR_SEARCH=0` 重启，黄点消失（`_vector_runtime_diagnostics` 不受开关控制，必须重启清 `_last_error`）。

## 2026-08-14：P7 诊断日志回滚（ingestion 日志移除）
**背景**：P7（`runtime_activity.py` 的 post-execution ingestion 日志）已完成定位使命，majoor 运行正常。
**改动**：回滚 `runtime_activity.py`——移除 `get_logger` import 和 scheduled/done/failed 日志，还原为裸调用 `ingest_prompt_outputs_from_services`。行为无变化（纯日志增删）。
**说明**：黄点根因已定（SigLIP 下载失败 → `vector.degraded`），解决是 `MAJOOR_ENABLE_VECTOR_SEARCH=0` 重启，不再需要诊断日志。
