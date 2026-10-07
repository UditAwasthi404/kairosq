import type { ApiSemanticSearchFilters, CaptureSource } from './api';
import { CAPTURE_SOURCE_LABELS } from '../constants/source-labels';

export type LibraryFilters = {
  observationType?: ApiSemanticSearchFilters['observationType'];
  source?: CaptureSource;
  from?: string;
  to?: string;
  topicId?: string;
  topic?: string;
  entityId?: string;
  entity?: string;
  projectId?: string;
};

export function buildSemanticFilters(filters: LibraryFilters): ApiSemanticSearchFilters {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => Boolean(value))) as ApiSemanticSearchFilters;
}

export function removeLibraryFilter(filters: LibraryFilters, key: keyof LibraryFilters): LibraryFilters {
  const next = { ...filters };
  delete next[key];
  if (key === 'topicId' || key === 'topic') { delete next.topicId; delete next.topic; }
  if (key === 'entityId' || key === 'entity') { delete next.entityId; delete next.entity; }
  if (key === 'projectId') delete next.projectId;
  if (key === 'from' || key === 'to') {
    delete next.from;
    delete next.to;
  }
  return next;
}

export function toggleLibraryScopeFilter(
  filters: LibraryFilters,
  scope: { type: 'topic' | 'entity' | 'project'; id: string; name: string },
): LibraryFilters {
  const idKey = scope.type === 'topic' ? 'topicId' : scope.type === 'entity' ? 'entityId' : 'projectId';
  const nameKey = scope.type === 'topic' ? 'topic' : scope.type === 'entity' ? 'entity' : undefined;
  if (filters[idKey] === scope.id) return removeLibraryFilter(filters, idKey);
  return {
    ...filters,
    [idKey]: scope.id,
    ...(nameKey ? { [nameKey]: scope.name } : {}),
  };
}

export const SEARCH_SOURCE_OPTIONS: Array<{
  value: CaptureSource;
  label: string;
}> = (Object.keys(CAPTURE_SOURCE_LABELS) as CaptureSource[]).map((value) => ({
  value,
  label: CAPTURE_SOURCE_LABELS[value],
}));

export type SearchDatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month';

export const SEARCH_DATE_OPTIONS: Array<{
  value: SearchDatePreset;
  label: string;
}> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
];

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function dateRangeForPreset(
  preset: SearchDatePreset,
  now = new Date(),
): { from: string; to: string } {
  if (preset === 'today') {
    return {
      from: startOfDay(now).toISOString(),
      to: endOfDay(now).toISOString(),
    };
  }
  if (preset === 'yesterday') {
    const day = startOfDay(now);
    day.setDate(day.getDate() - 1);
    return { from: day.toISOString(), to: endOfDay(day).toISOString() };
  }
  if (preset === 'this_week') {
    const start = startOfDay(now);
    const weekday = start.getDay() || 7;
    start.setDate(start.getDate() - weekday + 1);
    return { from: start.toISOString(), to: endOfDay(now).toISOString() };
  }
  if (preset === 'last_week') {
    const end = startOfDay(now);
    const weekday = end.getDay() || 7;
    end.setDate(end.getDate() - weekday);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return { from: start.toISOString(), to: endOfDay(end).toISOString() };
  }
  const start = startOfDay(now);
  start.setDate(1);
  return { from: start.toISOString(), to: endOfDay(now).toISOString() };
}

export function searchSourceLabel(source: CaptureSource): string {
  return SEARCH_SOURCE_OPTIONS.find((item) => item.value === source)?.label ?? source;
}

export function searchDateLabel(preset: SearchDatePreset): string {
  return SEARCH_DATE_OPTIONS.find((item) => item.value === preset)?.label ?? preset;
}
