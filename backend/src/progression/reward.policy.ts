export type ProgressionActionKind = 'CAPTURE' | 'ASK' | 'RECALL' | 'FREEZE';

export type RewardRoll = {
  xp: number;
  keeps: number;
  multiplier: number;
  bonus: boolean;
};

/**
 * Swappable reward math. Default implementation is occasional and unpredictable —
 * most actions award a quiet base, a small slice rolls a higher tier.
 */
export interface RewardPolicy {
  roll(action: ProgressionActionKind, rng?: () => number): RewardRoll;
}

const BASE_XP: Record<ProgressionActionKind, number> = {
  CAPTURE: 10,
  ASK: 4,
  RECALL: 2,
  FREEZE: 0,
};

/** Chance the action becomes a visible bonus instead of a quiet tick. */
const BONUS_CHANCE: Record<ProgressionActionKind, number> = {
  CAPTURE: 0.12,
  ASK: 0.08,
  RECALL: 0.05,
  FREEZE: 0,
};

export class DefaultRewardPolicy implements RewardPolicy {
  roll(action: ProgressionActionKind, rng: () => number = Math.random): RewardRoll {
    const base = BASE_XP[action];
    if (base <= 0) {
      return { xp: 0, keeps: 0, multiplier: 1, bonus: false };
    }

    const chance = BONUS_CHANCE[action];
    if (rng() >= chance) {
      return { xp: base, keeps: 0, multiplier: 1, bonus: false };
    }

    const tier = rng();
    const multiplier = tier < 0.2 ? 3 : 2;
    return {
      xp: base * multiplier,
      keeps: multiplier === 3 ? 2 : 1,
      multiplier,
      bonus: true,
    };
  }
}

export const REWARD_POLICY = Symbol('REWARD_POLICY');
