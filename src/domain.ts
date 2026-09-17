export type GenerationType = 'article' | 'comic' | 'diary-card';
export type DatePrecision = 'year' | 'month' | 'day' | 'range';

export type TimelineEntry = {
  id: string;
  datePrecision: DatePrecision;
  startDate: string;
  endDate?: string;
  title: string;
  content: string;
  imageDataUrls: string[];
  tags: string[];
  source: 'manual' | 'ai-organized';
  contentHash: string;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  processStatus: 'pending' | 'processing' | 'processed';
};

export type MemoryChatState = {
  messages: ChatMessage[];
};

export type GenerationResult = {
  title: string;
  text?: string;
  imageUrls?: string[];
  imageVariant?: string;
  metadata?: Record<string, unknown>;
  rawOutput?: string;
};

export type GenerationTask = {
  id: string;
  type: GenerationType;
  sourceEntryId?: string;
  messages: ChatMessage[];
  status: 'draft' | 'generating' | 'completed' | 'failed' | 'saved';
  result?: GenerationResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
  savedAt?: string;
};

export type AppState = {
  schemaVersion: 1;
  childName: string;
  timelineEntries: TimelineEntry[];
  memoryChat: MemoryChatState;
  generationTasks: GenerationTask[];
};
