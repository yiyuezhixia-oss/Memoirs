import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { AppState, ChatMessage, GenerationResult, GenerationTask, GenerationType, TimelineEntry } from './domain';
import { prepareGeneration, runGeneration, loadApiConfig } from './services/api';
import { defaultRoles } from './data/roles';
import type { PreparedGeneration, RoleConfig, RoleId } from './types';

const ROLES_STORAGE_KEY = 'timebook-roles:v1';

// 读取后台管理页面保存的角色配置（与 appStore 同源）；无保存值时回退到默认角色
function loadRoleFromStorage(id: RoleId): RoleConfig {
  const fallback = defaultRoles.find((role) => role.id === id) ?? defaultRoles[0];
  try {
    const raw = localStorage.getItem(ROLES_STORAGE_KEY);
    if (!raw) return fallback;
    const stored = JSON.parse(raw) as RoleConfig[];
    return stored.find((role) => role.id === id) ?? fallback;
  } catch {
    return fallback;
  }
}

const STORAGE_KEY = 'timebook-demo:v1';
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

const seedState: AppState = {
  schemaVersion: 1,
  childName: '安安',
  timelineEntries: [
    {
      id: 'entry_thanks', datePrecision: 'day', startDate: '2026-08-05', title: '第一次认真说谢谢',
      content: '吃完晚饭，他突然拿出画好的小卡片，很认真地说：“谢谢妈妈每天陪我。”那一刻，心里暖暖的。',
      imageDataUrls: [], tags: ['日常', '第一次'], source: 'manual', contentHash: 'seed-thanks', createdAt: '2026-08-05T08:00:00+08:00',
    },
    {
      id: 'entry_graduation', datePrecision: 'month', startDate: '2026-06', title: '毕业那天的拥抱',
      content: '他从人群里跑过来抱住我，我开心，也有一点舍不得。那一刻，我突然觉得他真的长大了。',
      imageDataUrls: [], tags: ['毕业'], source: 'ai-organized', contentHash: 'seed-graduation', createdAt: '2026-06-30T08:00:00+08:00',
    },
    {
      id: 'entry-bike', datePrecision: 'day', startDate: '2026-05-20', title: '第一次骑自行车',
      content: '你小心翼翼地握着车把，我在后面扶着你。风吹过时，我们都在笑。',
      imageDataUrls: [], tags: ['第一次'], source: 'manual', contentHash: 'seed-bike', createdAt: '2026-05-20T08:00:00+08:00',
    },
  ],
  memoryChat: {
    messages: [
      { id: 'm0', role: 'assistant', content: '这是谁的哪一段回忆？可以先发一张照片，或者直接告诉我发生了什么。', createdAt: now(), processStatus: 'processed' },
    ],
  },
  generationTasks: [],
};

type Action =
  | { type: 'ADD_ENTRY'; entry: TimelineEntry }
  | { type: 'ADD_MEMORY_MESSAGE'; message: ChatMessage }
  | { type: 'PROCESS_MEMORY_MESSAGES'; entry: TimelineEntry }
  | { type: 'UPSERT_TASK'; task: GenerationTask }
  | { type: 'RESET' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_ENTRY': return { ...state, timelineEntries: [action.entry, ...state.timelineEntries] };
    case 'ADD_MEMORY_MESSAGE': return { ...state, memoryChat: { messages: [...state.memoryChat.messages, action.message] } };
    case 'PROCESS_MEMORY_MESSAGES': return {
      ...state,
      timelineEntries: [action.entry, ...state.timelineEntries],
      memoryChat: {
        messages: state.memoryChat.messages.map((message) => message.role === 'user' && message.processStatus === 'pending'
          ? { ...message, processStatus: 'processed' as const }
          : message),
      },
    };
    case 'UPSERT_TASK': {
      const exists = state.generationTasks.some((task) => task.id === action.task.id);
      return { ...state, generationTasks: exists
        ? state.generationTasks.map((task) => task.id === action.task.id ? action.task : task)
        : [action.task, ...state.generationTasks] };
    }
    case 'RESET': return seedState;
  }
}

