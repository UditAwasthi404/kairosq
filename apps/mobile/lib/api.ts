import { apiBaseUrl } from './config';
import { noteMutation } from './freshness';
import {
  getNetworkState,
  reportNetworkFailure,
  reportNetworkSlow,
  reportNetworkSuccess,
} from './network';

export type AuthMeResponse = {
  id: string;
  authenticated: true;
};

export type CaptureSource =
  | 'MANUAL'
  | 'KEYBOARD'
  | 'SHARE'
  | 'QUICK_CAPTURE'
  | 'VOICE'
  | 'WIDGET'
  | 'RECALL';

export type ApiObservationStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'EXTRACTING'
  | 'NORMALIZING'
  | 'CHUNKING'
  | 'ANALYZING'
  | 'EMBEDDING'
  | 'COMPLETED'
  | 'FAILED';

export type ApiObservationTopic = {
  id: string;
  name: string;
  confidence: number | null;
};

export type ApiObservationEntity = {
  id: string;
  name: string;
  type:
    | 'PERSON'
    | 'ORGANIZATION'
    | 'TECHNOLOGY'
    | 'PRODUCT'
    | 'LOCATION'
    | 'CONCEPT';
  confidence: number | null;
};

export type ApiObservationProject = {
  id: string;
  name: string;
};

export type ApiObservationMetadata = {
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  pageCount: number | null;
  characterCount: number | null;
  wordCount: number | null;
  chunkCount: number | null;
};

export type ApiObservation = {
  id: string;
  filename: string;
  mimeType: string;
  type: 'DOCUMENT' | 'PDF' | 'IMAGE' | 'TEXT' | 'AUDIO';
  source?: CaptureSource;
  sourceLabel?: string;
  status: ApiObservationStatus;
  /** Present on newer backends; derived client-side when absent. */
  stageLabel?: string;
  createdAt: string;
  updatedAt: string;
  capturedAt: string;
  processedAt?: string | null;
  extractedText: string | null;
  summary: string | null;
  processingError: string | null;
  sourceMetadata: Record<string, unknown> | null;
  metadata: ApiObservationMetadata;
  topics: ApiObservationTopic[];
  entities: ApiObservationEntity[];
  projects: ApiObservationProject[];
  chunkCount: number;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

const READ_TIMEOUT_MS = 15_000;
const READ_TIMEOUT_OFFLINE_MS = 6_000;
/** Ask and search wait on model calls server-side. */
const WRITE_TIMEOUT_MS = 90_000;
const UPLOAD_TIMEOUT_MS = 180_000;

function requestTimeoutMs(init?: RequestInit): number {
  if (typeof FormData !== 'undefined' && init?.body instanceof FormData) {
    return UPLOAD_TIMEOUT_MS;
  }
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method !== 'GET') return WRITE_TIMEOUT_MS;
  return getNetworkState().online ? READ_TIMEOUT_MS : READ_TIMEOUT_OFFLINE_MS;
}

/**
 * Authenticated API GETs must not be HTTP-cached (OkHttp 304 revalidation);
 * screens cache on-device through `useAsync` instead.
 * Transport failures surface as `ApiError` status 0 so callers can queue/retry.
 */
async function apiFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  headers.set('Cache-Control', 'no-cache');
  headers.set('Pragma', 'no-cache');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs(init));
  try {
    const response = await fetch(input, {
      ...init,
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });
    reportNetworkSuccess();
    const method = (init?.method ?? 'GET').toUpperCase();
    if (response.ok && method !== 'GET' && !/\/search$/.test(input)) noteMutation();
    return response;
  } catch {
    if (controller.signal.aborted) {
      reportNetworkSlow();
      throw new ApiError('Kairos is taking too long to respond.', 0, 'TIMEOUT');
    }
    reportNetworkFailure();
    throw new ApiError('No connection to Kairos.', 0, 'NETWORK');
  } finally {
    clearTimeout(timer);
  }
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as {
      error?: { code?: string; message?: string };
      message?: string;
    };
    const message =
      body.error?.message ||
      body.message ||
      `Request failed with status ${response.status}`;
    return new ApiError(message, response.status, body.error?.code);
  } catch {
    return new ApiError(
      `Request failed with status ${response.status}`,
      response.status,
    );
  }
}

