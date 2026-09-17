import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createInitialState } from './data/seed';
import { defaultRoles } from './data/roles';
import { loadApiConfig, prepareGeneration, runGeneration } from './services/api';
import type { AppState, ArticleStyle, ChatMessage, ChatSession, GenerationTask, GenerationType, RoleConfig, RoleId, TimelineEntry } from './types';

const STORAGE_KEY = 'timebook-demo:v1';
const ROLES_STORAGE_KEY = 'timebook-roles:v1';

function loadRoleFromStorage(id: RoleId): RoleConfig {
  const fallback = defaultRoles.find((role) => role.id === id) || defaultRoles[0];
  try {
    const raw = localStorage.getItem(ROLES_STORAGE_KEY);
    if (!raw) return fallback;
    const stored = JSON.parse(raw) as RoleConfig[];
    return stored.find((role) => role.id === id) || fallback;
  } catch {
    return fallback;
  }
}

const now = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as AppState;
  return candidate.schemaVersion === 1
    && Array.isArray(candidate.timelineEntries)
    && Array.isArray(candidate.chatSessions)
    && Array.isArray(candidate.generationTasks)
    && candidate.childProfile
    && typeof candidate.childProfile.name === 'string'
    && typeof candidate.childProfile.tagline === 'string';
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (isAppState(parsed)) return parsed;
    }
  } catch {
    // corrupted demo data falls back to the clean seed
  }
  return createInitialState();
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, '').toLowerCase();
}

function buildContentHash(entry: Pick<TimelineEntry, 'datePrecision' | 'startDate' | 'title' | 'content' | 'endDate'>) {
  return [entry.datePrecision, entry.startDate, entry.endDate || '', entry.title, entry.content]
    .map((part) => normalizeText(part.trim()))
    .join('::');
}

function sameTimelineSlot(left: TimelineEntry, right: Pick<TimelineEntry, 'datePrecision' | 'startDate' | 'endDate'>) {
  if (left.datePrecision !== right.datePrecision) return false;
  if (left.startDate !== right.startDate) return false;
  if (left.datePrecision === 'range') return (left.endDate || '') === (right.endDate || '');
  return true;
}

function mergeText(existing: string, next: string) {
  const oldText = existing.trim();
  const nextText = next.trim();
  if (!oldText) return nextText;
  if (!nextText) return oldText;
  if (nextText.includes(oldText)) return nextText;
  if (oldText.includes(nextText)) return oldText;
  return `${oldText}\n\n${nextText}`;
}

function mergeUniqueStrings(left: string[], right: string[]) {
  return Array.from(new Set([...left, ...right].filter(Boolean)));
}

function mergeTimelineEntry(existing: TimelineEntry, draft: Omit<TimelineEntry, 'id' | 'createdAt' | 'updatedAt' | 'contentHash' | 'relatedGenerationIds'>) {
  const merged: TimelineEntry = {
    ...existing,
    datePrecision: draft.datePrecision,
    startDate: draft.startDate,
    endDate: draft.endDate,
    title: draft.title.trim() || existing.title,
    content: mergeText(existing.content, draft.content),
    imageDataUrls: mergeUniqueStrings(existing.imageDataUrls, draft.imageDataUrls),
    tags: mergeUniqueStrings(existing.tags, draft.tags),
    source: draft.source === 'ai-organized' ? 'ai-organized' : existing.source,
    sourceBatchId: draft.sourceBatchId || existing.sourceBatchId,
    relatedGenerationIds: existing.relatedGenerationIds,
    contentHash: buildContentHash({
      datePrecision: draft.datePrecision,
      startDate: draft.startDate,
      endDate: draft.endDate,
      title: draft.title.trim() || existing.title,
      content: mergeText(existing.content, draft.content),
    }),
    updatedAt: now(),
  };
  return merged;
}

function createTimelineEntry(draft: Omit<TimelineEntry, 'id' | 'createdAt' | 'updatedAt' | 'contentHash' | 'relatedGenerationIds'>): TimelineEntry {
  const timestamp = now();
  return {
    ...draft,
    id: newId('entry'),
    createdAt: timestamp,
    updatedAt: timestamp,
    contentHash: buildContentHash(draft),
    relatedGenerationIds: [],
  };
}

