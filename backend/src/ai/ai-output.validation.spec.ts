import {
  validateDocumentAnalysis,
  validateEntities,
  validateGroundedAnswerPayload,
  validateSummary,
  validateTopics,
} from '../ai/ai-output.validation';

describe('AI output validation', () => {
  it('accepts a valid summary', () => {
    expect(validateSummary('A concise document summary.')).toContain('summary');
  });

  it('rejects malformed summary', () => {
    expect(() => validateSummary(123)).toThrow();
    expect(() => validateSummary('x')).toThrow();
  });

  it('filters invalid topics and dedupes', () => {
    const topics = validateTopics([
      { name: 'RAG' },
      { name: 'rag' },
      { name: 'x' },
      { name: 'Vector Databases', confidence: 0.9 },
    ]);
    expect(topics.map((t) => t.name)).toEqual(['RAG', 'Vector Databases']);
  });

  it('filters invalid entities', () => {
    const entities = validateEntities([
      { name: 'PostgreSQL', type: 'TECHNOLOGY' },
      { name: 'Someone', type: 'ALIEN' },
      { name: 'Neon', type: 'PRODUCT', confidence: 1.2 },
    ]);
    expect(entities).toEqual([
      { name: 'PostgreSQL', type: 'TECHNOLOGY', confidence: undefined },
      { name: 'Neon', type: 'PRODUCT', confidence: 1 },
    ]);
  });

  it('validates full analysis payload', () => {
    const result = validateDocumentAnalysis(
      {
        summary: 'Document about retrieval systems.',
        topics: [{ name: 'RAG' }],
        entities: [{ name: 'pgvector', type: 'TECHNOLOGY' }],
      },
      { provider: 'test', model: 'test-model' },
    );
    expect(result.provider).toBe('test');
    expect(result.topics).toHaveLength(1);
    expect(result.entities[0]?.name).toBe('pgvector');
  });

  it('validates grounded answers and drops invalid citation refs', () => {
    const result = validateGroundedAnswerPayload(
      {
        answer: 'You learned that Redis is used for caching.',
        citations: [1, '[2]', 99, 'nope'],
      },
      new Set([1, 2]),
    );
    expect(result.answer).toContain('Redis');
    expect(result.citationRefs).toEqual([1, 2]);
  });

  it('rejects malformed grounded answers', () => {
    expect(() =>
      validateGroundedAnswerPayload({ answer: 12 }, new Set([1])),
    ).toThrow();
  });
});
