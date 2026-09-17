# 时光书 H5 Demo 技术实现文档

## 1. 文档目标

本文用于指导两天内完成一个可稳定演示的 H5 Demo。第一目标不是搭建完整产品基础设施，而是用最低开发和运行成本验证以下核心价值：

1. 用户愿意通过聊天讲出亲子回忆、细节和感受。
2. 聊天内容能够被整理成可浏览的时间轴回忆。
3. 同一段回忆能够继续生成文章、漫画或日记卡，并形成可预览、可保存的作品。
4. 用户能理解 `时间轴 / 生成 / 我的` 三个区域的分工，并独立完成核心路径。

本文把技术范围分为 `两天 Demo` 和 `V1 完整版`。除非某项能力会阻断 Demo 闭环，否则不提前建设 V1 基础设施。

## 2. 实现原则

### 2.1 Demo 优先级

| 优先级 | 判断标准 | 处理方式 |
| --- | --- | --- |
| P0 | 不做就无法演示核心闭环 | 两天内真实实现 |
| P1 | 能明显提高演示可信度，但可降级 | 有时间实现，否则使用 Mock |
| P2 | 正式产品需要，但不影响价值验证 | 放入 V1 |

### 2.2 技术取舍

1. 单用户、单孩子档案，不做登录注册。
2. 页面、路由、表单、聊天、时间轴、作品历史必须真实可操作。
3. AI 工作流必须支持真实接口和本地 Mock 一键切换。
4. Demo 数据优先保存在浏览器，不建设业务数据库。
5. 不在前端暴露工作流密钥；需要密钥时使用一个极薄的服务端代理。
6. 不追求通用低代码工作台，三个生成页共用一个框架，通过类型配置切换。
7. 12 张最终 UI 图片稿是视觉和结构基准，图片中的生成结果、日期、聊天内容和数量是测试数据。

## 3. 推荐技术栈

| 层级 | Demo 选型 | 原因 |
| --- | --- | --- |
| 框架 | React + Vite + TypeScript | 启动快、H5 适配简单、组件复用成本低；初始化时使用项目可用的稳定版本。 |
| 路由 | React Router | 支持底部导航、返回行为和来源回忆参数。 |
| 样式 | CSS Variables + CSS Modules/普通 CSS | 最容易按定稿图精确还原，不引入大型 UI 组件库。 |
| 图标 | Lucide React | 覆盖导航、上传、发送、返回等常用图标，风格统一。 |
| 状态 | React Context + `useReducer` | Demo 状态规模有限，避免引入额外状态框架。 |
| 本地持久化 | localStorage | 保存时间轴、聊天、生成任务和作品，刷新后仍可演示。 |
| 图片处理 | 浏览器 File API + Canvas 压缩 | 上传后立即预览，并控制 localStorage 体积。 |
| ID | `crypto.randomUUID()` | 浏览器原生，无额外依赖。 |
| 内容指纹 | Web Crypto `SHA-256` | 用于日志整理去重。 |
| 测试 | Vitest + React Testing Library | 覆盖数据与关键组件逻辑。 |
| 端到端验收 | Playwright | 验证三条核心路径和移动端布局。 |

不建议在 Demo 阶段引入 Next.js、数据库 ORM、用户认证、消息队列、Redis、对象存储和完整后台管理。这些能力对两天内的核心验证没有直接贡献。

## 4. 总体架构

```text
H5 React SPA
├─ 页面与交互层
│  ├─ 时间轴
│  ├─ AI整理回忆
│  ├─ 三类生成工作台
│  └─ 我的作品
├─ 本地业务层
│  ├─ AppStore
│  ├─ TimelineRepository
│  ├─ ChatRepository
│  └─ GenerationRepository
├─ 工作流适配层
│  ├─ MockWorkflowAdapter
│  └─ RemoteWorkflowAdapter
└─ 可选薄代理 /api/workflow
   └─ 转发到用户已有的外部工作流
```

前端页面不直接理解具体工作流平台。页面只调用统一的 `WorkflowAdapter`，这样现场演示可使用 Mock，联调成功后只切换环境变量，不改页面逻辑。

