# Gloss（追问）

在 DeepSeek Harness 的对话里划选一段文字，就地追问，不打断主线。

选中文字后，原生的「引用」气泡旁会出现「追问」；点开后是一个一次性小窗，背后是一个 fork 出来的子会话。子会话继承主对话到选区为止的上下文，但小窗里的问答只留在子会话里；关掉小窗，主线什么都不会多出来。

[English](README.md) | 中文

```
主对话                                    Gloss 小窗
┌────────────────────────────┐   ┌─────────────────────────────┐
│ … 这一段文字 …      [引用]  │   │ 追问                    ✕   │
│                      [追问] │   │ 「… 这一段文字 …」          │
│                            │   │ 问：这段是什么意思？         │
│                            │   │ 答：…                        │
└────────────────────────────┘   └─────────────────────────────┘
```

## 状态

实验性。针对 DeepSeek Harness `0.2.2-alpha.3` 测试。Gloss 用到了一些 DSH 的客户端 API 和私有 DOM 属性，DSH 升级时可能变化，见 [COMPATIBILITY.md](COMPATIBILITY.md)。

现在可以直接从 GitHub 安装；market index 指向固定的 Git commit，不需要 npm 账号；npm 发布暂缓。

## 特性

- **划词优先**：选区手势结束后，「追问」出现在原生「引用」动作旁边，而不是拖动过程中。
- **继承上下文**：fork 到主线最后一条 durable 事件，子会话能看到主对话此前看到的内容。
- **用完即弃**：关闭时释放引用并归档子会话；主线的 transcript、队列、agent 都不受影响。
- **连续追问**：同一个小窗里可以问多轮，可以停止长回答，选区一直留在上方。
- **纯客户端**：没有 Host 服务、没有 npm 依赖、没有构建步骤，`client.js` 由客户端模块加载器直接加载。

## 安装

### 从 GitHub

```sh
git clone https://github.com/DjTaNg-404/dsh-gloss.git
dsh plugin --profile <profile> add /absolute/path/to/dsh-gloss
```

也可以直接装 Git 源：

```sh
dsh plugin --profile <profile> add "git+https://github.com/DjTaNg-404/dsh-gloss.git"
```

或者在 GUI 里：**Plugins → 安装 → 绝对本地目录**，指向克隆下来的目录。装完重启一次 DSH，确认 bundle 是持久的。

### 从插件索引（索引托管之后）

在 Plugins 页打开 **Experimental plugins → Custom plugin indexes**，添加索引 URL，然后在 Discover 里安装 Gloss：

```
https://djtang-404.github.io/dsh-gloss/market/index.json
```

索引安装的是固定的 Git commit，不经过 npm。需要先给仓库开 GitHub Pages（Settings → Pages → `main` / root），这个 URL 才能访问。

## 使用

1. 在助手回复、用户消息或 reasoning 块里划选文字。
2. 点原生「引用」旁的「追问」。
3. 输入问题；输入框为空时直接回车，会让它解释这段文字。
4. 「停止」取消长回答，**✕** 或 Esc 关闭小窗。

关闭会归档子会话。这不是安全删除：归档的会话仍然可以从工作区找回。

## 工作方式

- `conversation.composer.dock` 里放一个隐形标记，把当前会话映射到它的滚动容器。
- 选区的「追问」和小窗都在 `shell.overlay` 里；按钮定位在宿主「引用」气泡右侧。
- 打开小窗时调用 `sessions.fork({ atSeq })`，边界取主线最后一条**durable**事件（transient 的实时 chunk 是小数 seq，绝不会拿来 fork），然后 `sessions.retain`、在子会话里 `session.prompt`。
- 关闭时释放引用并 `uiWorkspace.archiveSession(childId, { stopActivity: true })`；如果 fork 还没完成就关闭，会取消、释放已创建的资源并归档子会话，弹窗不会复活。
- 子会话继承主线的 agent preset；provider / model 取 fork 时的全局默认模型，不跟随主线的 session 级选择。

## 隐私与数据

Gloss 本身没有遥测、分析或自己的网络请求，但它会改变对话数据的去向：

- 打开小窗会把主线的历史前缀**复制**成一份新的子会话日志写到磁盘，并在每次提问时把这段前缀加上选中的文字发给 DSH 里配置的模型 provider。
- 关闭只是归档。归档的会话仍然在磁盘上、可以找回；Gloss 不做安全删除。
- 子会话是一个正常 agent，继承主线的 preset。追问有可能触发工具调用、修改工作区文件；关掉小窗不会回滚这些改动。
- 不要在选区里放你不想发给该 provider 的密钥或敏感内容。

## 兼容性

针对 DSH `0.2.2-alpha.3` 测试；package 声明：

```json
{ "engines": { "dsh": ">=0.2.2-alpha.3 <0.3.0" } }
```

Gloss 依赖的私有 DOM 属性和客户端 API 列在 [COMPATIBILITY.md](COMPATIBILITY.md)。DSH 升级后如果按钮或小窗消失，先看那个文件。

## 已知限制

- 原生「引用」和 Gloss「追问」是两个并列的胶囊。合并成同一条动作条需要改对话交互的分发契约（一次手势只允许一个 surface）。
- 子会话是真实的 fork：会在侧边栏短暂出现，并在磁盘上复制一份主线前缀。
- 每次提问都会把继承的历史发给模型，长对话的成本和主线自己发一轮接近。
- Markdown 是本地子集：标题、列表、代码块、引用、强调、行内代码、链接；不支持表格和图片。
- 模型输出由 React 渲染，链接没有做 scheme 过滤。
- 没有安全删除；静态加密取决于 DSH 本身。

## 开发

需要 Node 24.9 或更新版本（和 DSH 一致）。

```sh
npm test              # 纯逻辑 + fork 生命周期回归
npm run check         # node --check client.js + market 脚本
npm run market:sync   # 提交后重新生成 Git 源的 market/index.json
```

目录：

- `client.js` — 整个客户端半边（Slot、选区按钮、小窗、markdown）。
- `index.js` — bundle patch 需要的空 Host 半边。
- `cordis.patch.yml` — 插入 `gloss` 行。
- `test/logic.test.mjs` — 在临时副本里注入 `__test`，测纯逻辑和 fork/取消/清理路径。
- `market/` — format 1 的 DSH 插件索引条目和图标。

没有构建步骤。改完 `client.js`，刷新页面或重启 DSH。

## License

[MIT](LICENSE)。
