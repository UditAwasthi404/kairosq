/**
 * Deterministic lexical query normalization for PostgreSQL FTS + ILIKE.
 * Not a full NLP pipeline — keeps technical tokens searchable.
 */

export type NormalizedLexicalQuery = {
  /** Original trimmed query */
  raw: string;
  /** Lowercased needle for ILIKE / exact substring boosts */
  needle: string;
  /** Alphanumeric token string for plainto_tsquery('simple', ...) */
  ftsInput: string;
  /** Significant tokens (length > 1) */
  tokens: string[];
};

export function normalizeLexicalQuery(query: string): NormalizedLexicalQuery {
  const raw = query.trim();
  const needle = raw.toLowerCase();
  // Split on non-alphanumeric so hyphens, dots, and URLs become FTS tokens.
  const ftsInput = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = ftsInput.split(' ').filter((t) => t.length > 1);
  return { raw, needle, ftsInput, tokens };
}

export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