## 5. 项目目录建议

```text
src/
├─ app/
│  ├─ App.tsx
│  ├─ router.tsx
│  └─ AppStore.tsx
├─ assets/
│  ├─ illustrations/
│  ├─ decorations/
│  └─ demo-results/
├─ components/
│  ├─ layout/
│  ├─ timeline/
│  ├─ chat/
│  ├─ generation/
│  └─ works/
├─ pages/
│  ├─ TimelinePage.tsx
│  ├─ NewEntryPage.tsx
│  ├─ MemoryChatPage.tsx
│  ├─ GenerateHomePage.tsx
│  ├─ GenerationWorkspacePage.tsx
│  └─ MyWorksPage.tsx
├─ data/
│  ├─ demoSeed.ts
│  └─ mockResponses.ts
├─ services/
│  ├─ workflow/
│  │  ├─ types.ts
│  │  ├─ mockAdapter.ts
│  │  ├─ remoteAdapter.ts
│  │  └─ index.ts
│  ├─ storage.ts
│  ├─ image.ts
│  └─ fingerprint.ts
├─ domain/
│  ├─ timeline.ts
│  ├─ chat.ts
│  └─ generation.ts
└─ styles/
   ├─ tokens.css
   └─ global.css
```

## 6. 路由与页面状态

| 路由 | 页面 | 关键参数/状态 |
| --- | --- | --- |
| `/` | 时间轴首页 | 日志倒序、筛选、用于生成。 |
| `/entry/new` | 新增回忆 | 日期精度、图片、文字。 |
| `/memory-chat` | AI整理回忆 | 独立聊天会话和整理批次。 |
| `/generate` | 生成首页 | 四个入口和最近创作。 |
| `/generate/:type` | 共用生成工作台 | `type=article/comic/diary-card`。 |
| `/mine` | 我的页面 | `tab=article/comic/diary-card`。 |

从时间轴带入回忆时使用：

```text
/generate/comic?sourceEntryId=entry_123
```

`sourceEntryId` 是可选参数。没有该参数时，用户直接通过聊天提供素材。生成完成后仍停留在当前路由，仅把工作台状态从 `chatting` 切换为 `preview`。

## 7. 核心组件与职责

| 组件 | 职责 | 复用范围 |
| --- | --- | --- |
| `AppShell` | 430px 移动端画布、页面安全区和底部留白。 | 全局 |
| `BottomNav` | 时间轴、生成、我的三个入口。 | 三个主页面 |
| `TimelineCard` | 展示一条回忆并提供“用于生成”。 | 时间轴 |
| `DatePrecisionPicker` | 年、年月、日期、区间选择。 | 新增、草稿确认 |
| `ImageUploader` | 选择、压缩、预览、删除图片。 | 新增、聊天、生成 |
| `ChatPanel` | 消息列表、输入框、图片、发送和自动滚动。 | AI整理、三个生成页 |
| `DraftConfirmSheet` | 修改整理结果并写入时间轴。 | AI整理 |
| `GenerationWorkspace` | 来源素材、聊天、生成中、预览状态编排。 | 文章、漫画、日记卡 |
| `InlinePreviewPanel` | 根据类型展示文章/漫画/日记卡结果。 | 三个生成页 |
| `MyWorksTabs` | 三类作品切换。 | 我的 |

为了两天内完成，文章、漫画、日记卡不分别复制页面。使用一份配置描述差异：

```ts
type GenerationType = 'article' | 'comic' | 'diary-card';

type GenerationConfig = {
  title: string;
  confirmLabel: string;
  openingMessage: string;
  mockResultId: string;
};
```

## 8. 数据模型

### 8.1 时间轴日志

```ts
type DatePrecision = 'year' | 'month' | 'day' | 'range';

type TimelineEntry = {
  id: string;
  datePrecision: DatePrecision;
  startDate: string;
  endDate?: string;
  title: string;
  content: string;
  imageDataUrls: string[];
  tags: string[];
  source: 'manual' | 'ai-organized';
  sourceBatchId?: string;
  contentHash: string;
  relatedGenerationIds: string[];
  createdAt: string;
  updatedAt: string;
};
```

