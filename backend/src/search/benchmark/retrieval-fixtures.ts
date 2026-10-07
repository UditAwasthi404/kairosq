/**
 * Deterministic retrieval benchmark fixtures.
 * Used only by gated benchmark tests — never by production code.
 */

export type RetrievalFixtureKey =
  | 'redis_semantic'
  | 'redis_keyword'
  | 'redis_filename'
  | 'redis_url'
  | 'redis_dated'
  | 'react_native'
  | 'nestjs'
  | 'docker'
  | 'postgres_distractor'
  | 'postgres_general';

export type RetrievalFixture = {
  key: RetrievalFixtureKey;
  filename: string;
  content: string;
  /** ISO capturedAt for dated retrieval cases */
  capturedAt?: string;
  category:
    | 'semantic'
    | 'keyword'
    | 'filename'
    | 'url'
    | 'date'
    | 'technology'
    | 'distractor';
};

export const RETRIEVAL_BENCH_CLERK_USER = 'clerk_retrieval_bench_v1';

export const RETRIEVAL_FIXTURES: RetrievalFixture[] = [
  {
    key: 'redis_semantic',
    filename: 'caching-notes.txt',
    content:
      'Redis stores frequently accessed information in memory to reduce database load.',
    category: 'semantic',
  },
  {
    key: 'redis_keyword',
    filename: 'backend-stack.txt',
    content: 'The backend uses Redis for caching.',
    category: 'keyword',
  },
  {
    key: 'redis_filename',
    filename: 'redis-production-config.pdf',
    content:
      'Production Redis configuration uses maxmemory-policy allkeys-lru.',
    category: 'filename',
  },
  {
    key: 'redis_url',
    filename: 'bookmarks.txt',
    content:
      'Useful reference: https://redis.io/docs/latest/develop/data-types/ for Redis data types.',
    category: 'url',
  },
  {
    key: 'redis_dated',
    filename: 'changelog-2026-09-04.txt',
    content: 'On September 4, 2026 I changed the Redis configuration.',
    capturedAt: '2026-09-04T15:00:00.000Z',
    category: 'date',
  },
  {
    key: 'react_native',
    filename: 'mobile-notes.txt',
    content:
      'I built the Kairos mobile client with React Native and Expo Router.',
    category: 'technology',
  },
  {
    key: 'nestjs',
    filename: 'api-notes.txt',
    content: 'The Kairos API is implemented with NestJS and Prisma.',
    category: 'technology',
  },
  {
    key: 'docker',
    filename: 'ops-notes.txt',
    content: 'Local services run in Docker containers during development.',
    category: 'technology',
  },
  {
    key: 'postgres_distractor',
    filename: 'postgres-caching.txt',
    content:
      'PostgreSQL caching strategies can reduce database load for frequently accessed information.',
    category: 'distractor',
  },
  {
    key: 'postgres_general',
    filename: 'postgres-intro.txt',
    content:
      'PostgreSQL is a relational database used for persistent structured data.',
    category: 'distractor',
  },
];

export type RetrievalBenchQuery = {
  id: string;
  query: string;
  /** Fixture keys that count as relevant for ranking metrics */
  relevantKeys: RetrievalFixtureKey[];
  description: string;
};

export const RETRIEVAL_BENCH_QUERIES: RetrievalBenchQuery[] = [
  {
    id: 'A',
    query: 'What did I use Redis for?',
    relevantKeys: ['redis_keyword', 'redis_semantic'],
    description: 'Semantic question about Redis usage / caching',
  },
  {
    id: 'B',
    query: 'Redis',
    relevantKeys: [
      'redis_keyword',
      'redis_semantic',
      'redis_filename',
      'redis_url',
      'redis_dated',
    ],
    description: 'Exact keyword query',
  },
  {
    id: 'C',
    query: 'redis-production-config.pdf',
    relevantKeys: ['redis_filename'],
    description: 'Filename lookup (filename not in chunk text)',
  },
  {
    id: 'D',
    query: 'maxmemory-policy allkeys-lru',
    relevantKeys: ['redis_filename'],
    description: 'Exact configuration phrase',
  },
  {
    id: 'E',
    query: 'redis.io',
    relevantKeys: ['redis_url'],
    description: 'URL / domain fragment',
  },
  {
    id: 'F',
    query: 'What changed on September 4 2026?',
    relevantKeys: ['redis_dated'],
    description: 'Date-oriented question',
  },
  {
    id: 'G',
    query: 'What did I build with React Native?',
    relevantKeys: ['react_native'],
    description: 'Technology / framework question',
  },
  {
    id: 'H',
    query: 'NestJS and Prisma API',
    relevantKeys: ['nestjs'],
    description: 'Lexical + semantic API stack',
  },
  {
    id: 'I',
    query: 'Docker containers for local services',
    relevantKeys: ['docker'],
    description: 'Ops / environment question',
  },
  {
    id: 'J',
    query: 'Kairos mobile client Expo Router',
    relevantKeys: ['react_native'],
    description: 'Project + technology combination',
  },
  {
    id: 'K',
    query: 'things I saved about Redis data types',
    relevantKeys: ['redis_url', 'redis_semantic', 'redis_keyword'],
    description: 'Natural-language Redis combination',
  },
  {
    id: 'L',
    query: 'persistent structured data',
    relevantKeys: ['postgres_general'],
    description: 'PostgreSQL lexical phrase',
  },
];
