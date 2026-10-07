import {
  HOW_IT_WORKS_FEATURES,
  HOW_IT_WORKS_GROUPS,
  howItWorksByGroup,
  howItWorksFeature,
} from '../lib/howItWorks';

describe('how it works guide', () => {
  it('covers capture, memory, intelligence, and device groups', () => {
    expect(HOW_IT_WORKS_GROUPS.map((group) => group.id)).toEqual([
      'capture',
      'memory',
      'intelligence',
      'device',
    ]);
    expect(HOW_IT_WORKS_FEATURES.length).toBeGreaterThanOrEqual(12);
  });

  it('explains every listed feature with steps', () => {
    for (const feature of HOW_IT_WORKS_FEATURES) {
      expect(feature.title.trim().length).toBeGreaterThan(2);
      expect(feature.summary.trim().length).toBeGreaterThan(12);
      expect(feature.body.trim().length).toBeGreaterThan(24);
      expect(feature.steps.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('looks up a feature and groups related ones', () => {
    expect(howItWorksFeature('ask')?.title).toBe('Ask');
    expect(howItWorksFeature('missing')).toBeUndefined();
    expect(howItWorksByGroup('capture').some((item) => item.id === 'share')).toBe(
      true,
    );
  });
});
