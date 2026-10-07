import type { GroundedContextItem } from '../ai/ai.types';

export type AskCitation = {
  observationId: string;
  chunkId: string;
  title: string;
  snippet: string;
  createdAt: string;
};

/**
 * Maps LLM citation refs to backend context items.
 * Never trusts arbitrary IDs from the model — only supplied refs.
 */
export function resolveCitations(
  citationRefs: number[],
  context: GroundedContextItem[],
): AskCitation[] {
  const byRef = new Map(context.map((item) => [item.ref, item]));
  const out: AskCitation[] = [];
  const seenChunks = new Set<string>();

  for (const ref of citationRefs) {
    const item = byRef.get(ref);
    if (!item) continue;
    if (seenChunks.has(item.chunkId)) continue;
    seenChunks.add(item.chunkId);
    out.push({
      observationId: item.observationId,
      chunkId: item.chunkId,
      title: item.title,
      snippet: item.content.slice(0, 280),
      createdAt: item.createdAt,
    });
  }

  return out;
}
