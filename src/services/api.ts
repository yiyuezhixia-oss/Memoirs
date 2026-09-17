import type { ApiRunMeta, ArticleStyle, GenerationResult, GenerationType, MemoryDraft, PreparedGeneration, RoleConfig, RoleId } from '../types';

export type ApiMode = 'mock' | 'llm' | 'coze';

type JsonRecord = Record<string, unknown>;

export type ChatApiMessage = {
  role: 'user' | 'assistant';
  content: string;
  imageDataUrls?: string[];
};

export type ApiConfig = {
  mode: ApiMode;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  cozeBaseUrl: string;
  cozeApiKey: string;
  cozeWorkflowIds: Partial<Record<GenerationType, string>>;
  timeoutMs: number;
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const isRecord = (value: unknown): value is JsonRecord => Boolean(value && typeof value === 'object');

// 配置由构建环境注入，避免把真实密钥提交到源码仓库。
// 后台配置页面仍可作为展示和备用保存，但实际运行不会读取它。
export function loadApiConfig(): ApiConfig {
  return defaultApiConfig();
}

const envValue = (name: string) => import.meta.env[name]?.trim() || '';
const DEFAULT_COZE_BASE_URL = 'https://api.coze.cn/v1/workflow/stream_run';
const DEFAULT_LLM_BASE_URL = 'https://api.deepseek.com/chat/completions';
const DEFAULT_LLM_MODEL = 'deepseek-v4-flash';

export function defaultApiConfig(): ApiConfig {
  const cozeApiKey = envValue('VITE_COZE_API_KEY');
  const llmApiKey = envValue('VITE_LLM_API_KEY');
  const hasCozeConfig = Boolean(cozeApiKey && envValue('VITE_COZE_IMAGE_WORKFLOW_ID'));
  const mode: ApiMode = hasCozeConfig ? 'coze' : llmApiKey ? 'llm' : 'mock';

  return {
    mode,
    llmBaseUrl: envValue('VITE_LLM_BASE_URL') || DEFAULT_LLM_BASE_URL,
    llmApiKey,
    llmModel: envValue('VITE_LLM_MODEL') || DEFAULT_LLM_MODEL,
    cozeBaseUrl: envValue('VITE_COZE_BASE_URL') || DEFAULT_COZE_BASE_URL,
    cozeApiKey,
    cozeWorkflowIds: {
      article: envValue('VITE_COZE_ARTICLE_WORKFLOW_ID'),
      comic: envValue('VITE_COZE_IMAGE_WORKFLOW_ID'),
      'diary-card': envValue('VITE_COZE_IMAGE_WORKFLOW_ID'),
    },
    timeoutMs: Number(envValue('VITE_REQUEST_TIMEOUT_MS')) || 120000,
  };
}

export function saveApiConfig(config: ApiConfig): void {
  try { localStorage.setItem('timebook-api-config:v1', JSON.stringify(config)); } catch { /* ignore quota errors */ }
}

function mockMeta(warning?: string): ApiRunMeta {
  return { source: 'mock', warning: warning || '当前使用本地 mock；配置真实 API 后才会发起网络请求。' };
}

function messagesText(messages: Array<{ role: string; content: string }>) {
  return messages.map((message) => `${message.role === 'user' ? '用户' : '助手'}：${message.content}`).join('\n');
}

function memoryMock(messages: Array<{ role: string; content: string }>, images: string[]): MemoryDraft {
  const userText = messages.filter((message) => message.role === 'user').map((message) => message.content).join(' ');
  const title = userText.match(/毕业|毕业典礼/) ? '毕业那天的拥抱' : userText.match(/自行车|骑车|滑板/) ? '第一次学会骑车' : userText.slice(0, 14) || '一段新的回忆';
  return {
    datePrecision: 'day',
    startDate: '2026-08-05',
    title,
    content: userText ? `把你刚刚说的这段记忆留下来：${userText}` : '把这一刻好好留在时光书里。',
    imageDataUrls: images,
  };
}

function generationMock(type: GenerationType, style?: ArticleStyle): GenerationResult {
  if (type === 'article') {
    const styleLabel = style || '通用';
    return { title: `【${styleLabel}】写给这段回忆里的你`, text: `已选择「${styleLabel}」风格。\n\n那天发生的事并不轰轰烈烈，却被我一直放在心里。\n\n我记得你的动作、你的声音，也记得那一刻自己又骄傲又舍不得。谢谢你让我参与你的成长，未来慢慢走，我会一直在这里。`, metadata: { source: 'mock', style: styleLabel } };
  }
  if (type === 'comic') return { title: '一段亲子回忆漫画', imageUrls: [], metadata: { panels: '6格', notice: '亲子氛围插画，不承诺真人还原', source: 'mock' } };
  return { title: '把这一刻留给以后', text: '一件小事，也值得被好好记住。', imageUrls: [], metadata: { mood: '温柔', source: 'mock' } };
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let body: unknown = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { text }; }
    if (!response.ok) throw new Error(`API ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    return body;
  } finally {
    window.clearTimeout(timeout);
  }
}

function extractText(body: unknown) {
  if (typeof body === 'string') return parseCozeStream(body);
  if (!isRecord(body)) return '';
  // Coze 流式接口返回的 text 字段需要按 SSE 解析
  if (typeof body.text === 'string') return parseCozeStream(body.text) || body.text;
  // Coze /run 接口把结果放在 data 字段（JSON 字符串），例如 { data: '{"output":"https://..."}' }
  if (typeof body.data === 'string') {
    try {
      const parsed = JSON.parse(body.data);
      if (isRecord(parsed)) return extractText(parsed);
    } catch { /* ignore */ }
    return parseCozeStream(body.data) || body.data;
  }
  const choices = body.choices;
  if (Array.isArray(choices) && isRecord(choices[0])) {
    const message = choices[0].message;
    if (isRecord(message) && typeof message.content === 'string') return message.content;
    if (typeof choices[0].text === 'string') return choices[0].text;
  }
  for (const key of ['output', 'content', 'text', 'result']) if (typeof body[key] === 'string') return body[key] as string;
  return JSON.stringify(body);
}

// 解析 Coze /v1/workflow/stream_run 返回的 SSE 流：找到 event:Message 的数据，提取 content.output
function parseCozeStream(text: string): string {
  const messages: string[] = [];
  let currentEvent = '';
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('event:')) {
      currentEvent = line.slice(6).trim();
    } else if (line.startsWith('data:') && currentEvent === 'Message') {
      messages.push(line.slice(5).trim());
    }
  }
  for (const msg of messages) {
    try {
      const parsed = JSON.parse(msg) as Record<string, unknown>;
      const content = typeof parsed.content === 'string' ? parsed.content : '';
      if (!content) continue;
      try {
        const inner = JSON.parse(content) as Record<string, unknown>;
        if (typeof inner.output === 'string' && inner.output.trim()) return inner.output.trim();
      } catch {
        if (content.trim()) return content.trim();
      }
    } catch { /* ignore */ }
  }
  return '';
}

// 解析单个 SSE 事件块（以 \n\n 分隔的一段），返回 { event, data } 或 null
function parseSseEvent(chunk: string): { event: string; data: string } | null {
  let event = '';
  const dataLines: string[] = [];
  for (const line of chunk.split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  return { event, data: dataLines.join('\n') };
}

// 从 SSE data 里提取 Coze 工作流的业务输出（data.content.output），并处理业务错误码
function extractCozeOutput(ev: { event: string; data: string }): string {
  if (ev.event && ev.event !== 'Message' && ev.event !== 'Conversation' && ev.event !== 'done' && ev.event !== 'error') return '';
  const raw = ev.data;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // 业务错误（如 4200 workflow not found）直接抛出
    if (typeof parsed.code === 'number' && parsed.code !== 0) {
      throw new Error(`Coze 工作流错误（code ${parsed.code}）：${typeof parsed.msg === 'string' ? parsed.msg : ''}`);
    }
    const content = typeof parsed.content === 'string' ? parsed.content : '';
    if (!content) return '';
    try {
      const inner = JSON.parse(content) as Record<string, unknown>;
      if (typeof inner.output === 'string' && inner.output.trim()) return inner.output.trim();
      if (typeof inner.data === 'string' && inner.data.trim()) return inner.data.trim();
    } catch {
      if (content.trim()) return content.trim();
    }
    return '';
  } catch (error) {
    if (error instanceof Error && error.message.includes('Coze 工作流错误')) throw error;
    return '';
  }
}

function messageContent(message: ChatApiMessage): unknown {
  if (!message.imageDataUrls?.length) return message.content;
  // DeepSeek 文本模型暂不支持多模态图片输入，降级为文字描述，避免接口报错。
  const imageNote = `\n\n[用户附带 ${message.imageDataUrls.length} 张照片，请基于文字描述理解，照片内容由用户在对话中说明]`;
  return (message.content + imageNote).trim();
}

type LlmOptions = { responseFormat?: { type: 'json_object' | 'text' }; temperature?: number };

async function callLlm(role: RoleConfig, lastMessage: ChatApiMessage, config: ApiConfig, history: ChatApiMessage[] = [], options: LlmOptions = {}): Promise<{ text: string; meta: ApiRunMeta }> {
  if (!config.llmBaseUrl || !config.llmApiKey || !config.llmModel) throw new Error('大模型 API 未完整配置：需要地址、API Key 和模型名。');
  const messages = [
    { role: 'system', content: role.systemPrompt },
    ...history.map((message) => ({ role: message.role, content: messageContent(message) })),
    { role: 'user', content: messageContent(lastMessage) },
  ];
  const payload: Record<string, unknown> = { model: config.llmModel, messages };
  if (options.responseFormat) payload.response_format = options.responseFormat;
  if (typeof options.temperature === 'number') payload.temperature = options.temperature;
  const body = await fetchJson(config.llmBaseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.llmApiKey}` },
    body: JSON.stringify(payload),
  }, config.timeoutMs);
  return { text: extractText(body), meta: { source: 'llm' } };
}

