import {
  meanReciprocalRank,
  recallAtK,
  evaluateRankedResults,
} from './retrieval-metrics';

describe('retrieval-metrics', () => {
  const relevant = new Set(['obs_redis', 'obs_cache']);

  it('computes Recall@K against labeled relevant observations', () => {
    const ranked = ['obs_pg', 'obs_redis', 'obs_rn', 'obs_cache', 'obs_x'];
    expect(recallAtK(ranked, relevant, 5)).toBe(1);
    expect(recallAtK(ranked, relevant, 1)).toBe(0);
    expect(recallAtK(ranked, relevant, 2)).toBe(0.5);
  });

  it('computes MRR from the first relevant hit', () => {
    expect(meanReciprocalRank(['obs_pg', 'obs_redis'], relevant)).toBe(0.5);
    expect(meanReciprocalRank(['obs_redis'], relevant)).toBe(1);
    expect(meanReciprocalRank(['obs_pg', 'obs_rn'], relevant)).toBe(0);
  });

  it('builds a full query evaluation record', () => {
    const result = evaluateRankedResults({
      queryId: 'A',
      query: 'What did I use Redis for?',
      rankedObservationIds: ['obs_pg', 'obs_redis'],
      rankedFilenames: ['postgres.txt', 'backend-stack.txt'],
      relevantObservationIds: new Set(['obs_redis']),
      relevantKeys: ['redis_keyword'],
      latencyMs: 12,
    });
    expect(result.recallAt5).toBe(1);
    expect(result.mrr).toBe(0.5);
    expect(result.firstRelevantRank).toBe(2);
    expect(result.topFilename).toBe('postgres.txt');
  });
});