export async function fetchAuthMe(token: string): Promise<AuthMeResponse> {
  const response = await apiFetch(`${normalizeBaseUrl(apiBaseUrl)}/auth/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (response.status === 401) {
    throw new ApiError('Unauthorized', 401);
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  return (await response.json()) as AuthMeResponse;
}

export async function uploadObservation(params: {
  token: string;
  uri: string;
  name: string;
  mimeType: string;
}): Promise<ApiObservation> {
  const form = new FormData();
  form.append('file', {
    uri: params.uri,
    name: params.name,
    type: params.mimeType,
  } as unknown as Blob);

  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/observations/upload`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: 'application/json',
      },
      body: form,
    },
  );

  if (!response.ok) {
    throw await parseError(response);
  }

  const body = (await response.json()) as { data: ApiObservation };
  return body.data;
}

/** Upload a plain-text note/link as a .txt observation via the existing upload API. */
export async function uploadTextObservation(params: {
  token: string;
  text: string;
  filename?: string;
}): Promise<ApiObservation> {
  const FileSystem = await import('expo-file-system/legacy');
  const name = params.filename || `note-${Date.now()}.txt`;
  const base = FileSystem.cacheDirectory;
  if (!base) {
    throw new ApiError('Local file cache is unavailable on this device.', 500);
  }
  const uri = `${base}${name}`;
  await FileSystem.writeAsStringAsync(uri, params.text, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  try {
    return await uploadObservation({
      token: params.token,
      uri,
      name,
      mimeType: 'text/plain',
    });
  } finally {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
  }
}

export type CapturePayload = {
  clientCaptureId?: string;
  content?: string;
  source: CaptureSource;
  capturedAt?: string;
  url?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  projectId?: string;
};

export async function createCapture(
  token: string,
  payload: CapturePayload,
): Promise<ApiObservation> {
  const response = await apiFetch(`${normalizeBaseUrl(apiBaseUrl)}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clientCaptureId: payload.clientCaptureId,
      content: payload.content,
      source: payload.source,
      capturedAt: payload.capturedAt,
      url: payload.url,
      title: payload.title,
      metadata: payload.metadata,
      projectId: payload.projectId,
    }),
  });
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: ApiObservation };
  return body.data;
}

export async function uploadCapture(params: {
  token: string;
  clientCaptureId?: string;
  uri: string;
  name: string;
  mimeType: string;
  source: CaptureSource;
  title?: string;
  url?: string;
  capturedAt?: string;
  metadata?: Record<string, unknown>;
}): Promise<ApiObservation> {
  const form = new FormData();
  form.append('file', {
    uri: params.uri,
    name: params.name,
    type: params.mimeType,
  } as unknown as Blob);
  form.append('source', params.source);
  if (params.clientCaptureId) form.append('clientCaptureId', params.clientCaptureId);
  if (params.title) form.append('title', params.title);
  if (params.url) form.append('url', params.url);
  if (params.capturedAt) form.append('capturedAt', params.capturedAt);
  if (params.metadata) form.append('metadata', JSON.stringify(params.metadata));

  const response = await apiFetch(`${normalizeBaseUrl(apiBaseUrl)}/capture/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.token}`,
      Accept: 'application/json',
    },
    body: form,
  });
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: ApiObservation };
  return body.data;
}

export type KnowledgeMaturity = 'single' | 'repeated' | 'pattern' | 'stable';

export type InsightEvidence = {
  observationId: string;
  filename: string;
  snippet: string;
  capturedAt: string;
  sourceLabel: string;
  topicName?: string;
};

export type TodayInsight = {
  title: string;
  body: string;
  generatedAt: string;
  observationCount: number;
  empty: boolean;
  evidence: InsightEvidence[];
  why: string;
  maturity: KnowledgeMaturity;
};

export type DashboardActivityDay = {
  date: string;
  label: string;
  count: number;
};

export type DashboardHeatmapDay = DashboardActivityDay & {
  future: boolean;
};

export type DashboardHabitDay = {
  date: string;
  label: string;
  done: boolean;
  count: number;
};

export type DashboardStreak = {
  current: number;
  longest: number;
  capturedToday: boolean;
};

export type DashboardHabit = {
  dailyGoal: number;
  todayProgress: number;
  weekGoalDays: number;
  weekDaysCompleted: number;
  week: DashboardHabitDay[];
};

export type DashboardSummary = {
  greeting: string;
  daySummary: string;
  todayCount: number;
  weekCount: number;
  todayTopicCount: number;
  todayProjectCount: number;
  processingCount: number;
  completedCount: number;
  totalCount: number;
  insight: TodayInsight;
  sources: Array<{ source: CaptureSource; label: string; count: number }>;
  topics: Array<{ id: string; name: string; observationCount: number }>;
  activity: DashboardActivityDay[];
  heatmap: DashboardHeatmapDay[];
  streak: DashboardStreak;
  habit: DashboardHabit;
  recent: Array<{
    id: string;
    filename: string;
    source: CaptureSource;
    sourceLabel: string;
    capturedAt: string;
    summary: string | null;
    status: ApiObservationStatus;
  }>;
};

export type PredictionItem = {
  kind: 'revisit' | 'focus' | 'emerging' | 'next';
  title: string;
  body: string;
  why: string;
  topicId?: string;
  observationId?: string;
  mentionCount?: number;
  dayCount?: number;
  maturity: KnowledgeMaturity;
  evidence: InsightEvidence[];
};

export type PredictionsSummary = {
  generatedAt: string;
  empty: boolean;
  items: PredictionItem[];
};

export type DailyBrief = {
  title: string;
  generatedAt: string;
  empty: boolean;
  yesterdayCount: number;
  weekCount: number;
  attentionTopics: Array<{ id: string; name: string; observationCount: number }>;
  noticed: TodayInsight;
  revisit: PredictionItem | null;
};

export type RelatedMemoryItem = {
  observationId: string;
  filename: string;
  snippet: string;
  capturedAt: string;
  sourceLabel: string;
  score: number;
  reasons: Array<
    'similar' | 'shared_topic' | 'shared_entity' | 'shared_project' | 'nearby_in_time'
  >;
};

export async function fetchDashboard(token: string): Promise<DashboardSummary> {
  const response = await apiFetch(`${normalizeBaseUrl(apiBaseUrl)}/insights/dashboard`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: DashboardSummary };
  return normalizeDashboard(body.data);
}

function normalizeDashboard(data: DashboardSummary): DashboardSummary {
  const emptyWeek = Array.from({ length: 7 }, (_, index) => ({
    date: '',
    label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][index] ?? '',
    done: false,
    count: 0,
  }));
  return {
    ...data,
    activity: data.activity ?? [],
    heatmap: data.heatmap ?? [],
    streak: data.streak ?? {
      current: 0,
      longest: 0,
      capturedToday: data.todayCount > 0,
    },
    habit: data.habit ?? {
      dailyGoal: 1,
      todayProgress: data.todayCount ?? 0,
      weekGoalDays: 5,
      weekDaysCompleted: 0,
      week: emptyWeek,
    },
  };
}

export async function fetchPredictions(token: string): Promise<PredictionsSummary> {
  const response = await apiFetch(`${normalizeBaseUrl(apiBaseUrl)}/insights/predictions`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: PredictionsSummary };
  return body.data;
}

export async function fetchDailyBrief(token: string): Promise<DailyBrief> {
  const response = await apiFetch(`${normalizeBaseUrl(apiBaseUrl)}/insights/brief`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: DailyBrief };
  return body.data;
}

export async function fetchRelatedMemories(
  token: string,
  observationId: string,
): Promise<RelatedMemoryItem[]> {
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/observations/${encodeURIComponent(observationId)}/related`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: RelatedMemoryItem[] };
  return body.data;
}

