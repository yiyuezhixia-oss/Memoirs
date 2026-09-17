import type { AppState, ChatSession, GenerationTask, TimelineEntry } from '../types';

const now = '2026-08-05T09:30:00+08:00';
const graduationImage = 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=900&q=80';
const bikeImage = 'https://images.unsplash.com/photo-1502744688674-c619d1586c9e?auto=format&fit=crop&w=900&q=80';
const thanksImage = 'https://images.unsplash.com/photo-1504159506876-f8338247a14a?auto=format&fit=crop&w=900&q=80';

export const seedEntries: TimelineEntry[] = [
  {
    id: 'entry-thanks',
    datePrecision: 'day',
    startDate: '2026-08-05',
    title: '第一次认真说谢谢',
    content: '吃完晚饭，他突然拿出画说：“谢谢妈妈每天陪我。”那一刻，心里暖暖的。',
    imageDataUrls: [thanksImage],
    tags: ['日常'],
    source: 'manual',
    contentHash: 'hash-thanks',
    relatedGenerationIds: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'entry-graduation',
    datePrecision: 'month',
    startDate: '2026-06',
    title: '毕业那天的拥抱',
    content: '他从人群里跑过来抱住我，我开心，也有一点舍不得。那一刻，我突然觉得他真的长大了。',
    imageDataUrls: [graduationImage],
    tags: ['毕业'],
    source: 'ai-organized',
    contentHash: 'hash-graduation',
    relatedGenerationIds: [],
    createdAt: '2026-06-28T09:30:00+08:00',
    updatedAt: '2026-06-28T09:30:00+08:00',
  },
  {
    id: 'entry-bike',
    datePrecision: 'day',
    startDate: '2026-05-20',
    title: '公园的泡泡时光',
    content: '我们一起在公园吹泡泡，他追着泡泡跑，笑得好大声。简单的小事，也是幸福。',
    imageDataUrls: [bikeImage],
    tags: ['日常'],
    source: 'manual',
    contentHash: 'hash-bike',
    relatedGenerationIds: [],
    createdAt: '2026-05-20T15:30:00+08:00',
    updatedAt: '2026-05-20T15:30:00+08:00',
  },
];

export const seedMemorySession: ChatSession = {
  id: 'memory-session',
  purpose: 'memory',
  messages: [
    { id: 'memory-ai-1', role: 'assistant', content: '这是孩子毕业那天，他跑过来抱了我一下。', imageDataUrls: [], createdAt: '2026-08-05T09:30:00+08:00', processStatus: 'pending' },
    { id: 'memory-user-1', role: 'user', content: '开心，也有一点舍不得，突然觉得他真的长大了。', imageDataUrls: [], createdAt: '2026-08-05T09:31:00+08:00', processStatus: 'pending' },
    { id: 'memory-ai-2', role: 'assistant', content: '他有没有说什么话，或者做了什么让你印象特别深的小动作？', imageDataUrls: [], createdAt: '2026-08-05T09:32:00+08:00', processStatus: 'pending' },
    { id: 'memory-user-2', role: 'user', content: '他什么都没说，就抱住我，在我耳边说“妈妈我爱你”。', imageDataUrls: [], createdAt: '2026-08-05T09:33:00+08:00', processStatus: 'pending' },
    { id: 'memory-ai-3', role: 'assistant', content: '太温暖了。还有当时的天气、背景或者其他小细节吗？这些都会让这段回忆更完整。', imageDataUrls: [], createdAt: '2026-08-05T09:34:00+08:00', processStatus: 'pending' },
  ],
  createdAt: now,
  updatedAt: now,
};

export const seedTasks: GenerationTask[] = [
  {
    id: 'task-draft-article', type: 'article', chatSessionId: 'article-seed', sourceEntryId: 'entry-graduation', status: 'draft',
    createdAt: '2026-08-04T14:30:00+08:00', updatedAt: '2026-08-04T14:30:00+08:00',
  },
  {
    id: 'task-draft-comic', type: 'comic', chatSessionId: 'comic-seed', sourceEntryId: 'entry-graduation', status: 'draft',
    createdAt: '2026-08-04T22:10:00+08:00', updatedAt: '2026-08-04T22:10:00+08:00',
  },
];

export const createInitialState = (): AppState => ({
  schemaVersion: 1,
  childProfile: { name: '安安', tagline: '把今天留给以后' },
  timelineEntries: seedEntries,
  chatSessions: [seedMemorySession],
  generationTasks: seedTasks,
});
