import {
  askService,
  captureService,
  memoriesService,
  searchService,
  timelineService,
} from '../services';
import { resetStore } from '../services/mock/store';

describe('mock memory services', () => {
  beforeEach(() => {
    resetStore();
  });

  it('lists memories for the timeline', async () => {
    const page = await timelineService.getPage(null, 6);
    expect(page.groups.length).toBeGreaterThan(0);
    expect(page.groups[0]?.memories.length).toBeGreaterThan(0);
  });

  it('returns memory detail with related items', async () => {
    const memory = await memoriesService.get('mem-4');
    expect(memory.title).toContain('RAG');
    expect(memory.relatedMemories.length).toBeGreaterThan(0);
    expect(memory.topics.length).toBeGreaterThan(0);
  });

  it('searches memories with realistic results', async () => {
    const response = await searchService.search('RAG');
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results.some((r) => /rag|vector|retrieval/i.test(r.memory.title))).toBe(true);
  });

  it('answers ask queries with supporting memories', async () => {
    const result = await askService.ask('What was I learning about RAG?');
    expect(result.message.role).toBe('kairos');
    expect(result.message.sources?.length).toBeGreaterThan(0);
    expect(result.message.content.toLowerCase()).not.toContain('lorem');
  });

  it('simulates capture processing through READY', async () => {
    const created = await captureService.capture({
      sourceType: 'note',
      text: 'Notes on Kairos privacy defaults',
    });
    let job = created.job;
    job = await captureService.advanceJob(job.id);
    job = await captureService.advanceJob(job.id);
    job = await captureService.advanceJob(job.id);
    expect(job.stage).toBe('READY');
    expect(job.resultMemoryId).toBeTruthy();
  });
});