function hasLlmConfig(config: ApiConfig) {
  return Boolean(config.llmBaseUrl && config.llmApiKey && config.llmModel);
}

export async function chatWithRole(role: RoleConfig, messages: ChatApiMessage[], config = loadApiConfig()): Promise<{ text: string; meta: ApiRunMeta }> {
  const userMessages = messages.filter((message) => message.role === 'user');
  const last = userMessages.at(-1);
  const fallback = fallbackChat(role.id, last?.content || '');
  if (!hasLlmConfig(config)) {
    await wait(350);
    return { text: fallback, meta: mockMeta() };
  }
  if (!last) throw new Error('对话至少需要一条用户消息。');
  return callLlm(role, last, config, messages.slice(0, -1));
}

function fallbackChat(roleId: RoleId, content: string) {
  if (!content.trim()) return '可以继续说说这段回忆吗？细节越小越珍贵。';
  if (roleId === 'memory-organizer') return '我记下来了。那一刻发生在哪里？孩子当时说了什么，或者做了什么让你印象特别深的小动作？';
  if (roleId === 'article-writer') return '我听见了这份感受。你更想把这篇文章写给孩子本人，还是留给未来的家人一起看？';
  if (roleId === 'comic-director') return '这一幕很适合画下来。你最想突出人物的哪个动作和表情？画面希望更温暖、安静，还是更有活力？';
  return '我记下这句话了。日记卡上你最想突出标题、照片，还是当时的心情？';
}

