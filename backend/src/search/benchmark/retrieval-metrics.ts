/**
 * Small retrieval metrics for the Kairos engineering benchmark.
 */

export function recallAtK(
  rankedIds: string[],
  relevantIds: Set<string>,
  k: number,
): number {
  if (relevantIds.size === 0) return 0;
  const top = rankedIds.slice(0, Math.max(0, k));
  let hits = 0;
  for (const id of top) {
    if (relevantIds.has(id)) hits += 1;
  }
  return hits / relevantIds.size;
}

/**
 * Mean reciprocal rank of the first relevant observation in the ranked list.
 * Returns 0 when no relevant item appears.
 */
export function meanReciprocalRank(
  rankedIds: string[],
  relevantIds: Set<string>,
): number {
  if (relevantIds.size === 0) return 0;
  for (let i = 0; i < rankedIds.length; i += 1) {
    if (relevantIds.has(rankedIds[i])) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

export type QueryBenchmarkResult = {
  queryId: string;
  query: string;
  rankedObservationIds: string[];
  rankedFilenames: string[];
  relevantKeys: string[];
  recallAt5: number;
  recallAt10: number;
  mrr: number;
  latencyMs: number;
  firstRelevantRank: number | null;
  topFilename: string | null;
};

export function evaluateRankedResults(params: {
  queryId: string;
  query: string;
  rankedObservationIds: string[];
  rankedFilenames: string[];
  relevantObservationIds: Set<string>;
  relevantKeys: string[];
  latencyMs: number;
}): QueryBenchmarkResult {
  const firstRelevantRank = (() => {
    for (let i = 0; i < params.rankedObservationIds.length; i += 1) {
      if (params.relevantObservationIds.has(params.rankedObservationIds[i])) {
        return i + 1;
      }
    }
    return null;
  })();

  return {
    queryId: params.queryId,
    query: params.query,
    rankedObservationIds: params.rankedObservationIds,
    rankedFilenames: params.rankedFilenames,
    relevantKeys: params.relevantKeys,
    recallAt5: recallAtK(
      params.rankedObservationIds,
      params.relevantObservationIds,
      5,
    ),
    recallAt10: recallAtK(
      params.rankedObservationIds,
      params.relevantObservationIds,
      10,
    ),
    mrr: meanReciprocalRank(
      params.rankedObservationIds,
      params.relevantObservationIds,
    ),
    latencyMs: params.latencyMs,
    firstRelevantRank,
    topFilename: params.rankedFilenames[0] ?? null,
  };
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}
