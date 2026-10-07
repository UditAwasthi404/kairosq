import { LexicalSearchService } from './lexical-search.service';

describe('LexicalSearchService', () => {
  it('scopes SQL to the authenticated user and optional project filter', async () => {
    const queryRaw = jest.fn().mockResolvedValue([]);
    const prisma = { $queryRawUnsafe: queryRaw };
    const service = new LexicalSearchService(prisma as never);

    await service.search('user_a', 'Redis', {
      limit: 30,
      filters: { projectId: 'proj_1' },
    });

    expect(queryRaw).toHaveBeenCalled();
    const [sql, ...params] = queryRaw.mock.calls[0] as [string, ...unknown[]];
    expect(sql).toContain('o."userId" = $1');
    expect(sql).toContain(`o."processingStatus" = 'COMPLETED'`);
    expect(sql).toContain('project_observations');
    expect(params[0]).toBe('user_a');
    expect(params).toContain('proj_1');
  });

  it('includes filename and content lexical predicates', async () => {
    const queryRaw = jest.fn().mockResolvedValue([]);
    const prisma = { $queryRawUnsafe: queryRaw };
    const service = new LexicalSearchService(prisma as never);

    await service.search('user_a', 'redis-production-config.pdf');

    const [sql] = queryRaw.mock.calls[0] as [string, ...unknown[]];
    expect(sql).toContain('plainto_tsquery');
    expect(sql).toContain('originalFilename');
    expect(sql).toContain('ILIKE');
    expect(sql).toContain(`o."processingStatus" = 'COMPLETED'`);
  });
});