function sameSlotContentHash(entry: TimelineEntry, draft: Omit<TimelineEntry, 'id' | 'createdAt' | 'updatedAt' | 'contentHash' | 'relatedGenerationIds'>) {
  return buildContentHash({
    datePrecision: draft.datePrecision,
    startDate: draft.startDate,
    endDate: draft.endDate,
    title: draft.title,
    content: draft.content,
  }) === entry.contentHash;
}

function openingPromptForPurpose(purpose: ChatSession['purpose']) {
  if (purpose === 'memory') {
    return '这是孩子的哪一段回忆？你可以先发一张照片，或者直接告诉我发生了什么。';
  }
  if (purpose === 'article') {
    return '我会先和你聊聊想写给谁、想表达什么，再帮你写成一篇文章。';
  }
  if (purpose === 'comic') {
    return '我会和你聊聊想画哪一幕、动作和情绪，再生成亲子氛围漫画。';
  }
  return '我会和你确认主图、标题和短句，再把回忆做成日记卡。';
}

type AppStoreValue = {
  state: AppState;
  roles: RoleConfig[];
  updateRole: (id: RoleId, patch: Partial<Pick<RoleConfig, 'name' | 'description' | 'systemPrompt' | 'conversationGoal' | 'outputFormat' | 'downstream' | 'enabled'>>) => void;
  resetRole: (id: RoleId) => void;
  upsertTimelineEntry: (entry: Omit<TimelineEntry, 'id' | 'createdAt' | 'updatedAt' | 'contentHash' | 'relatedGenerationIds'>) => TimelineEntry;
  addTimelineEntry: (entry: Omit<TimelineEntry, 'id' | 'createdAt' | 'updatedAt' | 'contentHash' | 'relatedGenerationIds'>) => TimelineEntry;
  updateTimelineEntry: (id: string, patch: Partial<Pick<TimelineEntry, 'title' | 'content' | 'startDate' | 'imageDataUrls' | 'tags'>>) => void;
  getOrCreateSession: (purpose: ChatSession['purpose'], sourceEntryId?: string) => ChatSession;
  createSession: (purpose: ChatSession['purpose'], sourceEntryId?: string) => ChatSession;
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id' | 'createdAt' | 'processStatus'>) => ChatMessage;
  appendAssistant: (sessionId: string, content: string) => ChatMessage | null;
  organizeSession: (sessionId: string, draft: Omit<TimelineEntry, 'id' | 'createdAt' | 'updatedAt' | 'contentHash' | 'relatedGenerationIds'>) => boolean;
  createTask: (type: GenerationType, chatSessionId: string, sourceEntryId?: string, style?: ArticleStyle) => GenerationTask;
  updateTask: (id: string, patch: Partial<GenerationTask>) => void;
  saveTask: (id: string) => void;
  generateTask: (task: GenerationTask) => Promise<void>;
};

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  // 用 ref 持有最新 state，让 store 的 value 引用保持稳定（避免下游 useEffect 因 store 引用变化而循环创建 session）
  const stateRef = useRef<AppState>(state);
  stateRef.current = state;
  const [roles, setRoles] = useState<RoleConfig[]>(() => {
    try {
      const raw = localStorage.getItem('timebook-roles:v1');
      if (raw) {
        const stored = JSON.parse(raw) as RoleConfig[];
        return defaultRoles.map((role) => stored.find((item) => item.id === role.id) || role);
      }
    } catch {
      // invalid role data uses defaults
    }
    return defaultRoles;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      console.warn('[store] 本地存储超出容量，本段回忆仅本次会话可见');
    }
  }, [state]);
  useEffect(() => {
    try {
      localStorage.setItem('timebook-roles:v1', JSON.stringify(roles));
    } catch {
      console.warn('[store] 角色配置本地存储失败');
    }
  }, [roles]);

  const value = useMemo<AppStoreValue>(() => ({
    state,
    roles,
    updateRole: (id, patch) => setRoles((current) => current.map((role) => role.id === id ? { ...role, ...patch, updatedAt: now() } : role)),
    resetRole: (id) => setRoles((current) => current.map((role) => role.id === id ? defaultRoles.find((item) => item.id === id)! : role)),
    upsertTimelineEntry: (draft): TimelineEntry => {
      let resolved: TimelineEntry | null = null;
      setState((current) => {
        const existing = current.timelineEntries.find((entry) => sameTimelineSlot(entry, draft));
        if (existing && sameSlotContentHash(existing, draft)) {
          resolved = existing;
          return current;
        }

        if (existing) {
          const merged = mergeTimelineEntry(existing, draft);
          resolved = merged;
          return {
            ...current,
            timelineEntries: current.timelineEntries.map((entry) => entry.id === existing.id ? merged : entry),
          };
        }

        const created = createTimelineEntry(draft);
        resolved = created;
        return {
          ...current,
          timelineEntries: [created, ...current.timelineEntries],
        };
      });
      if (!resolved) throw new Error('Failed to upsert timeline entry');
      return resolved;
    },
    addTimelineEntry: (draft): TimelineEntry => {
      const created = createTimelineEntry(draft);
      setState((current) => ({
        ...current,
        timelineEntries: [created, ...current.timelineEntries],
      }));
      return created;
    },
    updateTimelineEntry: (id, patch) => setState((current) => {
      const entry = current.timelineEntries.find((item) => item.id === id);
      if (!entry) return current;
      const updated: TimelineEntry = {
        ...entry,
        ...patch,
        updatedAt: now(),
        contentHash: buildContentHash({
          datePrecision: entry.datePrecision,
          startDate: patch.startDate ?? entry.startDate,
          endDate: entry.endDate,
          title: patch.title ?? entry.title,
          content: patch.content ?? entry.content,
        }),
      };
      return {
        ...current,
        timelineEntries: current.timelineEntries.map((item) => item.id === id ? updated : item),
      };
    }),
    getOrCreateSession: (purpose, sourceEntryId) => {
      const existing = stateRef.current.chatSessions.find((session) => session.purpose === purpose && session.sourceEntryId === sourceEntryId);
      if (existing) return existing;

      const timestamp = now();
      const session: ChatSession = {
        id: newId('session'),
        purpose,
        sourceEntryId,
        messages: [{
          id: newId('message'),
          role: 'assistant',
          content: openingPromptForPurpose(purpose),
          imageDataUrls: [],
          createdAt: timestamp,
          processStatus: 'processed',
        }],
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      setState((current) => ({
        ...current,
        chatSessions: [...current.chatSessions, session],
      }));
      return session;
    },
    createSession: (purpose, sourceEntryId) => {
      const timestamp = now();
      const session: ChatSession = {
        id: newId('session'),
        purpose,
        sourceEntryId,
        messages: [{
          id: newId('message'),
          role: 'assistant',
          content: openingPromptForPurpose(purpose),
          imageDataUrls: [],
          createdAt: timestamp,
          processStatus: 'processed',
        }],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      setState((current) => ({
        ...current,
        chatSessions: [...current.chatSessions, session],
      }));
      return session;
    },
    addMessage: (sessionId, message) => {
      const created: ChatMessage = {
        ...message,
        id: newId('message'),
        createdAt: now(),
        processStatus: 'pending',
      };

      setState((current) => ({
        ...current,
        chatSessions: current.chatSessions.map((session) => session.id === sessionId
          ? { ...session, updatedAt: created.createdAt, messages: [...session.messages, created] }
          : session),
      }));

      return created;
    },
    appendAssistant: (sessionId, content) => {
      const created: ChatMessage = {
        id: newId('message'),
        role: 'assistant',
        content,
        imageDataUrls: [],
        createdAt: now(),
        processStatus: 'processed',
      };

      let inserted: ChatMessage | null = created;
      setState((current) => ({
        ...current,
        chatSessions: current.chatSessions.map((session) => session.id === sessionId
          ? { ...session, updatedAt: created.createdAt, messages: [...session.messages, created] }
          : session),
      }));

      return inserted;
    },
    organizeSession: (sessionId, draft) => {
      let updated = false;
      const batchId = newId('batch');

      setState((current) => {
        const session = current.chatSessions.find((item) => item.id === sessionId);
        if (!session) return current;

        const hasPending = session.messages.some((message) => message.role === 'user' && message.processStatus === 'pending');
        if (!hasPending) return current;

        const existing = current.timelineEntries.find((entry) => sameTimelineSlot(entry, draft));
        const exactDuplicate = Boolean(existing && sameSlotContentHash(existing, draft));

        const nextTimelineEntries = exactDuplicate
          ? current.timelineEntries
          : existing
            ? current.timelineEntries.map((entry) => entry.id === existing.id ? mergeTimelineEntry(existing, draft) : entry)
            : [createTimelineEntry(draft), ...current.timelineEntries];

        updated = !exactDuplicate;

        return {
          ...current,
          timelineEntries: nextTimelineEntries,
          chatSessions: current.chatSessions.map((item) => item.id === sessionId ? {
            ...item,
            updatedAt: now(),
            messages: item.messages.map((message) => message.role === 'user' && message.processStatus === 'pending'
              ? { ...message, processStatus: 'processed', processedBatchId: batchId }
              : message),
          } : item),
        };
      });

      return updated;
    },
    createTask: (type, chatSessionId, sourceEntryId, style) => {
      const existing = stateRef.current.generationTasks.find((task) => task.type === type && task.chatSessionId === chatSessionId && task.sourceEntryId === sourceEntryId && task.status !== 'saved');
      if (existing) return existing;

      const timestamp = now();
      const task: GenerationTask = {
        id: newId('task'),
        type,
        chatSessionId,
        sourceEntryId,
        style,
        status: 'draft',
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      setState((current) => ({
        ...current,
        generationTasks: [task, ...current.generationTasks],
      }));

      return task;
    },
    updateTask: (id, patch) => setState((current) => ({
      ...current,
      generationTasks: current.generationTasks.map((task) => task.id === id ? { ...task, ...patch, updatedAt: now() } : task),
    })),
    saveTask: (id) => setState((current) => {
      const task = current.generationTasks.find((item) => item.id === id);
      if (!task) return current;

      const savedAt = now();
      const nextTasks = current.generationTasks.map((item) => item.id === id
        ? { ...item, status: 'saved' as const, savedAt, updatedAt: savedAt }
        : item);

      if (!task.sourceEntryId) {
        return {
          ...current,
          generationTasks: nextTasks,
        };
      }

      return {
        ...current,
        generationTasks: nextTasks,
        timelineEntries: current.timelineEntries.map((entry) => entry.id === task.sourceEntryId
          ? { ...entry, relatedGenerationIds: mergeUniqueStrings(entry.relatedGenerationIds, [task.id]), updatedAt: savedAt }
          : entry),
      };
    }),
    generateTask: async (task) => {
      const current = stateRef.current;
      const sourceEntry = task.sourceEntryId
        ? current.timelineEntries.find((entry) => entry.id === task.sourceEntryId)
        : undefined;
      const session = current.chatSessions.find((item) => item.id === task.chatSessionId);
      const userMessages = (session?.messages ?? []).filter((message) => message.role === 'user');
      const roleId: RoleId = task.type === 'diary-card'
        ? 'diary-card-designer'
        : task.type === 'comic'
          ? 'comic-director'
          : 'article-writer';
      const role = loadRoleFromStorage(roleId);
      const config = loadApiConfig();

      setState((current) => ({
        ...current,
        generationTasks: current.generationTasks.map((item) => item.id === task.id ? { ...item, status: 'generating', updatedAt: now() } : item),
      }));
      try {
        const prepared = await prepareGeneration(task.type, userMessages, sourceEntry?.content ?? '', sourceEntry?.imageDataUrls ?? [], role, config, task.style);
        const { result } = await runGeneration(task.type, prepared, config, role);
        setState((current) => ({
          ...current,
          generationTasks: current.generationTasks.map((item) => item.id === task.id ? { ...item, status: 'completed', result, updatedAt: now() } : item),
        }));
      } catch (error) {
        setState((current) => ({
          ...current,
          generationTasks: current.generationTasks.map((item) => item.id === task.id ? { ...item, status: 'failed', errorMessage: error instanceof Error ? error.message : '生成失败', updatedAt: now() } : item),
        }));
      }
    },
  }), []);

  // value 引用保持稳定（避免下游 useEffect 因 store 引用变化而循环），
  // 但每次渲染都把最新的 state 同步到 value.state，确保 store.state.* 读到当前值。
  value.state = stateRef.current;

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const value = useContext(AppStoreContext);
  if (!value) throw new Error('useAppStore must be used inside AppStoreProvider');
  return value;
}
