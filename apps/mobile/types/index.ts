/** Domain types for Kairos. Mock services today; NestJS API later. */

export type SourceType =
  | 'screenshot'
  | 'photo'
  | 'document'
  | 'note'
  | 'link'
  | 'audio'
  | 'conversation'
  | 'task';

export type ProcessingStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'EXTRACTING'
  | 'NORMALIZING'
  | 'CHUNKING'
  | 'ANALYZING'
  | 'EMBEDDING'
  | 'COMPLETED'
  | 'READY'
  | 'FAILED';

export type CaptureStage =
  | 'CAPTURED'
  | 'UPLOADING'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED';

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
};

export type Entity = {
  id: string;
  name: string;
  type: 'person' | 'place' | 'concept' | 'tool' | 'org';
};

export type Topic = {
  id: string;
  name: string;
  description: string;
  memoryCount: number;
  recentActivityAt: string;
  colorHint?: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  memoryCount: number;
  topicIds: string[];
  updatedAt: string;
  status: 'active' | 'paused' | 'archived';
};

export type Source = {
  id: string;
  type: SourceType;
  label: string;
  url?: string;
  previewText?: string;
};

export type Observation = {
  id: string;
  title: string;
  sourceType: SourceType;
  capturedAt: string;
  status: ProcessingStatus;
  previewText: string;
  extractedText?: string;
  summary?: string;
  linkedMemoryIds: string[];
  sourceLabel: string;
  topics?: { id: string; name: string }[];
  entities?: { id: string; name: string; type: string }[];
  projects?: { id: string; name: string }[];
  metadata?: {
    mimeType?: string;
    fileSizeBytes?: number;
    pageCount?: number | null;
    characterCount?: number | null;
    wordCount?: number | null;
    chunkCount?: number | null;
  };
  processingError?: string | null;
  analysisNote?: string | null;
};

export type Memory = {
  id: string;
  title: string;
  summary: string;
  capturedAt: string;
  createdAt: string;
  sourceType: SourceType;
  topicIds: string[];
  projectIds: string[];
  entityIds: string[];
  relatedMemoryIds: string[];
  observationIds: string[];
  favorite: boolean;
  relevance?: number;
};

export type MemoryDetail = Memory & {
  topics: Topic[];
  projects: Project[];
  entities: Entity[];
  relatedMemories: Memory[];
  observations: Observation[];
  source: Source;
};

export type TimelineGroup = {
  dateKey: string;
  label: string;
  memories: Memory[];
};

export type TimelinePage = {
  groups: TimelineGroup[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type SearchFilters = {
  topicId?: string;
  projectId?: string;
  sourceType?: SourceType;
  dateFrom?: string;
  dateTo?: string;
};

export type SearchResult = {
  memory: Memory;
  snippet: string;
  score: number;
  matchedTopics: string[];
};

export type SearchResponse = {
  query: string;
  results: SearchResult[];
  total: number;
  recentSearches: string[];
  suggestedSearches: string[];
};

export type AskSource = {
  observationId: string;
  chunkId: string;
  title: string;
  snippet: string;
  createdAt?: string;
  /** @deprecated use observationId — kept for older mock payloads */
  memoryId?: string;
};

export type AskMessage = {
  id: string;
  role: 'user' | 'kairos';
  content: string;
  createdAt: string;
  sources?: AskSource[];
  followUps?: string[];
  insufficientEvidence?: boolean;
};

export type AskResponse = {
  message: AskMessage;
};

export type ProcessingStep = {
  id: string;
  label: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
};

export type ProcessingJob = {
  id: string;
  observationId: string;
  title: string;
  sourceType: SourceType;
  stage: CaptureStage;
  steps: ProcessingStep[];
  startedAt: string;
  updatedAt: string;
  resultMemoryId?: string;
};

export type CaptureInput = {
  sourceType: SourceType;
  title?: string;
  text?: string;
  url?: string;
};

export type CaptureResult = {
  observation: Observation;
  job: ProcessingJob;
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href?: string;
};

export type Device = {
  id: string;
  name: string;
  platform: 'ios' | 'android' | 'web';
  isCurrent: boolean;
  lastSyncAt: string;
  captureEnabled: boolean;
  connectionStatus: 'connected' | 'idle' | 'offline';
};

export type AiSettings = {
  autoCapture: boolean;
  suggestRelated: boolean;
  allowBackgroundProcessing: boolean;
  retainRawObservations: boolean;
};

export type PrivacySettings = {
  storeScreenshots: boolean;
  storeAudioTranscripts: boolean;
  shareAnonymousTelemetry: boolean;
  retentionDays: number;
};

export type NotificationSettings = {
  memoryCreated: boolean;
  processingComplete: boolean;
  weeklyDigest: boolean;
};

export type AppSettings = {
  ai: AiSettings;
  privacy: PrivacySettings;
  notifications: NotificationSettings;
  appearance: 'system' | 'light' | 'dark';
};

export type HomeSummary = {
  greetingName: string;
  memoriesCreatedToday: number;
  recentMemories: Memory[];
  importantMemories: Memory[];
  recentActivity: AppNotification[];
  suggestedQuestions: string[];
  processingJobs: ProcessingJob[];
  topics: Topic[];
  projects: Project[];
};

export type TopicDetail = Topic & {
  memories: Memory[];
  relatedProjectIds: string[];
};

export type ProjectDetail = Project & {
  memories: Memory[];
  topics: Topic[];
  recentActivity: AppNotification[];
};

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };
