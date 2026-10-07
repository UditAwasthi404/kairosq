import type { SourceType } from '../types';
import type { CaptureSource } from '../lib/api';

export const CAPTURE_SOURCE_LABELS: Record<CaptureSource, string> = {
  MANUAL: 'Manual',
  KEYBOARD: 'Keyboard',
  SHARE: 'Share',
  QUICK_CAPTURE: 'Quick Capture',
  VOICE: 'Voice',
  WIDGET: 'Widget',
  RECALL: 'Recall',
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  screenshot: 'Screenshot',
  photo: 'Photo',
  document: 'Document',
  note: 'Note',
  link: 'Link',
  audio: 'Audio',
  conversation: 'Conversation',
  task: 'Task',
};
