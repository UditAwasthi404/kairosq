import type { LexicalSearchHit } from './lexical-search.service';
import type { VectorSearchHit } from '../embeddings/vector-search.service';
import {
  normalizeLexicalQuery,
  type NormalizedLexicalQuery,
} from './lexical-query';

export type FusionWeights = {
  semanticWeight: number;
  lexicalWeight: number;
  exactBoost: number;
};

export type FusedCandidate = {
  chunkId: string;
  observationId: string;
  chunkIndex: number;
  content: string;
  /** Exposed as SearchResult.similarity (compatible contract). */
  similarity: number;
  distance: number;
  semanticScore: number;
  lexicalScore: number;
  exactBoost: number;
  combinedScore: number;
};

const DEFAULT_WEIGHTS: FusionWeights = {
  // Semantic remains primary for paraphrase questions.
  semanticWeight: 0.55,
  // Lexical carries exact tokens / filenames / URLs.
  lexicalWeight: 0.35,
  // Modest additive boost so exact hits win ties without erasing semantics.
  exactBoost: 0.1,
};

/**
 * Defaults chosen so:
 * - paraphrase questions still lean on cosine similarity
 * - exact token / filename / URL hits can surface via lexical + boost
 * - boost is capped so a weak semantic+lexical pair cannot dominate a strong semantic hit
 */
export function readFusionWeights(): FusionWeights {
  return {
    semanticWeight: clamp01(
      readFloatEnv(
        'SEARCH_HYBRID_SEMANTIC_WEIGHT',
        DEFAULT_WEIGHTS.semanticWeight,
      ),
    ),
    lexicalWeight: clamp01(
      readFloatEnv(
        'SEARCH_HYBRID_LEXICAL_WEIGHT',
        DEFAULT_WEIGHTS.lexicalWeight,
      ),
    ),
    exactBoost: clamp01(
      readFloatEnv('SEARCH_HYBRID_EXACT_BOOST', DEFAULT_WEIGHTS.exactBoost),
    ),
  };
}

export function fuseCandidates(params: {
  query: string;
  semanticHits: VectorSearchHit[];
  lexicalHits: LexicalSearchHit[];
  weights?: FusionWeights;
}): FusedCandidate[] {
  const weights = params.weights ?? DEFAULT_WEIGHTS;
  const normalized = normalizeLexicalQuery(params.query);
  const byChunk = new Map<
    string,
    {
      chunkId: string;
      observationId: string;
      chunkIndex: number;
      content: string;
      filename?: string;
      semanticScore: number | null;
      ftsRank: number | null;
      filenameMatch: boolean;
      contentExactMatch: boolean;
    }
  >();

  for (const hit of params.semanticHits) {
    byChunk.set(hit.chunkId, {
      chunkId: hit.chunkId,
      observationId: hit.observationId,
      chunkIndex: hit.chunkIndex,
      content: hit.content,
      semanticScore: clamp01(hit.similarity),
      ftsRank: null,
      filenameMatch: false,
      contentExactMatch: false,
    });
  }

  for (const hit of params.lexicalHits) {
    const existing = byChunk.get(hit.chunkId);
    if (existing) {
      existing.ftsRank = hit.ftsRank;
      existing.filenameMatch = hit.filenameMatch;
      existing.contentExactMatch = hit.contentExactMatch;
      existing.filename = hit.filename;
      if (!existing.content) existing.content = hit.content;
    } else {
      byChunk.set(hit.chunkId, {
        chunkId: hit.chunkId,
        observationId: hit.observationId,
        chunkIndex: hit.chunkIndex,
        content: hit.content,
        filename: hit.filename,
        semanticScore: null,
        ftsRank: hit.ftsRank,
        filenameMatch: hit.filenameMatch,
        contentExactMatch: hit.contentExactMatch,
      });
    }
  }

  const ranks = [...byChunk.values()]
    .map((row) => row.ftsRank ?? 0)
    .filter((r) => r > 0);
  const maxRank = ranks.length > 0 ? Math.max(...ranks) : 0;

  const fused: FusedCandidate[] = [];
  for (const row of byChunk.values()) {
    const semanticScore = row.semanticScore ?? 0;
    const lexicalScore = normalizeLexicalScore(row.ftsRank ?? 0, maxRank, row);
    const exactBoost = computeExactBoost(normalized, row, weights.exactBoost);
    const combinedScore = clamp01(
      weights.semanticWeight * semanticScore +
        weights.lexicalWeight * lexicalScore +
        exactBoost,
    );

    fused.push({
      chunkId: row.chunkId,
      observationId: row.observationId,
      chunkIndex: row.chunkIndex,
      content: row.content,
      similarity: combinedScore,
      distance: 1 - combinedScore,
      semanticScore,
      lexicalScore,
      exactBoost,
      combinedScore,
    });
  }

  fused.sort((a, b) => {
    if (b.combinedScore !== a.combinedScore) {
      return b.combinedScore - a.combinedScore;
    }
    // Stable tie-break: prefer stronger semantic, then chunk index.
    if (b.semanticScore !== a.semanticScore) {
      return b.semanticScore - a.semanticScore;
    }
    return a.chunkIndex - b.chunkIndex;
  });

  return fused;
}

function normalizeLexicalScore(
  ftsRank: number,
  maxRank: number,
  row: { filenameMatch: boolean; contentExactMatch: boolean },
): number {
  let score = 0;
  if (maxRank > 0 && ftsRank > 0) {
    score = ftsRank / maxRank;
  } else if (row.filenameMatch || row.contentExactMatch) {
    // ILIKE-only hit with no usable FTS rank.
    score = row.filenameMatch ? 0.85 : 0.7;
  }
  return clamp01(score);
}

function computeExactBoost(
  query: NormalizedLexicalQuery,
  row: {
    content: string;
    filename?: string;
    filenameMatch: boolean;
    contentExactMatch: boolean;
  },
  maxBoost: number,
): number {
  if (maxBoost <= 0 || !query.needle) return 0;
  let boost = 0;
  const filename = (row.filename ?? '').toLowerCase();
  const content = row.content.toLowerCase();

  if (row.filenameMatch || filename.includes(query.needle)) {
    boost += maxBoost;
  } else if (row.contentExactMatch || content.includes(query.needle)) {
    boost += maxBoost * 0.8;
  } else if (query.tokens.length > 0) {
    const haystack = `${filename} ${content}`;
    const hitCount = query.tokens.filter((t) => haystack.includes(t)).length;
    if (hitCount === query.tokens.length) {
      boost += maxBoost * 0.5;
    }
  }

  return Math.min(boost, maxBoost);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function readFloatEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}
