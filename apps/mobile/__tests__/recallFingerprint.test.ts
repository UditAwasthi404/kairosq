import {
  normalizeRecallText,
  recallFingerprint,
  shouldCoalesce,
  textRelation,
  isMeaningfulRecallText,
  unionRecallLines,
  simulateEventAggregator,
  assembleOcrReadingOrder,
} from '../lib/recallFingerprint';

describe('recallFingerprint', () => {
  it('normalizes whitespace and case', () => {
    expect(normalizeRecallText('  Hello   WORLD ')).toBe('hello world');
  });

  it('is deterministic for same content + package', () => {
    const a = recallFingerprint('Hybrid retrieval notes', 'com.github.android');
    const b = recallFingerprint('Hybrid retrieval notes', 'com.github.android');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('changes when package changes', () => {
    const a = recallFingerprint('same text', 'com.a');
    const b = recallFingerprint('same text', 'com.b');
    expect(a).not.toBe(b);
  });

  it('coalesces exact duplicates only (not same-app window)', () => {
    const text = 'Pull request review notes here';
    const open = {
      appPackage: 'com.github.android',
      text,
      fingerprint: recallFingerprint(text, 'com.github.android'),
      startedAtMs: 1_000,
    };
    expect(
      shouldCoalesce({
        open,
        appPackage: 'com.github.android',
        text,
        nowMs: 30_000,
      }),
    ).toBe(true);
    expect(
      shouldCoalesce({
        open,
        appPackage: 'com.github.android',
        text: 'Completely different pull request body with more words',
        nowMs: 30_000,
      }),
    ).toBe(false);
  });
});

describe('textRelation / aggregation (memory quality)', () => {
  const amazonSearch = [
    'Amazon',
    'Search Amazon',
    'wireless earbuds',
    'Submit search',
  ].join('\n');

  const amazonResults = [
    'Amazon',
    'Results for wireless earbuds',
    'boAt Airdopes 141',
    '₹1,299',
    'Noise Buds VS104',
    '₹1,499',
    '4.3 stars',
  ].join('\n');

  const productTop = [
    'Amazon',
    'boAt Nirvana Ion',
    'Wireless Earbuds with ANC',
    '₹1,299',
    '4.4 stars',
    'Add to Cart',
  ].join('\n');

  const productScrollFeatures = [
    'boAt Nirvana Ion',
    'Active Noise Cancellation',
    'Up to 40 hours playback',
    'IPX5 water resistant',
    'Bluetooth 5.2',
  ].join('\n');

  const productScrollReviews = [
    'Customer reviews',
    'Great battery life on these earbuds',
    'ANC works well on flights',
    '4.4 out of 5',
  ].join('\n');

  it('CASE A: Amazon search → results → product → scroll keeps multiple states', () => {
    const events = simulateEventAggregator([
      { text: amazonSearch, appPackage: 'in.amazon.mShop.android.shopping', nowMs: 1_000 },
      { text: amazonResults, appPackage: 'in.amazon.mShop.android.shopping', nowMs: 5_000 },
      { text: productTop, appPackage: 'in.amazon.mShop.android.shopping', nowMs: 10_000 },
      {
        text: productScrollFeatures,
        appPackage: 'in.amazon.mShop.android.shopping',
        nowMs: 14_000,
      },
      {
        text: productScrollReviews,
        appPackage: 'in.amazon.mShop.android.shopping',
        nowMs: 18_000,
      },
    ]);

    expect(events.length).toBeGreaterThanOrEqual(2);
    const joined = events.map((e) => e.extractedText).join('\n---\n');
    expect(joined.toLowerCase()).toMatch(/wireless earbuds/);
    expect(joined).toMatch(/boAt|Nirvana|1,?299|ANC|reviews/i);
    // Must not collapse to a single low-info "Amazon" blob.
    expect(joined.trim().length).toBeGreaterThan(80);
  });

  it('CASE B: same screen for 30s does not flood duplicates', () => {
    const snaps = Array.from({ length: 15 }, (_, i) => ({
      text: productTop,
      appPackage: 'in.amazon.mShop.android.shopping',
      nowMs: 1_000 + i * 2_000,
    }));
    const events = simulateEventAggregator(snaps);
    expect(events).toHaveLength(1);
    expect(events[0].extractedText).toContain('boAt Nirvana Ion');
  });

  it('CASE C: same URL/app but major scroll OCR is retained', () => {
    const events = simulateEventAggregator([
      { text: productTop, appPackage: 'com.amazon.mShop.android.shopping', nowMs: 1_000 },
      {
        text: productScrollFeatures,
        appPackage: 'com.amazon.mShop.android.shopping',
        nowMs: 4_000,
      },
      {
        text: productScrollReviews,
        appPackage: 'com.amazon.mShop.android.shopping',
        nowMs: 7_000,
      },
    ]);
    const joined = events.map((e) => e.extractedText).join('\n');
    expect(joined).toMatch(/1,?299|Nirvana/i);
    expect(joined).toMatch(/Active Noise Cancellation|40 hours|Customer reviews/i);
  });

  it('CASE D: app change creates a new event boundary', () => {
    const chromePage = [
      'Chrome',
      'kairos.dev documentation',
      'Hybrid retrieval architecture',
      'OpenAPI reference',
    ].join('\n');
    const events = simulateEventAggregator([
      { text: amazonSearch, appPackage: 'in.amazon.mShop.android.shopping', nowMs: 1_000 },
      { text: chromePage, appPackage: 'com.android.chrome', nowMs: 3_000 },
    ]);
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.some((e) => /wireless earbuds/i.test(e.extractedText))).toBe(true);
    expect(events.some((e) => /Hybrid retrieval/i.test(e.extractedText))).toBe(true);
  });

  it('CASE E: tiny visual animation with no text change stays duplicate', () => {
    expect(textRelation(productTop, productTop)).toBe('DUPLICATE');
    const events = simulateEventAggregator([
      { text: productTop, nowMs: 1_000 },
      { text: productTop, nowMs: 1_200 },
      { text: productTop, nowMs: 1_400 },
    ]);
    expect(events).toHaveLength(1);
  });

  it('CASE F: search query change survives as material change', () => {
    const q1 = ['Amazon', 'Search', 'wireless earbuds', 'Recent searches'].join('\n');
    const q2 = ['Amazon', 'Search', 'bluetooth headphones', 'Recent searches'].join('\n');
    expect(textRelation(q1, q2)).toBe('MATERIAL');
    const events = simulateEventAggregator([
      { text: q1, appPackage: 'in.amazon.mShop.android.shopping', nowMs: 1_000 },
      { text: q2, appPackage: 'in.amazon.mShop.android.shopping', nowMs: 4_000 },
    ]);
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.some((e) => /wireless earbuds/i.test(e.extractedText))).toBe(true);
    expect(events.some((e) => /bluetooth headphones/i.test(e.extractedText))).toBe(true);
  });

  it('rejects low-information chrome-only text', () => {
    expect(isMeaningfulRecallText('Amazon')).toBe(false);
    expect(isMeaningfulRecallText('Chrome')).toBe(false);
    expect(isMeaningfulRecallText('Screen changed')).toBe(false);
  });

  it('unionLines preserves unique content without inventing facts', () => {
    const merged = unionRecallLines(
      'Amazon\nwireless earbuds',
      'boAt Nirvana\n₹1,299\n4.4 stars',
    );
    expect(merged).toContain('wireless earbuds');
    expect(merged).toContain('boAt Nirvana');
    expect(merged).toContain('₹1,299');
    expect(merged).not.toMatch(/invented|probably|likely/i);
  });

  it('search query survives aggregation as its own state', () => {
    const events = simulateEventAggregator([
      {
        text: ['Amazon', 'Search', 'wireless earbuds', 'Recent searches'].join('\n'),
        appPackage: 'in.amazon.mShop.android.shopping',
        nowMs: 1_000,
      },
      {
        text: amazonResults,
        appPackage: 'in.amazon.mShop.android.shopping',
        nowMs: 5_000,
      },
    ]);
    expect(events.some((e) => /wireless earbuds/i.test(e.extractedText))).toBe(true);
    expect(events.some((e) => /boAt Airdopes|Noise Buds|1,?299/i.test(e.extractedText))).toBe(
      true,
    );
  });

  it('product title and price survive into stored events', () => {
    const events = simulateEventAggregator([
      { text: amazonResults, appPackage: 'in.amazon.mShop.android.shopping', nowMs: 1_000 },
      { text: productTop, appPackage: 'in.amazon.mShop.android.shopping', nowMs: 6_000 },
    ]);
    const joined = events.map((e) => e.extractedText).join('\n');
    expect(joined).toMatch(/boAt Nirvana Ion/i);
    expect(joined).toMatch(/1,?299/);
    expect(joined).toMatch(/Wireless Earbuds with ANC|Add to Cart/i);
    expect(textRelation(amazonResults, productTop)).toBe('MATERIAL');
  });

  it('scrolling creates related merge that keeps features without flooding', () => {
    expect(textRelation(productTop, productScrollFeatures)).toBe('RELATED_SCROLL');
    const events = simulateEventAggregator([
      { text: productTop, appPackage: 'com.amazon.mShop.android.shopping', nowMs: 1_000 },
      {
        text: productScrollFeatures,
        appPackage: 'com.amazon.mShop.android.shopping',
        nowMs: 3_000,
      },
      {
        text: productScrollFeatures,
        appPackage: 'com.amazon.mShop.android.shopping',
        nowMs: 3_500,
      },
    ]);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events.length).toBeLessThanOrEqual(2);
    const joined = events.map((e) => e.extractedText).join('\n');
    expect(joined).toMatch(/Active Noise Cancellation|40 hours/i);
    expect(joined).toMatch(/Nirvana|1,?299/i);
  });

  it('same app different screens do not incorrectly coalesce', () => {
    expect(textRelation(amazonSearch, productTop)).toBe('MATERIAL');
    const events = simulateEventAggregator([
      { text: amazonSearch, appPackage: 'in.amazon.mShop.android.shopping', nowMs: 1_000 },
      { text: productTop, appPackage: 'in.amazon.mShop.android.shopping', nowMs: 4_000 },
    ]);
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.map((e) => e.fingerprint).every((fp, i, arr) => arr.indexOf(fp) === i)).toBe(
      true,
    );
  });

  it('tiny visual changes without text change do not create excessive events', () => {
    const events = simulateEventAggregator(
      Array.from({ length: 20 }, (_, i) => ({
        text: productTop,
        appPackage: 'in.amazon.mShop.android.shopping',
        nowMs: 1_000 + i * 400,
      })),
    );
    expect(events).toHaveLength(1);
  });

  it('OCR text ordering is preserved top-to-bottom left-to-right', () => {
    const text = assembleOcrReadingOrder([
      {
        top: 200,
        left: 10,
        lines: [
          { top: 220, left: 12, text: '₹1,299' },
          { top: 200, left: 12, text: 'boAt Nirvana Ion' },
        ],
      },
      {
        top: 40,
        left: 8,
        lines: [{ top: 40, left: 8, text: 'Amazon' }],
      },
    ]);
    expect(text.split('\n')[0]).toBe('Amazon');
    expect(text).toContain('boAt Nirvana Ion');
    expect(text.indexOf('boAt Nirvana Ion')).toBeLessThan(text.indexOf('₹1,299'));
  });
});