type Store = {
  state: AppState;
  addEntry: (input: Omit<TimelineEntry, 'id' | 'createdAt' | 'contentHash'>) => void;
  addMemoryExchange: (content: string) => void;
  organizeMemory: (draft: { date: string; title: string; content: string }) => boolean;
  getOrCreateTask: (type: GenerationType, sourceEntryId?: string) => GenerationTask;
  addTaskExchange: (task: GenerationTask, content: string) => GenerationTask;
  updateTask: (task: GenerationTask) => void;
  generateTask: (task: GenerationTask) => Promise<GenerationTask>;
  saveTask: (task: GenerationTask) => GenerationTask;
};

const StoreContext = createContext<Store | null>(null);

const memoryPrompts = [
  '那一刻，你心里最强烈的感受是什么？',
  '孩子有没有说什么，或者做了什么小动作？',
  '还记得当时的天气、地点或其他小细节吗？',
];

const prompts: Record<GenerationType, string[]> = {
  article: ['这篇文章想写给谁看呢？', '你最想让他记住哪一句话？', '希望是温柔家书，还是故事散文的感觉？'],
  comic: ['这段回忆里，最想变成漫画的是哪一幕？', '画面里的人物是什么动作和表情？', '结尾最想留下哪个细节？'],
  'diary-card': ['这张卡片最想保留哪一句话？', '标题想温柔一点，还是纪念感强一点？', '还记得天气、地点或当时的心情吗？'],
};

const opening: Record<GenerationType, string> = {
  article: '我会先和你聊聊想写给谁、想表达什么，再帮你写成一篇文章。',
  comic: '我会和你聊聊想画哪一幕、动作和情绪，再生成亲子氛围漫画。',
  'diary-card': '我会和你确认主图、标题和短句，再把回忆做成日记卡。',
};

