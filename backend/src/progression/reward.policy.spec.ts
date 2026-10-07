import { DefaultRewardPolicy } from './reward.policy';

describe('DefaultRewardPolicy', () => {
  const policy = new DefaultRewardPolicy();

  it('awards a quiet base most of the time', () => {
    const roll = policy.roll('CAPTURE', () => 0.9);
    expect(roll).toEqual({ xp: 10, keeps: 0, multiplier: 1, bonus: false });
  });

  it('sometimes rolls a higher-tier bonus', () => {
    const values = [0.01, 0.5];
    const roll = policy.roll('CAPTURE', () => values.shift() ?? 1);
    expect(roll.bonus).toBe(true);
    expect(roll.multiplier).toBe(2);
    expect(roll.xp).toBe(20);
    expect(roll.keeps).toBe(1);
  });

  it('can roll a rare triple bonus', () => {
    const values = [0.01, 0.1];
    const roll = policy.roll('CAPTURE', () => values.shift() ?? 1);
    expect(roll.multiplier).toBe(3);
    expect(roll.xp).toBe(30);
    expect(roll.keeps).toBe(2);
  });

  it('does not reward buying a freeze', () => {
    expect(policy.roll('FREEZE', () => 0)).toEqual({
      xp: 0,
      keeps: 0,
      multiplier: 1,
      bonus: false,
    });
  });
});