function textToMemoryDraft(text: string, fallback: MemoryDraft): MemoryDraft {
  try {
    const parsed = JSON.parse(text) as Partial<MemoryDraft>;
    if (parsed.title && parsed.content && parsed.startDate) return { ...fallback, ...parsed, imageDataUrls: fallback.imageDataUrls };
  } catch {
    // natural language response is valid; keep it as the content instead of forcing JSON
  }
  return { ...fallback, content: text || fallback.content };
}

export async function prepareMemory(messages: Array<{ role: string; content: string }>, images: string[], role: RoleConfig, config = loadApiConfig()): Promise<{ draft: MemoryDraft; meta: ApiRunMeta }> {
  const fallback = memoryMock(messages, images);
  if (!hasLlmConfig(config)) {
    await wait(250);
    return { draft: fallback, meta: mockMeta() };
  }
  const result = await callLlm(role, { role: 'user', content: `${messagesText(messages)}\n\n请把这段回忆整理成时间轴草稿，输出 JSON，字段包含：datePrecision(day/range)、startDate(YYYY-MM-DD)、endDate(可空)、title、content(一句话记录)、tags(数组)。示例输出：{"datePrecision":"day","startDate":"2026-08-05","title":"第一次学会骑车","content":"孩子在公园第一次学会骑车","tags":["成长"]}。`, imageDataUrls: images }, config, [], { responseFormat: { type: 'json_object' } });
  return { draft: textToMemoryDraft(result.text, fallback), meta: result.meta };
}