const results: Record<GenerationType, GenerationResult> = {
  article: {
    title: '写给毕业那天的你',
    text: '那天，阳光很好，人也很多。\n\n你穿着学士服，在人群里像一颗小小的星星，朝我跑来。然后，你突然抱住我，紧紧地抱住了我。\n\n那一刻，我的心里一下子被填得满满的。我开心，因为你真的长大了；我也有一点舍不得，因为我知道，你会飞得越来越远。\n\n未来的路还很长，可能会有风雨，也可能会有迷茫。但请记得：不管你走到哪里，妈妈都会在你身后，慢慢学着放手，也永远为你留一个温暖的拥抱。\n\n去大胆地追逐自己的梦想吧，孩子。妈妈爱你，永远爱你。',
  },
  comic: { title: '毕业那天的拥抱', imageVariant: 'comic' },
  'diary-card': { title: '第一次骑自行车', imageVariant: 'diary-card' },
};

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, seedState, (initial) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return initial;
      const parsed = JSON.parse(stored) as AppState;
      if (parsed.schemaVersion !== initial.schemaVersion) return initial;
      // 保留用户新增数据，同时补回种子演示数据，避免旧存储导致默认素材丢失
      const seedIds = new Set(initial.timelineEntries.map((entry) => entry.id));
      const storedIds = new Set(parsed.timelineEntries.map((entry) => entry.id));
      const mergedEntries = [
        ...parsed.timelineEntries.filter((entry) => !seedIds.has(entry.id)),
        ...initial.timelineEntries.filter((entry) => !storedIds.has(entry.id)),
      ];
      return { ...initial, ...parsed, timelineEntries: mergedEntries };
    } catch { return initial; }
  });

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);

  const store = useMemo<Store>(() => ({
    state,
    addEntry: (input) => dispatch({ type: 'ADD_ENTRY', entry: { ...input, id: id('entry'), createdAt: now(), contentHash: `${input.startDate}:${input.title}:${input.content}` } }),
    addMemoryExchange: (content) => {
      dispatch({ type: 'ADD_MEMORY_MESSAGE', message: { id: id('msg'), role: 'user', content, createdAt: now(), processStatus: 'pending' } });
      const pendingCount = state.memoryChat.messages.filter((message) => message.role === 'user').length;
      window.setTimeout(() => dispatch({ type: 'ADD_MEMORY_MESSAGE', message: { id: id('msg'), role: 'assistant', content: memoryPrompts[pendingCount % memoryPrompts.length], createdAt: now(), processStatus: 'processed' } }), 350);
    },
    organizeMemory: (draft) => {
      const hash = `${draft.date}:${draft.title}:${draft.content.replace(/\s/g, '')}`;
      if (state.timelineEntries.some((entry) => entry.contentHash === hash)) return false;
      dispatch({ type: 'PROCESS_MEMORY_MESSAGES', entry: { id: id('entry'), datePrecision: 'month', startDate: draft.date, title: draft.title, content: draft.content, imageDataUrls: [], tags: ['AI整理'], source: 'ai-organized', contentHash: hash, createdAt: now() } });
      return true;
    },
    getOrCreateTask: (type, sourceEntryId) => {
      const existing = state.generationTasks.find((task) => task.type === type && task.sourceEntryId === sourceEntryId && task.status !== 'saved');
      if (existing) return existing;
      return { id: id('gen'), type, sourceEntryId, status: 'draft', messages: [{ id: id('msg'), role: 'assistant', content: opening[type], createdAt: now(), processStatus: 'processed' }], createdAt: now(), updatedAt: now() };
    },
    addTaskExchange: (task, content) => {
      const userMessage: ChatMessage = { id: id('msg'), role: 'user', content, createdAt: now(), processStatus: 'processed' };
      const userCount = task.messages.filter((message) => message.role === 'user').length;
      const assistantMessage: ChatMessage = { id: id('msg'), role: 'assistant', content: prompts[task.type][userCount % prompts[task.type].length], createdAt: now(), processStatus: 'processed' };
      const updated = { ...task, status: 'draft' as const, messages: [...task.messages, userMessage, assistantMessage], updatedAt: now() };
      dispatch({ type: 'UPSERT_TASK', task: updated });
      return updated;
    },
    updateTask: (task) => dispatch({ type: 'UPSERT_TASK', task }),
    generateTask: async (task) => {
      const generating = { ...task, status: 'generating' as const, updatedAt: now() };
      dispatch({ type: 'UPSERT_TASK', task: generating });
      try {
        const sourceEntry = task.sourceEntryId ? state.timelineEntries.find((entry) => entry.id === task.sourceEntryId) : undefined;
        const sourceText = sourceEntry ? `${sourceEntry.title || ''}\n${sourceEntry.content || ''}` : '';
        const userMessages = task.messages.filter((message) => message.role === 'user');
        const roleId = task.type === 'article' ? 'article-writer' : task.type === 'comic' ? 'comic-director' : 'diary-card-designer';
        // 后台管理页面保存的角色配置以 localStorage('timebook-roles:v1') 为准，与 appStore 同源
        const role = loadRoleFromStorage(roleId);
        // 使用后台角色配置（含 systemPrompt）整理素材，使三个入口因角色不同返回不同语气与结构
        const prepared = await prepareGeneration(
          task.type,
          userMessages,
          sourceText,
          sourceEntry?.imageDataUrls ?? [],
          role,
          loadApiConfig(),
        );
        const { result } = await runGeneration(task.type, prepared, loadApiConfig(), role);
        const completed = { ...generating, status: 'completed' as const, result, updatedAt: now() };
        dispatch({ type: 'UPSERT_TASK', task: completed });
        return completed;
      } catch (error) {
        const failed = { ...generating, status: 'failed' as const, error: error instanceof Error ? error.message : String(error), updatedAt: now() };
        dispatch({ type: 'UPSERT_TASK', task: failed });
        return failed;
      }
    },
    saveTask: (task) => {
      const saved = { ...task, status: 'saved' as const, savedAt: now(), updatedAt: now() };
      dispatch({ type: 'UPSERT_TASK', task: saved });
      return saved;
    },
  }), [state]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useAppStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useAppStore must be used within AppStoreProvider');
  return store;
}
