export type DatePrecision = 'year' | 'month' | 'day' | 'range';
export type GenerationType = 'article' | 'comic' | 'diary-card';
export type ChatPurpose = 'memory' | GenerationType;
export type AppTab = 'timeline' | 'generate' | 'mine';

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
  sourceBatchId?: string;
  contentHash: string;
  relatedGenerationIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageDataUrls: string[];
  createdAt: string;
  processStatus: 'pending' | 'processing' | 'processed' | 'ignored';
  processedBatchId?: string;
};

export type ChatSession = {
  id: string;
  purpose: ChatPurpose;
  sourceEntryId?: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

export type ArticleStyle = '温柔家书' | '故事散文' | '成长手记' | '第三人称' | '书信体' | '通用';
export const articleStyles: ArticleStyle[] = ['温柔家书', '故事散文', '成长手记', '第三人称', '书信体', '通用'];

export type GenerationResult = {
  title: string;
  text?: string;
  imageUrls?: string[];
  metadata?: Record<string, string>;
  rawOutput?: string;
};

export type GenerationTask = {
  id: string;
  type: GenerationType;
  chatSessionId: string;
  sourceEntryId?: string;
  status: 'draft' | 'generating' | 'completed' | 'failed' | 'saved';
  style?: ArticleStyle;
  result?: GenerationResult;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  savedAt?: string;
};

export type ChildProfile = {
  name: string;
  tagline: string;
};

export type AppState = {
  schemaVersion: 1;
  childProfile: ChildProfile;
  timelineEntries: TimelineEntry[];
  chatSessions: ChatSession[];
  generationTasks: GenerationTask[];
};

export type MemoryDraft = {
  datePrecision: DatePrecision;
  startDate: string;
  title: string;
  content: string;
  imageDataUrls: string[];
};

export type RoleId = 'memory-organizer' | 'article-writer' | 'comic-director' | 'diary-card-designer';

export type RoleConfig = {
  id: RoleId;
  entryLabel: string;
  name: string;
  description: string;
  systemPrompt: string;
  conversationGoal: string;
  outputFormat: string;
  downstream: string;
  enabled: boolean;
  updatedAt: string;
};

export type ApiSource = 'mock' | 'llm' | 'coze';

export type ApiRunMeta = {
  source: ApiSource;
  requestId?: string;
  warning?: string;
};

export type PreparedGeneration = {
  type: GenerationType;
  prompt: string;
  outputInstruction: string;
  referenceImageUrls: string[];
  imageDataUrls: string[];
  style?: ArticleStyle;
  meta: ApiRunMeta;
};