### 8.2 聊天消息与会话

```ts
type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageDataUrls: string[];
  createdAt: string;
  processStatus: 'pending' | 'processing' | 'processed' | 'ignored';
  processedBatchId?: string;
};

type ChatSession = {
  id: string;
  purpose: 'memory' | 'article' | 'comic' | 'diary-card';
  sourceEntryId?: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};
```

### 8.3 生成任务与作品

```ts
type GenerationTask = {
  id: string;
  type: 'article' | 'comic' | 'diary-card';
  chatSessionId: string;
  sourceEntryId?: string;
  status: 'draft' | 'generating' | 'completed' | 'failed' | 'saved';
  result?: {
    title: string;
    text?: string;
    imageUrls?: string[];
    metadata?: Record<string, unknown>;
  };
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  savedAt?: string;
};
```

Demo 第一阶段只要求生成聊天关联 `GenerationTask`。将生成聊天再次归档到时间轴属于第二阶段或 V1，不阻塞两天 Demo。

## 9. 本地存储策略

使用一个带版本号的根键，避免多个零散键难以迁移：

```ts
type PersistedAppState = {
  schemaVersion: 1;
  childProfile: ChildProfile;
  timelineEntries: TimelineEntry[];
  chatSessions: ChatSession[];
  generationTasks: GenerationTask[];
};
```

建议键名：`timebook-demo:v1`。

保存策略：

1. App 启动时读取本地状态；不存在时注入演示种子数据。
2. 每次新增日志、发送消息、工作流状态变化和保存作品后立即持久化。
3. 提供仅开发环境可见的“重置 Demo 数据”方法，正式演示 UI 不显示。
4. 用户图片压缩到最长边 1280px、JPEG/WebP 质量约 0.72；单张压缩后超过 600KB 时拒绝并提示。
5. Demo 每次最多选择 3 张图片，避免 localStorage 超出浏览器限额。
6. 如果实际测试需要大量真图或跨设备访问，再迁移到 V1 对象存储，不在 Demo 中提前实现。

## 10. AI 整理去重

### 10.1 整理批次

1. 点击“整理 N 条新回答”时，只收集 `pending` 的用户消息及其图片。
2. 先创建 `batchId`，把这些消息临时标记为 `processing`。
3. 工作流返回草稿后展示确认 Sheet，不立即标记为已处理。
4. 用户确认写入时间轴成功后，才把消息标记为 `processed` 并写入 `processedBatchId`。
5. 用户取消或调用失败时，消息恢复为 `pending`。

### 10.2 内容指纹

```text
normalized = 日期精度 + 开始日期 + 标题去空白 + 正文去空白
contentHash = SHA-256(normalized)
```

写入前检查已有 `contentHash`：

- 完全相同：阻止重复写入并定位已有日志。
- 同日期但指纹不同：允许写入。
- 编辑已有日志：更新原记录，不创建新记录。

Demo 不做语义相似度去重。语义去重需要模型调用，成本和误判都高，不适合两天验证。

## 11. 生成工作台状态机

```text
chatting
  ├─ 发送消息 -> chatting
  ├─ 确认生成 -> generating
  └─ 返回 -> 保存草稿后离开

generating
  ├─ 成功 -> preview
  ├─ 失败 -> error
  └─ 禁止重复点击生成

preview
  ├─ 继续补充想法 -> chatting（保留原聊天和结果）
  ├─ 重新生成 -> generating（创建新结果版本）
  └─ 保存作品 -> saved

error
  ├─ 重试 -> generating
  └─ 返回聊天 -> chatting
```

文章、漫画、日记卡必须使用相同状态机。差异只存在于追问内容、请求参数和预览组件。

## 12. 工作流适配层

### 12.1 统一接口

```ts
interface WorkflowAdapter {
  nextQuestion(input: ChatWorkflowInput): Promise<ChatWorkflowResult>;
  organizeMemory(input: OrganizeMemoryInput): Promise<MemoryDraft>;
  generateArticle(input: GenerationInput): Promise<GenerationResult>;
  generateComic(input: GenerationInput): Promise<GenerationResult>;
  generateDiaryCard(input: GenerationInput): Promise<GenerationResult>;
}
```

