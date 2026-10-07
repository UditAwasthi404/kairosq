export type CosmeticUnlock = {
  key: string;
  kind: 'title' | 'aura' | 'freeze';
  label: string;
  streakAt: number;
  streakGated: boolean;
};

export const COSMETIC_CATALOG: CosmeticUnlock[] = [
  { key: 'title.present', kind: 'title', label: 'Present', streakAt: 3, streakGated: true },
  { key: 'aura.warm', kind: 'aura', label: 'Warm', streakAt: 7, streakGated: true },
  { key: 'freeze.week', kind: 'freeze', label: 'A freeze', streakAt: 7, streakGated: false },
  { key: 'title.keeper', kind: 'title', label: 'Keeper', streakAt: 14, streakGated: true },
  { key: 'freeze.fortnight', kind: 'freeze', label: 'A freeze', streakAt: 14, streakGated: false },
  { key: 'aura.deep', kind: 'aura', label: 'Deep', streakAt: 30, streakGated: true },
];

export const FREEZE_KEEP_COST = 25;

export function unlocksForStreak(streak: number): CosmeticUnlock[] {
  return COSMETIC_CATALOG.filter((item) => streak >= item.streakAt);
}

export function cosmeticLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return COSMETIC_CATALOG.find((item) => item.key === key)?.label ?? null;
}
