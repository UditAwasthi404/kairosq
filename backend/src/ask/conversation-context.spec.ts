import {
  buildRetrievalQuery,
  selectBoundedHistory,
  titleFromQuestion,
} from './conversation-context';

describe('conversation-context helpers', () => {
  it('builds a deterministic title from the question', () => {
    expect(titleFromQuestion('  What did I learn about Redis?  ')).toBe(
      'What did I learn about Redis?',
    );
    expect(titleFromQuestion('a'.repeat(100)).endsWith('…')).toBe(true);
  });

  it('expands follow-up retrieval queries with prior user question', () => {
    const query = buildRetrievalQuery('Why did I use it?', [
      'What did I use Redis for?',
    ]);
    expect(query).toContain('Redis');
    expect(query).toContain('Why did I use it?');
  });

  it('bounds conversation history by message and character budgets', () => {
    const history = selectBoundedHistory(
      [
        { role: 'USER', content: 'one' },
        { role: 'ASSISTANT', content: 'two' },
        { role: 'USER', content: 'three' },
        { role: 'ASSISTANT', content: 'four' },
      ],
      { maxMessages: 2, maxChars: 4000 },
    );
    expect(history).toEqual([
      { role: 'USER', content: 'three' },
      { role: 'ASSISTANT', content: 'four' },
    ]);
  });
});
