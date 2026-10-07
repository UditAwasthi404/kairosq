export type RelatedReason =
  | 'similar'
  | 'shared_topic'
  | 'shared_entity'
  | 'shared_project'
  | 'nearby_in_time';

export type RelatedMemoryScoreInput = {
  similarity?: number;
  sharedTopicCount: number;
  seedTopicCount: number;
  sharedEntityCount: number;
  seedEntityCount: number;
  sharedProject: boolean;
  hoursApart: number;
};

export function scoreRelatedMemory(input: RelatedMemoryScoreInput): {
  score: number;
  reasons: RelatedReason[];
} {
  const topicOverlap =
    input.seedTopicCount > 0
      ? input.sharedTopicCount / input.seedTopicCount
      : 0;
  const entityOverlap =
    input.seedEntityCount > 0
      ? input.sharedEntityCount / input.seedEntityCount
      : 0;
  const similarity = Math.max(0, Math.min(1, input.similarity ?? 0));
  const recency = Math.max(0, 1 - Math.abs(input.hoursApart) / (24 * 30));
  const score =
    similarity * 0.5 +
    topicOverlap * 0.2 +
    entityOverlap * 0.15 +
    (input.sharedProject ? 0.1 : 0) +
    recency * 0.05;

  const reasons: RelatedReason[] = [];
  if (similarity >= 0.35) reasons.push('similar');
  if (input.sharedTopicCount > 0) reasons.push('shared_topic');
  if (input.sharedEntityCount > 0) reasons.push('shared_entity');
  if (input.sharedProject) reasons.push('shared_project');
  if (Math.abs(input.hoursApart) <= 72) reasons.push('nearby_in_time');

  return { score, reasons };
}

export function shouldKeepRelated(score: number, reasons: RelatedReason[]): boolean {
  if (reasons.includes('similar') && score >= 0.28) return true;
  if (
    reasons.includes('shared_topic') ||
    reasons.includes('shared_entity') ||
    reasons.includes('shared_project')
  ) {
    return score >= 0.12;
  }
  return false;
}