export async function fetchTodayInsight(token: string): Promise<TodayInsight> {
  const response = await apiFetch(`${normalizeBaseUrl(apiBaseUrl)}/insights/today`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: TodayInsight };
  return body.data;
}

export async function createNoteObservation(params: {
  token: string;
  text: string;
  title?: string;
}): Promise<ApiObservation> {
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/observations/from-text`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: params.text,
        title: params.title,
        source: 'MANUAL',
      }),
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: ApiObservation };
  return body.data;
}

export async function createUrlObservation(params: {
  token: string;
  url: string;
}): Promise<ApiObservation> {
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/observations/from-url`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: params.url, source: 'MANUAL' }),
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: ApiObservation };
  return body.data;
}

export async function deleteObservation(
  token: string,
  id: string,
): Promise<void> {
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/observations/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok && response.status !== 204) {
    throw await parseError(response);
  }
}

export type DevicePlatform = 'ANDROID' | 'IOS';

export async function registerDevicePushToken(params: {
  token: string;
  expoPushToken: string;
  platform: DevicePlatform;
}): Promise<{ id: string; platform: DevicePlatform }> {
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/devices/push-token`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: params.expoPushToken,
        platform: params.platform,
      }),
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as {
    data: { id: string; platform: DevicePlatform };
  };
  return body.data;
}

export async function unregisterDevicePushToken(params: {
  token: string;
  expoPushToken: string;
}): Promise<{ removed: boolean }> {
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/devices/push-token`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: params.expoPushToken }),
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: { removed: boolean } };
  return body.data;
}