export async function prepareGeneration(type: GenerationType, messages: Array<{ role: string; content: string }>, sourceText: string, images: string[], role: RoleConfig, config = loadApiConfig(), style?: ArticleStyle): Promise<PreparedGeneration> {
  const outputHint = role.outputFormat ? `最终产出形式：${role.outputFormat}。` : '';
  const styleHint = type === 'article' && style ? `目标文章风格：${style}。请按此风格整理最终创作所需内容。` : '';
  const diaryHint = type === 'diary-card' ? '注意：这是「日记卡」而非多格漫画，请整理为单张纪念卡片风格图的生图提示词（画面温暖、留白可承载标题与日期文字）。' : '';
  const prompt = `角色设定（人设/语气/产出结构由此决定）：${role.name}。\n原始素材：${sourceText}\n用户补充：${messagesText(messages)}\n\n请严格以上述角色设定为基调（语气、人设、最终产出结构都要符合该角色），整理${type === 'comic' ? '生图提示词和分镜' : '最终创作所需内容'}。${outputHint}${styleHint}${diaryHint}`;
  if (!hasLlmConfig(config)) {
    await wait(250);
    return { type, prompt, outputInstruction: role.outputFormat, referenceImageUrls: images.filter((image) => image.startsWith('http')), imageDataUrls: images, style, meta: mockMeta() };
  }
  // 用角色 systemPrompt 作为 system 消息，使三个生成入口因角色不同而返回不同语气与结构
  const result = await callLlm(role, { role: 'user', content: prompt }, config);
  return { type, prompt: result.text, outputInstruction: role.outputFormat, referenceImageUrls: images.filter((image) => image.startsWith('http')), imageDataUrls: images, style, meta: result.meta };
}

async function uploadCozeFile(dataUrl: string, config: ApiConfig): Promise<string> {
  const [header, base64] = dataUrl.split(',');
  const mime = (header.match(/data:(.*?);/)?.[1]) || 'image/png';
  const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
  const byteString = window.atob(base64);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i += 1) bytes[i] = byteString.charCodeAt(i);
  const file = new File([bytes], `reference.${ext}`, { type: mime });
  const form = new FormData();
  form.append('file', file);
  const uploadBaseUrl = config.cozeBaseUrl.replace(/\/v1\/workflow\/run\/?$/, '');
  const response = await fetchJson(`${uploadBaseUrl}/v1/files/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.cozeApiKey}` },
    body: form,
  }, config.timeoutMs);
  if (!isRecord(response) || !isRecord(response.data) || typeof response.data.id !== 'string') {
    throw new Error(`Coze 文件上传失败：${JSON.stringify(response)}`);
  }
  return response.data.id;
}

