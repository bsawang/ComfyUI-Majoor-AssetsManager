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

## 2026-10-04：全 patch 恢复 + ComfyUI 0.37 升级兼容

### 9-23 丢失事件
上游 merge `6b3e2b36`（Merge branch 'main' of MajoorWaldi）冲掉了 P1/P2/P5/P6 工作区改动。根因：这 4 个 patch 从 8 月落地以来**从未 commit**。P3/P4 幸存（8-11 就 commit 了）但 P4 缺 vite.config.mjs 的 `resolve.alias`（stub 文件在但没 wire）。

### P3 重写（LiteGraph 0.37 兼容）
CDP 诊断 ComfyUI 0.37 真实子图节点结构：
- `link.origin_id = -10`（外部 IO 节点，不在 subgraph 内）
- `link.target_id = "810"`（内部真实 LoadImage）
- 旧 `link.resolve()` 找 origin → `getNodeById(-10)` 不存在 → **throw**
- 新链：`node.subgraph.getLink(id).target_id` → `subgraph.getNodeById(target_id)`
- 额外：`innerNode.inputs[slot]._widget` 在 0.37 为 null（promoted widgets 独占 binding）→ fallback 到 `innerNode.widgets.find(w => w.type === projected.type)`

### 全量恢复 P1/P2/P5/P6
- P1 `scan_staging.py`：2 处改动（空串→None + reference-in-place 零复制）
- P2 `log.py`：EMOJI_MAP → ASCII 级别标签
- P5 `vector_service.py`：`_load_siglip_components` 包 `asyncio.to_thread`
- P6 `searcher.py`：SQL 加 f 前缀 + `{IN_CLAUSE}` → `{{IN_CLAUSE}}`

### 最终 commit 链
| Commit | 内容 |
|---|---|
| `199d9ff1` | P3 初始双写（8-11） |
| `e3b7e706` | P4 补 vite resolve.alias（10-04） |
| `51c5dbe6` | P3 LiteGraph 0.37 重写（10-04） |
| `3e76c9bb` | P1/P2/P5/P6 恢复 + commit + push（10-04） |

### 验证
- 后端 Python：1746 passed / 0 failed / 1 skipped（symlink 权限）
- 前端 vitest：810 passed / 0 failed
- P3 CDP 实机验证：callbackFired=true

### 教训
- **没有 commit 的"本地生效"= 不存在**。上游 merge / reset / reinstall 都能冲掉。
- **dist/ 和 ui/vendor/ 在 .gitignore 里**，vite build 后必须手动 git add。
- LiteGraph 的 API 从 0.33 升到 0.37 改了 `link.resolve()` 语义——不再返回 inputNode，而是返回 origin 方向。子图节点内部查找应该用 `target_id`。