export async function deleteMyData(token: string): Promise<{
  deletedObservations: number;
}> {
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/users/me/data`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as {
    data: { deletedObservations: number };
  };
  return body.data;
}

export async function fetchObservation(
  token: string,
  id: string,
): Promise<ApiObservation> {
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/observations/${encodeURIComponent(id)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw await parseError(response);
  }

  const body = (await response.json()) as { data: ApiObservation };
  return body.data;
}

export async function fetchObservationsPage(
  token: string,
  filters?: {
    topicId?: string;
    entityId?: string;
    projectId?: string;
    topic?: string;
    entity?: string;
    source?: CaptureSource;
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string;
  },
): Promise<{ items: ApiObservation[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  if (filters?.topicId) qs.set('topicId', filters.topicId);
  if (filters?.entityId) qs.set('entityId', filters.entityId);
  if (filters?.projectId) qs.set('projectId', filters.projectId);
  if (filters?.topic) qs.set('topic', filters.topic);
  if (filters?.entity) qs.set('entity', filters.entity);
  if (filters?.source) qs.set('source', filters.source);
  if (filters?.from) qs.set('from', filters.from);
  if (filters?.to) qs.set('to', filters.to);
  if (filters?.limit) qs.set('limit', String(filters.limit));
  if (filters?.cursor) qs.set('cursor', filters.cursor);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/observations${suffix}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw await parseError(response);
  }

  const body = (await response.json()) as {
    data: ApiObservation[];
    nextCursor?: string | null;
  };
  return { items: body.data, nextCursor: body.nextCursor ?? null };
}

export async function fetchObservations(
  token: string,
  filters?: {
    topicId?: string;
    entityId?: string;
    projectId?: string;
    topic?: string;
    entity?: string;
    source?: CaptureSource;
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string;
  },
): Promise<ApiObservation[]> {
  const page = await fetchObservationsPage(token, filters);
  return page.items;
}

export function observationFileUri(id: string): string {
  return `${normalizeBaseUrl(apiBaseUrl)}/observations/${encodeURIComponent(id)}/file`;
}

export async function updateObservation(
  token: string,
  id: string,
  patch: { title?: string; content?: string },
): Promise<ApiObservation> {
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/observations/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patch),
    },
  );
  if (!response.ok) {
    throw await parseError(response);
  }
  const body = (await response.json()) as { data: ApiObservation };
  return body.data;
}

export async function reprocessObservation(
  token: string,
  id: string,
): Promise<ApiObservation> {
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/observations/${encodeURIComponent(id)}/reprocess`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw await parseError(response);
  }

  const body = (await response.json()) as { data: ApiObservation };
  return body.data;
}

export type ApiTopicSummary = {
  id: string;
  name: string;
  observationCount: number;
  updatedAt: string;
};

export type ApiEntitySummary = {
  id: string;
  name: string;
  type:
    | 'PERSON'
    | 'ORGANIZATION'
    | 'TECHNOLOGY'
    | 'PRODUCT'
    | 'LOCATION'
    | 'CONCEPT';
  observationCount: number;
  updatedAt: string;
};

export type ApiTopicDetail = ApiTopicSummary & {
  observations: ApiObservation[];
};

export type ApiEntityDetail = ApiEntitySummary & {
  observations: ApiObservation[];
};

export type ApiProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  observationCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ApiProjectDetail = ApiProjectSummary & {
  observations: ApiObservation[];
  nextCursor: string | null;
};

export async function fetchTopics(params: {
  token: string;
  limit?: number;
  cursor?: string;
}): Promise<{ items: ApiTopicSummary[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.cursor) qs.set('cursor', params.cursor);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/topics${suffix}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as {
    data: { items: ApiTopicSummary[]; nextCursor: string | null };
  };
  return body.data;
}

