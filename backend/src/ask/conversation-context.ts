export function titleFromQuestion(question: string): string {
  const cleaned = question.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New conversation';
  const max = 80;
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

export function buildRetrievalQuery(
  question: string,
  recentUserQuestions: string[],
): string {
  const prior = recentUserQuestions.find(
    (q) => q.trim().length > 0 && q.trim() !== question.trim(),
  );
  if (!prior) return question;
  // Deterministic expansion for pronoun-heavy follow-ups — not LLM rewrite.
  const combined = `${prior.trim()}\n${question.trim()}`;
  return combined.slice(0, 500);
}

export type HistoryTurn = {
  role: 'USER' | 'ASSISTANT';
  content: string;
};

export function selectBoundedHistory(
  messages: HistoryTurn[],
  options?: { maxMessages?: number; maxChars?: number },
): HistoryTurn[] {
  const maxMessages = Math.max(
    0,
    options?.maxMessages ??
      Math.floor(readFloatEnv('ASK_HISTORY_MAX_MESSAGES', 8)),
  );
  const maxChars = Math.max(
    200,
    options?.maxChars ??
      Math.floor(readFloatEnv('ASK_HISTORY_MAX_CHARS', 4000)),
  );

  if (maxMessages === 0 || messages.length === 0) return [];

  const recent = messages.slice(-maxMessages);
  const out: HistoryTurn[] = [];
  let used = 0;
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    const item = recent[i];
    const content = item.content.replace(/\s+/g, ' ').trim();
    if (!content) continue;
    if (used + content.length > maxChars && out.length > 0) break;
    let clipped = content;
    if (used + content.length > maxChars) {
      clipped = content.slice(0, Math.max(0, maxChars - used)).trimEnd();
      if (!clipped) break;
    }
    out.push({ role: item.role, content: clipped });
    used += clipped.length;
  }
  return out.reverse();
}

function readFloatEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}
