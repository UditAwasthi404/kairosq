import {
  formatObservationReadyTime,
  isProcessingObservationStatus,
  isTerminalObservationStatus,
  observationStageLabel,
  observationStatusHeadline,
  observationStatusLabel,
} from '../lib/api';

describe('processing status UX helpers', () => {
  it('renders processing, ready, and failed headlines', () => {
    expect(observationStatusHeadline('EMBEDDING')).toBe('Processing');
    expect(observationStatusHeadline('COMPLETED')).toBe('Ready');
    expect(observationStatusHeadline('PENDING')).toBe('Saved');
    expect(observationStatusHeadline('FAILED')).toBe("Couldn't process");
  });

  it('uses truthful stage labels without percentages', () => {
    expect(observationStatusLabel('CHUNKING')).toBe('Processing memory…');
    expect(observationStatusLabel('PENDING')).toBe('Saved');
    expect(observationStatusLabel('COMPLETED')).toBe('Memory ready');
    expect(observationStageLabel({ status: 'EMBEDDING' })).toBe(
      'Processing memory…',
    );
    expect(
      observationStageLabel({
        status: 'PENDING',
        stageLabel: 'Saved',
      }),
    ).toBe('Saved');
    expect(formatObservationReadyTime('2026-09-12T12:42:00.000Z')).toMatch(
      /\d/,
    );
  });

  it('stops polling when ready or failed', () => {
    expect(isTerminalObservationStatus('COMPLETED')).toBe(true);
    expect(isTerminalObservationStatus('FAILED')).toBe(true);
    expect(isProcessingObservationStatus('COMPLETED')).toBe(false);
    expect(isProcessingObservationStatus('FAILED')).toBe(false);
    expect(isProcessingObservationStatus('ANALYZING')).toBe(true);
  });
});
