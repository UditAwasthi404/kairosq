import { scoreRelatedMemory, shouldKeepRelated } from './related-memories';

describe('related memory ranking', () => {
  it('keeps a semantically similar memory', () => {
    const result = scoreRelatedMemory({
      similarity: 0.72,
      sharedTopicCount: 0,
      seedTopicCount: 1,
      sharedEntityCount: 0,
      seedEntityCount: 0,
      sharedProject: false,
      hoursApart: 80,
    });
    expect(result.reasons).toContain('similar');
    expect(shouldKeepRelated(result.score, result.reasons)).toBe(true);
  });

  it('drops an unrelated weak match', () => {
    const result = scoreRelatedMemory({
      similarity: 0.1,
      sharedTopicCount: 0,
      seedTopicCount: 2,
      sharedEntityCount: 0,
      seedEntityCount: 1,
      sharedProject: false,
      hoursApart: 900,
    });
    expect(shouldKeepRelated(result.score, result.reasons)).toBe(false);
  });

  it('keeps a shared-topic memory even without embeddings', () => {
    const result = scoreRelatedMemory({
      sharedTopicCount: 1,
      seedTopicCount: 1,
      sharedEntityCount: 0,
      seedEntityCount: 0,
      sharedProject: false,
      hoursApart: 24,
    });
    expect(result.reasons).toContain('shared_topic');
    expect(shouldKeepRelated(result.score, result.reasons)).toBe(true);
  });
});