环境变量：

```text
VITE_WORKFLOW_MODE=mock | remote
VITE_WORKFLOW_API_BASE=/api
```

不要在 `VITE_*` 变量中存放任何私密 Token，因为 Vite 会把它们打进浏览器代码。

### 12.2 Mock 模式

Mock 是 Demo 的正式降级方案，不只是临时占位：

1. 每类聊天准备 3-4 条顺序追问。
2. 工作流调用模拟 800-1500ms 延迟，展示生成中状态。
3. 文章返回本地示例正文。
4. 漫画和日记卡返回 `src/assets/demo-results` 中的定稿示例图。
5. 可通过固定关键词触发一次失败，用于验证错误和重试状态。

### 12.3 真实工作流模式

推荐前端只调用一个统一代理：

```http
POST /api/workflow
Content-Type: application/json

{
  "action": "nextQuestion | organizeMemory | generateArticle | generateComic | generateDiaryCard",
  "requestId": "uuid",
  "payload": {}
}
```

统一响应：

```json
{
  "ok": true,
  "requestId": "uuid",
  "data": {},
  "error": null
}
```

代理只负责：注入密钥、转发请求、统一超时和响应格式。Demo 不在代理中建设用户、数据库和复杂业务逻辑。

### 12.4 图片传递

浏览器 `blob:` URL 只能在当前设备访问，不能直接交给外部工作流。

- Mock 模式：直接使用本地 Data URL 预览。
- 真实文章工作流不需要图片时：只传图片描述或忽略图片。
- 真实漫画/日记卡需要图片时：由现有工作流提供可接收的上传接口，或由代理先上传后得到公网 URL。
- 如果第一天结束仍未完成公网图片链路，现场演示保持 Mock 图片结果，不让上传问题阻断核心流程。

## 13. 页面按钮与实现映射

| 页面/按钮 | 前端行为 | 数据/接口 | 成功后的页面变化 |
| --- | --- | --- | --- |
| 时间轴 `+` | 路由跳转 | 无 | `/entry/new` |
| `保存到时间轴` | 校验、压图、创建日志 | `TimelineRepository.create` | 返回 `/` 并显示新日志 |
| 时间轴 `AI整理` | 创建/恢复记忆会话 | `ChatRepository` | `/memory-chat` |
| `发送` | 先保存用户消息，再请求追问 | `nextQuestion` | 追加 AI 消息 |
| `整理 N 条新回答` | 锁定 pending 消息并整理 | `organizeMemory` | 打开草稿确认 Sheet |
| `写入时间轴` | 去重后创建日志 | 本地存储 | 返回时间轴或提示成功 |
| 时间轴 `用于生成` | 选择类型并携带日志 ID | 查询 `TimelineEntry` | `/generate/:type?sourceEntryId=...` |
| 生成首页四入口 | 路由跳转 | 无 | 对应工作台或 AI整理页 |
| 生成页 `发送` | 保存聊天并请求下一问 | `nextQuestion` | 留在当前工作台 |
| `确认生成...` | 创建任务并锁定按钮 | 对应生成工作流 | 当前页 `generating` |
| `继续补充想法` | 保留结果并恢复输入 | 更新任务草稿 | 当前页 `chatting` |
| `保存作品` | 状态改为 saved | `GenerationRepository.save` | Toast 成功，可在我的查看 |
| 我的分类 Tab | 过滤已保存任务 | 本地查询 | 当前页切换列表 |
| 作品 `查看` | 加载对应任务结果 | 本地查询 | 打开对应生成页预览状态 |

## 14. UI 落地策略

实现时以 `UI图片稿` 中 12 张定稿为基准：

1. 先提取颜色、间距、字体、圆角、阴影和底部导航为 Token。
2. 插画、角色、装饰尽量使用已确认资产，不用 CSS 手绘替代。
3. 状态栏 `9:41`、信号、电池属于图片稿展示占位，真实 H5 不绘制系统状态栏。
4. 作品标题、日期、数量、聊天文案、生成图片和生成正文全部由 Demo 种子或工作流结果驱动。
5. 先实现 390px 宽移动端；兼容 360-430px，桌面端只需居中展示移动画布。
6. 底部输入区和主按钮考虑软键盘与安全区：使用 `env(safe-area-inset-bottom)`，不要用写死的屏幕高度。