export async function fetchTopic(params: {
  token: string;
  id: string;
}): Promise<ApiTopicDetail> {
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/topics/${encodeURIComponent(params.id)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: ApiTopicDetail };
  return body.data;
}

export async function fetchEntities(params: {
  token: string;
  limit?: number;
  cursor?: string;
  type?: string;
}): Promise<{ items: ApiEntitySummary[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.type) qs.set('type', params.type);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/entities${suffix}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as {
    data: { items: ApiEntitySummary[]; nextCursor: string | null };
  };
  return body.data;
}

export async function fetchEntity(params: {
  token: string;
  id: string;
}): Promise<ApiEntityDetail> {
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/entities/${encodeURIComponent(params.id)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: ApiEntityDetail };
  return body.data;
}

export async function fetchProjects(params: {
  token: string;
  limit?: number;
  cursor?: string;
}): Promise<{ items: ApiProjectSummary[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.cursor) qs.set('cursor', params.cursor);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/projects${suffix}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as {
    data: { items: ApiProjectSummary[]; nextCursor: string | null };
  };
  return body.data;
}

export async function fetchProject(params: {
  token: string;
  id: string;
  limit?: number;
  cursor?: string;
}): Promise<ApiProjectDetail> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.cursor) qs.set('cursor', params.cursor);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/projects/${encodeURIComponent(params.id)}${suffix}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: ApiProjectDetail };
  return body.data;
}

export async function createProject(params: {
  token: string;
  name: string;
  description?: string | null;
}): Promise<ApiProjectSummary> {
  const response = await apiFetch(`${normalizeBaseUrl(apiBaseUrl)}/projects`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: params.name,
      description: params.description ?? null,
    }),
  });
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: ApiProjectSummary };
  return body.data;
}

export async function updateProject(params: {
  token: string;
  id: string;
  name?: string;
  description?: string | null;
}): Promise<ApiProjectSummary> {
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/projects/${encodeURIComponent(params.id)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: params.name,
        description: params.description,
      }),
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: ApiProjectSummary };
  return body.data;
}

export async function deleteProject(params: {
  token: string;
  id: string;
}): Promise<void> {
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/projects/${encodeURIComponent(params.id)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok && response.status !== 204) {
    throw await parseError(response);
  }
}

export async function addObservationToProject(params: {
  token: string;
  projectId: string;
  observationId: string;
}): Promise<{ projectId: string; observationId: string; created: boolean }> {
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/projects/${encodeURIComponent(params.projectId)}/observations`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ observationId: params.observationId }),
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as {
    data: { projectId: string; observationId: string; created: boolean };
  };
  return body.data;
}

export async function removeObservationFromProject(params: {
  token: string;
  projectId: string;
  observationId: string;
}): Promise<void> {
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/projects/${encodeURIComponent(params.projectId)}/observations/${encodeURIComponent(params.observationId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok && response.status !== 204) {
    throw await parseError(response);
  }
}

export function isTerminalObservationStatus(
  status: ApiObservationStatus,
): boolean {
  return status === 'COMPLETED' || status === 'FAILED';
}

export function isProcessingObservationStatus(
  status: ApiObservationStatus,
): boolean {
  return !isTerminalObservationStatus(status);
}

export function observationStatusHeadline(
  status: ApiObservationStatus,
): string {
  if (status === 'COMPLETED') return 'Ready';
  if (status === 'FAILED') return "Couldn't process";
  if (status === 'PENDING') return 'Saved';
  return 'Processing';
}

export function observationStatusLabel(status: ApiObservationStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Saved';
    case 'COMPLETED':
      return 'Memory ready';
    case 'FAILED':
      return "Couldn't process";
    case 'EXTRACTING':
    case 'PROCESSING':
    case 'NORMALIZING':
    case 'CHUNKING':
    case 'ANALYZING':
    case 'EMBEDDING':
    default:
      return 'Processing memory…';
  }
}

export function observationStageLabel(observation: {
  status: ApiObservationStatus;
  stageLabel?: string;
}): string {
  return observation.stageLabel || observationStatusLabel(observation.status);
}

export function formatObservationReadyTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export async function pollObservationUntilSettled(params: {
  token: string;
  id: string;
  intervalMs?: number;
  timeoutMs?: number;
  onUpdate?: (observation: ApiObservation) => void;
  shouldContinue?: () => boolean;
}): Promise<ApiObservation> {
  const intervalMs = params.intervalMs ?? 2000;
  const timeoutMs = params.timeoutMs ?? 120_000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (params.shouldContinue && !params.shouldContinue()) {
      throw new ApiError('Polling cancelled', 499);
    }
    const observation = await fetchObservation(params.token, params.id);
    params.onUpdate?.(observation);
    if (isTerminalObservationStatus(observation.status)) {
      return observation;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new ApiError('Timed out waiting for processing to finish', 408);
}

export type ApiSemanticSearchFilters = {
  from?: string;
  to?: string;
  observationType?: 'DOCUMENT' | 'PDF' | 'IMAGE' | 'TEXT' | 'AUDIO';
  mimeType?: string;
  topicId?: string;
  entityId?: string;
  projectId?: string;
  topic?: string;
  entity?: string;
  source?: CaptureSource;
  observationId?: string;
  excludeObservationId?: string;
};

export type ApiSemanticSearchResult = {
  chunkId: string;
  observationId: string;
  chunkIndex: number;
  content: string;
  similarity: number;
  observation: {
    id: string;
    filename: string;
    type: 'DOCUMENT' | 'PDF' | 'IMAGE' | 'TEXT' | 'AUDIO';
    mimeType: string;
    createdAt: string;
    capturedAt: string;
    summary: string | null;
  };
};

export type ApiSemanticSearchResponse = {
  query: string;
  results: ApiSemanticSearchResult[];
  total: number;
};

export async function semanticSearch(params: {
  token: string;
  query: string;
  limit?: number;
  filters?: ApiSemanticSearchFilters;
}): Promise<ApiSemanticSearchResponse> {
  const response = await apiFetch(`${normalizeBaseUrl(apiBaseUrl)}/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: params.query,
      limit: params.limit,
      filters: params.filters,
      topic: params.filters?.topic,
      entity: params.filters?.entity,
      projectId: params.filters?.projectId,
    }),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  const body = (await response.json()) as { data: ApiSemanticSearchResponse };
  return body.data;
}

