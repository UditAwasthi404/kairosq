/** Cumulative XP required to reach a level. Level 1 starts at 0. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 80 * (level - 1) * (level - 1);
}

export function levelFromXp(xp: number): {
  level: number;
  xp: number;
  intoLevel: number;
  nextLevelXp: number;
  progress: number;
} {
  const safe = Math.max(0, Math.floor(xp));
  let level = 1;
  while (xpForLevel(level + 1) <= safe) {
    level += 1;
    if (level > 99) break;
  }
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = Math.max(1, next - floor);
  const intoLevel = safe - floor;
  return {
    level,
    xp: safe,
    intoLevel,
    nextLevelXp: next,
    progress: Math.min(1, intoLevel / span),
  };
}