## 15. 两天实施排期

### Day 1：先跑通记录闭环

| 时间 | 实现内容 | 验收结果 |
| --- | --- | --- |
| 09:00-10:30 | Vite 工程、路由、Token、AppShell、BottomNav | 三个主导航可切换 |
| 10:30-12:30 | 本地数据模型、Repository、种子数据 | 刷新后数据仍存在 |
| 13:30-16:00 | 时间轴首页、新增回忆、日期精度、图片压缩 | 新回忆可保存并倒序出现 |
| 16:00-18:30 | 通用 ChatPanel、AI整理页、Mock 追问 | 可完成多轮聊天 |
| 19:30-22:00 | 整理草稿、确认 Sheet、批次状态和指纹去重 | 同一批消息不会重复写入 |

### Day 2：跑通生成闭环并校准视觉

| 时间 | 实现内容 | 验收结果 |
| --- | --- | --- |
| 09:00-11:00 | 生成首页、共用生成工作台和三类配置 | 四个入口均可进入 |
| 11:00-14:00 | 生成状态机、Mock 文章/漫画/日记卡 | 三类结果都在本页预览 |
| 14:00-16:00 | 保存作品、我的分类、作品查看 | 保存后可在我的找到 |
| 16:00-18:00 | 接真实工作流适配器；失败则保留 Mock | 模式可一键切换 |
| 18:00-21:00 | 对照 12 张图片稿校准、移动端回归、演示数据 | 3 分钟核心路径稳定完成 |

排期保护规则：第一天结束时如果视觉还原和业务闭环冲突，先保证业务闭环；第二天下午真实工作流仍不稳定时，立即冻结联调并使用 Mock 演示。

## 16. 测试与验收

### 16.1 必测路径

1. 手动新增：时间轴 `+` -> 选择年月 -> 上传图 -> 写文字 -> 保存 -> 时间轴出现。
2. AI整理：生成 Tab -> AI整理回忆 -> 多轮聊天 -> 整理 -> 修改草稿 -> 写入时间轴。
3. 无来源生成：生成 Tab -> 文章 -> 直接聊天 -> 确认生成 -> 本页预览 -> 保存 -> 我的查看。
4. 带来源生成：时间轴某条回忆 -> 用于生成 -> 漫画 -> 显示来源 -> 聊天 -> 预览。
5. 日记卡：选择主图或描述主图 -> 聊天 -> 本页竖版预览 -> 保存。
6. 去重：同一批聊天重复点击整理，不生成第二条相同日志。
7. 刷新恢复：在聊天、生成中或预览后刷新，已提交内容不消失。
8. 异常恢复：工作流失败后能重试或返回聊天，按钮不会永久锁死。

### 16.2 Demo 验收标准

1. 360px、390px、430px 三种宽度不横向溢出。
2. 底部导航始终只有 `时间轴 / 生成 / 我的`。
3. 生成首页明确显示 AI整理回忆和三个创作入口。
4. 三个生成页均以聊天为主体，不变成参数表单。
5. 生成结果均在当前页预览，不跳独立预览路由。
6. 我的页面只显示已保存作品，不提供生成入口。
7. Mock 模式断网可完成全部核心路径。
8. 连续点击发送、整理、生成和保存不会创建重复数据。
9. 浏览器控制台没有阻断流程的错误。

## 17. 对抗性检查与降级方案

