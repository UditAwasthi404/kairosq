# Search quality decision

Default remains **semantic-only** (`SEARCH_HYBRID_ENABLED=false`).

Hybrid retrieval exists and is covered by unit/integration tests, but it is
not enabled automatically. Enable it only when
`RUN_RETRIEVAL_BENCH=1 npm test -- retrieval-benchmark` shows a consistent
Recall@5 / Recall@10 / relevant-result gain without an unacceptable latency
regression on representative Kairos queries (names, technical terms, natural
language, dates, project, topic, source).

The live comparison writes `backend/test-artifacts/retrieval-benchmark-phase2.json`.
If that artifact is missing, the production default stays semantic.