export async function runGeneration(type: GenerationType, prepared: PreparedGeneration, config = loadApiConfig(), role?: RoleConfig): Promise<{ result: GenerationResult; meta: ApiRunMeta }> {
  if (config.mode !== 'coze') {
    await wait(500);
    return { result: generationMock(type, prepared.style), meta: prepared.meta.source === 'mock' ? prepared.meta : { source: 'mock', warning: 'Coze 未配置，使用本地生成 mock。' } };
  }
  // 文章生成走 DeepSeek 直接产出（Coze 文章工作流内部依赖知识库检索，直接传入素材无法稳定产出），
  // 漫画/日记卡仍走 Coze 生图工作流（已实测可稳定返回图片）。
  if (type === 'article') {
    if (!hasLlmConfig(config)) {
      await wait(400);
      return { result: generationMock('article', prepared.style), meta: { source: 'mock', warning: '大模型未配置，使用本地文章 mock。' } };
    }
    // 优先使用后台角色配置（roles）中的 systemPrompt；无配置时回退到内置写作指令。
    const writingSystemPrompt =
      role?.systemPrompt?.trim() ||
      ('你是一位温暖细腻的家庭文章写作者，擅长把普通的家庭回忆写成打动人心的短文。' +
      '下面提供的是「已经整理好的创作素材」，不是对话，请你基于这些素材直接写一篇完整的文章。' +
      '【格式要求，必须遵守】第一行必须是文章标题，只写标题文字，不要加 #、**、【】等任何符号。' +
      '从第二行开始是正文，段落之间空一行。正文不要出现类似标题的短句作为第一行。' +
      '不要使用 Markdown 标题符号，除非必要不要使用加粗符号。' +
      '语言自然亲切，像写给家人的信。如果素材里提到「风格」，请贴合该风格。');
    const writerRole: RoleConfig = {
      id: role?.id ?? 'article-writer',
      name: role?.name ?? '文章作者',
      description: role?.description ?? '',
      entryLabel: role?.entryLabel ?? '生成文章',
      systemPrompt: writingSystemPrompt,
      conversationGoal: role?.conversationGoal ?? '',
      outputFormat: role?.outputFormat ?? '标题 + 正文',
      downstream: role?.downstream ?? '',
      enabled: true,
      updatedAt: new Date().toISOString(),
    };
    const llm = await callLlm(
      writerRole,
      { role: 'user', content: `【第一行必须是标题】\n\n以下是创作素材，请据此写一篇完整文章：\n\n${prepared.prompt}` },
      config,
    );
    const text = llm.text.trim();
    if (!text) throw new Error('大模型返回为空，请稍后重试');
    const parsed = parseArticle(text);
    const title = parsed.title === '通用风格文章' && prepared.style ? `${prepared.style}风格文章` : parsed.title;
    return { result: { title, text: parsed.body, metadata: { source: 'llm' }, rawOutput: text }, meta: llm.meta };
  }
  const workflowId = config.cozeWorkflowIds[type];
  if (!config.cozeBaseUrl || !config.cozeApiKey || !workflowId) throw new Error(`Coze 未完整配置：缺少 ${type} 工作流地址、Key 或 workflow ID。`);

  // 若后台配置了角色，将其人设/语气要求作为前缀透传给 Coze 工作流，使生图也受角色约束
  const rolePrefix = role?.systemPrompt?.trim() ? `【角色设定】${role.systemPrompt}\n\n` : '';
  const parameters: Record<string, unknown> = { prompt: rolePrefix + prepared.prompt };
  // 生图工作流：输入 mode + prompt + image
  // 实测有效的 image 格式：
  //   - 外部 HTTP(S) 图片 URL 可直接传字符串
  //   - 本地上传图片需先 /v1/files/upload 拿 file_id，再包成 {"file_id":"...","type":"image"}
  // 漫画与日记卡共用生图工作流 7670440935159447604，按 mode 区分分支（均已修复可正常出图）。
  parameters.mode = type === 'diary-card' ? '日记卡生成' : '漫画生成';
  const images = prepared.imageDataUrls.length ? prepared.imageDataUrls : prepared.referenceImageUrls;
  const httpUrls = images.filter((url) => url.startsWith('http'));
  const dataUrls = images.filter((url) => url.startsWith('data:'));
  let fileIds: string[] = [];
  try {
    fileIds = await Promise.all(dataUrls.map((url) => uploadCozeFile(url, config)));
  } catch (error) {
    throw new Error(`Coze 图片上传失败：${error instanceof Error ? error.message : String(error)}`);
  }
  const imageValues = [
    ...httpUrls,
    ...fileIds.map((id) => JSON.stringify({ file_id: id, type: 'image' })),
  ];
  if (imageValues.length === 1) {
    parameters.image = imageValues[0];
  } else if (imageValues.length > 1) {
    parameters.image = imageValues;
  }
  // 漫画/日记卡走 Coze 生图工作流。
  // 实测 /v1/workflow/run（非流式）响应快且能直接返回图片 URL；stream_run 在浏览器 fetch 中容易挂起，
  // 因此优先使用非流式接口，失败或为空时再回退到 SSE 流式。
  const runUrl = config.cozeBaseUrl.replace(/\/v1\/workflow\/stream_run\/?$/, '/v1/workflow/run');
  try {
    const runResp = await fetchJson(runUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.cozeApiKey}` }, body: JSON.stringify({ workflow_id: workflowId, parameters }) }, config.timeoutMs);
    const runOut = extractText(runResp);
    const runData = isRecord(runResp) && typeof runResp.data === 'string'
      ? (() => { try { return JSON.parse(runResp.data); } catch { return {}; } })()
      : runResp;
    if (runOut) return buildCozeResult(runOut, runData, type);
  } catch { /* 非流式失败，继续走流式兜底 */ }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  let rawText = '';
  try {
    const resp = await fetch(config.cozeBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.cozeApiKey}` },
      body: JSON.stringify({ workflow_id: workflowId, parameters }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Coze 请求失败（HTTP ${resp.status}）：${errText.slice(0, 200)}`);
    }
    if (!resp.body) throw new Error('Coze 响应没有可读的数据流（body 为空）');
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let done = false;
    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;
      if (value) buffer += decoder.decode(value, { stream: true });
      // 逐块扫描已完成的 SSE 事件
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const ev = parseSseEvent(chunk);
        if (ev) {
          const output = extractCozeOutput(ev);
          if (output) { rawText = output; done = true; reader.cancel(); break; }
        }
      }
      if (rawText) break;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('Coze 工作流请求超时，请稍后重试');
    throw error;
  } finally {
    clearTimeout(timer);
  }
  if (!rawText) throw new Error('Coze 工作流未返回有效结果，请检查工作流配置或稍后重试');
  return buildCozeResult(rawText, undefined, type);
}

function stripMarkdownTitle(line: string): string {
  return line
    .replace(/^\s*#{1,6}\s+/, '')
    .replace(/^\s*\*{1,3}(.+?)\*{1,3}\s*$/, '$1')
    .replace(/^\s*【(.+?)】\s*$/, '$1')
    .replace(/^\s*「(.+?)」\s*$/, '$1')
    .replace(/^\s*“(.+?)”\s*$/, '$1')
    .trim();
}

function parseArticle(text: string): { title: string; body: string } {
  const trimmed = (text || '').trim();
  if (!trimmed) return { title: '通用风格文章', body: '' };
  const strict = trimmed.match(/^###(.+?)###\s*\n?([\s\S]*)$/);
  if (strict) {
    const t = strict[1].trim();
    const b = strict[2].trim();
    if (t && b) return { title: t, body: b };
  }
  const lines = trimmed.split('\n');
  const nonEmpty = lines.findIndex((l) => l.trim().length > 0);
  if (nonEmpty < 0) return { title: '通用风格文章', body: '' };
  const firstLine = lines[nonEmpty];
  const hasMarkdownWrapper =
    /^\s*#{1,6}\s+/.test(firstLine) ||
    /^\s*\*{1,3}.*\*{1,3}\s*$/.test(firstLine) ||
    /^\s*【.*】\s*$/.test(firstLine) ||
    /^\s*「.*」\s*$/.test(firstLine) ||
    /^\s*“.*”\s*$/.test(firstLine);
  const looksLikeTitle =
    (hasMarkdownWrapper && firstLine.length <= 30) ||
    (firstLine.length <= 18 && lines.length > 1 && !/^(但是|所以|然后|接着|后来|最后|总之|其实|不过|而且|因为|如果|虽然|于是|终于|随后|当时|那天|那天早上|那天下午|那天晚上|一次|后来|后来|不过|只是|如今|现在)/.test(firstLine)) ||
    (firstLine.length <= 30 && !firstLine.includes('。') && !firstLine.includes('；') && lines.length > 1);
  if (looksLikeTitle) {
    const title = stripMarkdownTitle(firstLine);
    const body = lines.slice(nonEmpty + 1).join('\n').trim();
    return { title: title || '通用风格文章', body: body || trimmed };
  }
  return { title: '通用风格文章', body: trimmed };
}

// 把 Coze 输出的文本构造成统一的 GenerationResult
function buildCozeResult(outputText: string, body: unknown, type: GenerationType): { result: GenerationResult; meta: ApiRunMeta } {
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(outputText); } catch { parsed = {}; }
  // 兼容多种输出结构：1) 已解析 JSON 含 image_urls/text；2) JSON 含单数 image_url；3) output 本身是图片链接字符串；4) body 顶层 image_urls
  const pickImageUrls = (value: unknown): string[] | undefined => {
    if (!isRecord(value)) return undefined;
    if (Array.isArray(value.image_urls)) return (value.image_urls as unknown[]).filter((item): item is string => typeof item === 'string');
    if (typeof value.image_url === 'string' && /^https?:\/\//.test(value.image_url)) return [value.image_url];
    if (typeof value.url === 'string' && /^https?:\/\//.test(value.url)) return [value.url];
    if (Array.isArray(value.images)) return (value.images as unknown[]).filter((item): item is string => typeof item === 'string');
    return undefined;
  };
  let imageUrls = pickImageUrls(parsed) || (isRecord(body) ? pickImageUrls(body) : undefined);
  if (!imageUrls && /^https?:\/\//.test(outputText.trim())) imageUrls = [outputText.trim()];
  const result: GenerationResult = {
    title: (typeof parsed.title === 'string' && parsed.title) || `${type === 'article' ? '文章' : type === 'comic' ? '漫画' : '日记卡'}生成结果`,
    text: typeof parsed.text === 'string' ? parsed.text : (imageUrls ? undefined : outputText),
    imageUrls,
    metadata: { source: 'coze' },
    rawOutput: outputText,
  };
  return { result, meta: { source: 'coze' } };
}

export async function runApiSelfTest(config = loadApiConfig()) {
  const checks = [
    { name: 'LLM 对话连通性', run: () => chatWithRole({ id: 'memory-organizer', systemPrompt: '你是时光书助手，用一句话回应。', entryLabel: 'AI整理回忆', name: '测试', description: '', conversationGoal: '', outputFormat: '', downstream: '', enabled: true } as RoleConfig, [{ role: 'user', content: '你好，请回复：连通正常' }], config) },
    { name: 'LLM 整理回忆', run: () => prepareMemory([{ role: 'user', content: '孩子在公园第一次学会骑车' }], [], { systemPrompt: '把回忆整理成时间轴草稿。', outputFormat: '' } as RoleConfig, config) },
    { name: 'LLM 生成规格整理', run: () => prepareGeneration('article', [{ role: 'user', content: '写给孩子，温柔家书' }], '', [], { systemPrompt: '整理创作规格。', outputFormat: '文章' } as RoleConfig, config) },
    { name: 'Coze 文章工作流', run: async () => { const prepared = await prepareGeneration('article', [{ role: 'user', content: '写给孩子，温柔家书' }], '', [], { systemPrompt: '', outputFormat: '文章' } as RoleConfig, config); return runGeneration('article', prepared, config); } },
  ];
  const results: Array<{ name: string; ok: boolean; detail: string }> = [];
  for (const check of checks) {
    try { await check.run(); results.push({ name: check.name, ok: true, detail: 'passed' }); } catch (error) { results.push({ name: check.name, ok: false, detail: error instanceof Error ? error.message : String(error) }); }
  }
  return results;
}