| 反例/问题 | Demo 处理 |
| --- | --- |
| 用户不上传图片 | 允许纯文字完成时间轴、文章和日记卡；漫画使用默认示例素材。 |
| 用户不知道具体日期 | 支持只选年或年月，排序时使用可比较的开始日期。 |
| 用户只回答一句话就点击生成 | 不强制固定轮数；提示信息不足，但允许用默认补全完成演示。 |
| 用户反复点击生成 | `generating` 状态立即锁定按钮，并用 `requestId` 防重复响应。 |
| 用户生成后返回聊天再生成 | 保留旧结果，新结果覆盖当前预览；Demo 不做复杂版本管理。 |
| 用户关闭页面再打开 | 从 localStorage 恢复最近会话和任务。 |
| localStorage 被大图占满 | 上传前压缩、限制数量和大小；失败时提示改用示例图。 |
| 工作流返回字段缺失 | 适配器做最小运行时校验，不合格则进入错误态或使用 Mock fallback。 |
| 工作流超时 | 15-30 秒超时，显示重试；现场演示可切换 Mock。 |
| 漫画不像真人 | 页面明确为固定亲子插画风格，不承诺真人还原。 |
| 我的页面误成创作入口 | 只允许分类查看已保存作品，不展示草稿，也不出现“新建作品”主按钮。 |
| 刷新时任务仍是 generating | 启动时将超过超时时间的任务改为 failed，允许重试。 |

## 18. 成本控制

1. 默认 Mock 演示不产生模型费用。
2. 真实联调只保留一套固定测试数据，避免反复生成昂贵漫画。
3. 文本追问可用较低成本模型；最终文章再使用质量更高的模型。
4. 漫画和日记卡在 Demo 中优先返回预先生成的测试成品，验证的是交互和价值感知，不验证大规模生图吞吐。
5. 每次真实生成记录 `requestId`、类型、耗时、成功失败；Demo 不必实现精确计费面板。

## 19. V1 完整版迁移

Demo 验证通过后，再按以下顺序建设 V1：

| 阶段 | 新增能力 | Demo 中的迁移点 |
| --- | --- | --- |
| V1-1 | 登录、用户、孩子档案 | 固定 `childProfile` 改为服务端实体。 |
| V1-2 | 云数据库与 API | Repository 接口保持不变，localStorage 实现替换为远端实现。 |
| V1-3 | 图片对象存储与隐私策略 | Data URL 替换为上传后的私有 URL 和缩略图。 |
| V1-4 | 可恢复 AI 任务 | `GenerationTask` 服务端持久化，支持任务 ID、重试和跨设备恢复。 |
| V1-5 | 作品版本与导出 | 保存多次生成版本，支持高清图、长图或 PDF。 |
| V1-6 | 额度、支付和成本核算 | 按生成类型记录模型、Token、图片次数和成本。 |
| V1-7 | 分享、权限和删除 | 分享链接、访问权限、数据导出和彻底删除。 |

V1 数据库建议至少包含：`users`、`children`、`timeline_entries`、`chat_sessions`、`chat_messages`、`generation_tasks`、`generation_results`、`media_assets`。图片进入对象存储，数据库只保存元数据和 URL。每次真实生成应在调用前创建唯一任务 ID，并保存模型、状态、耗时、用量和错误信息，避免昂贵且不可复现的生成结果丢失。

## 20. 明确不进入两天 Demo 的内容

1. 登录、短信、微信授权和多端同步。
2. 多孩子、多家庭成员和协作权限。
3. 会员、支付、额度包和计费。
4. 正式对象存储、CDN、数据库和后台管理。
5. 复杂语义去重、全文检索和推荐系统。
6. 漫画真人一致性、角色训练和多风格模型选择。
7. 高清导出、PDF、实体书和物流。
8. 消息通知、埋点平台和复杂运营配置。

## 21. 最终交付定义

两天 Demo 完成的标志不是页面数量，而是以下闭环可重复演示：

```text
记录或聊天提供一段真实回忆
-> 时间轴形成可回看的日志
-> 从独立生成区或时间轴来源进入创作工作台
-> 多轮聊天确认想法
-> 当前页看到文章/漫画/日记卡成品
-> 保存后在“我的”分类查看
```

只要该闭环在 Mock 模式下稳定、在真实工作流可用时能够替换调用，并且用户能在 3 分钟内理解和完成，Demo 就已经达到验证目标。V1 的任务是把已被验证的闭环变成可长期保存、可跨设备使用、可计费和可规模化运行的正式产品。
