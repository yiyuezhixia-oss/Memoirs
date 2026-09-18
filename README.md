# 时光书 H5 Demo

时光书是一个面向亲子回忆记录与 AI 创作的 H5 Demo。用户可记录时间轴回忆，并通过聊天生成文章、漫画和日记卡。

## 本地运行

要求：Node.js 20 或更高版本。

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

打开终端显示的本地地址即可访问。未填写 `.env.local` 中的密钥时，项目会以本地 Mock 数据运行，可完整体验页面与交互流程。

## 环境变量

从 `.env.example` 复制生成 `.env.local` 后按需填写：

- `VITE_LLM_BASE_URL`、`VITE_LLM_API_KEY`、`VITE_LLM_MODEL`：聊天模型配置。
- `VITE_COZE_BASE_URL`、`VITE_COZE_API_KEY`：Coze 工作流配置。
- `VITE_COZE_IMAGE_WORKFLOW_ID`、`VITE_COZE_ARTICLE_WORKFLOW_ID`：图像与文章工作流 ID。

`.env.local` 已被 Git 忽略，不能提交真实密钥。由于 `VITE_*` 会被编译到浏览器，生产环境应改由服务端代理工作流请求，不要直接暴露正式密钥。

## 构建

```bash
npm run build
npm run preview
```

## Vercel 部署

在 Vercel 导入本仓库，框架选择 Vite，构建命令使用 `npm run build`，输出目录为 `dist`。如需真实 AI 能力，在 Vercel 项目的 Environment Variables 中添加与 `.env.example` 对应的变量后重新部署。