export type ApiAskCitation = {
  observationId: string;
  chunkId: string;
  title: string;
  snippet: string;
  createdAt: string;
};

export type ApiAskResponse = {
  question: string;
  answer: string;
  citations: ApiAskCitation[];
  insufficientEvidence: boolean;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
};

export type ApiConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

export type ApiConversationMessage = {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  status: 'COMPLETED' | 'FAILED';
  citations: ApiAskCitation[];
  insufficientEvidence: boolean | null;
  createdAt: string;
};

export type ApiConversationDetail = ApiConversationSummary & {
  messages: ApiConversationMessage[];
  nextCursor: string | null;
};

export type ProgressionEvent = {
  action: 'CAPTURE' | 'ASK' | 'RECALL' | 'FREEZE';
  xpAwarded: number;
  keepsAwarded: number;
  multiplier: number;
  bonus: boolean;
  freezeUsed: number;
  streakAfter: number;
  firstOfDay: boolean;
  broke: boolean;
  replayed: boolean;
};

export type ProgressionView = {
  xp: number;
  level: number;
  intoLevel: number;
  nextLevelXp: number;
  progress: number;
  keeps: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  freezeTokens: number;
  freezeCost: number;
  equippedTitle: string | null;
  equippedAura: string | null;
  equippedTitleLabel: string | null;
  equippedAuraLabel: string | null;
  leaderboardVisible: boolean;
  displayName: string | null;
  unlocks: Array<{ key: string; kind: string; label: string; streakGated: boolean; available: boolean }>;
  lastEvent: ProgressionEvent | null;
};

export type LeaderboardView = {
  scope: 'global' | 'circle';
  visible: boolean;
  selfRank: number | null;
  rows: Array<{
    rank: number;
    userId: string;
    displayName: string;
    level: number;
    xp: number;
    currentStreak: number;
    title: string | null;
    self: boolean;
  }>;
};

async function progressionRequest<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(`${normalizeBaseUrl(apiBaseUrl)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: T };
  return body.data;
}

export async function addObservationsToProjectBulk(params: {
  token: string;
  projectId: string;
  observationIds: string[];
}): Promise<{ projectId: string; added: string[]; alreadyPresent: string[] }> {
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/projects/${encodeURIComponent(params.projectId)}/observations/bulk`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ observationIds: params.observationIds }),
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: { projectId: string; added: string[]; alreadyPresent: string[] } };
  return body.data;
}

