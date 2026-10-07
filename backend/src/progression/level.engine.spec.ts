import { levelFromXp, xpForLevel } from './level.engine';

describe('levelFromXp', () => {
  it('starts at level 1', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(xpForLevel(1)).toBe(0);
  });

  it('reaches level 2 at 80 xp', () => {
    expect(levelFromXp(79).level).toBe(1);
    expect(levelFromXp(80).level).toBe(2);
    expect(levelFromXp(80).intoLevel).toBe(0);
  });
});