export function fetchProgression(token: string): Promise<ProgressionView> {
  return progressionRequest(token, '/progression');
}

export function fetchLeaderboard(params: { token: string; scope: 'global' | 'circle' }): Promise<LeaderboardView> {
  return progressionRequest(params.token, `/progression/leaderboard?scope=${params.scope}`);
}

export function updateProgression(params: {
  token: string;
  leaderboardVisible?: boolean;
  displayName?: string;
  equippedTitle?: string | null;
  equippedAura?: string | null;
}): Promise<ProgressionView> {
  const { token, ...patch } = params;
  return progressionRequest(token, '/progression', { method: 'PATCH', body: JSON.stringify(patch) });
}

export function buyStreakFreeze(token: string): Promise<ProgressionView> {
  return progressionRequest(token, '/progression/freeze', { method: 'POST' });
}

export function addProgressionPeer(params: { token: string; peerUserId: string }): Promise<{ ok: true }> {
  return progressionRequest(params.token, '/progression/peers', {
    method: 'POST', body: JSON.stringify({ peerUserId: params.peerUserId }),
  });
}

export async function askKairos(params: {
  token: string;
  question: string;
  limit?: number;
  conversationId?: string;
  clientRequestId?: string;
  filters?: ApiSemanticSearchFilters;
}): Promise<ApiAskResponse> {
  const path = params.conversationId
    ? `/conversations/${encodeURIComponent(params.conversationId)}/ask`
    : '/ask';
  const response = await apiFetch(`${normalizeBaseUrl(apiBaseUrl)}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question: params.question,
      limit: params.limit,
      clientRequestId: params.clientRequestId,
      filters: params.filters,
      topic: params.filters?.topic,
      entity: params.filters?.entity,
      projectId: params.filters?.projectId,
      observationId: params.filters?.observationId,
    }),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  const body = (await response.json()) as { data: ApiAskResponse };
  return body.data;
}

export async function listConversations(params: {
  token: string;
  limit?: number;
  cursor?: string;
}): Promise<{ items: ApiConversationSummary[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.cursor) qs.set('cursor', params.cursor);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/conversations${suffix}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as {
    data: { items: ApiConversationSummary[]; nextCursor: string | null };
  };
  return body.data;
}

export async function fetchConversation(params: {
  token: string;
  id: string;
  limit?: number;
}): Promise<ApiConversationDetail> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/conversations/${encodeURIComponent(params.id)}${suffix}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: ApiConversationDetail };
  return body.data;
}

export async function deleteConversation(params: {
  token: string;
  id: string;
}): Promise<void> {
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/conversations/${encodeURIComponent(params.id)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok && response.status !== 204) {
    throw await parseError(response);
  }
}

export type RecallEntitlement = {
  feature: 'RECALL';
  status: string;
  allowed: boolean;
  isPro?: boolean;
  validUntil: string | null;
  source: string;
  store?: string | null;
};

export async function syncBilling(token: string): Promise<RecallEntitlement> {
  const response = await apiFetch(`${normalizeBaseUrl(apiBaseUrl)}/billing/sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: RecallEntitlement };
  return body.data;
}

export async function createStripeCheckout(
  token: string,
): Promise<{ url: string; vendor: 'stripe' }> {
  const response = await apiFetch(`${normalizeBaseUrl(apiBaseUrl)}/billing/checkout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: { url: string; vendor: 'stripe' } };
  return body.data;
}

export type RecallEventResult = {
  clientEventId: string;
  status: 'accepted' | 'deduped' | 'rejected';
  observationId: string | null;
  deduped: boolean;
  reason?: string;
};

export async function fetchRecallEntitlement(
  token: string,
): Promise<RecallEntitlement> {
  const response = await apiFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/recall/entitlement`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { data: RecallEntitlement };
  return body.data;
}

export async function postRecallEvents(params: {
  token: string;
  events: Array<Record<string, unknown>>;
}): Promise<{ results: RecallEventResult[] }> {
  const response = await apiFetch(`${normalizeBaseUrl(apiBaseUrl)}/recall/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ events: params.events }),
  });
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as {
    data: { results: RecallEventResult[] };
  };
  return body.data;
}

export async function deleteRecallData(token: string): Promise<{
  deletedObservations: number;
}> {
  const response = await apiFetch(`${normalizeBaseUrl(apiBaseUrl)}/recall/data`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as {
    data: { deletedObservations: number };
  };
  return body.data;
}
