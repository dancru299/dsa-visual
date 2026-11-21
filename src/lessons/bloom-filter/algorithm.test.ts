import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import {
  BloomFilter,
  falsePositiveRate,
  measureFalsePositive,
  positionsOf,
  traceOps,
  traceRowGroups,
} from './algorithm';

const word = fc.string({ minLength: 1, maxLength: 6 });
const setArb = fc.uniqueArray(word, { maxLength: 20 });
const mArb = fc.integer({ min: 8, max: 64 });
const kArb = fc.integer({ min: 1, max: 5 });

describe('Bloom filter', () => {
  test('không bao giờ có âm tính giả: phần tử đã thêm luôn được trả lời "có thể có"', () => {
    fc.assert(
      fc.property(setArb, mArb, kArb, (items, m, k) => {
        const bf = new BloomFilter(m, k);
        items.forEach((x) => bf.add(x));
        items.forEach((x) => expect(bf.mightContain(x)).toBe(true));
      }),
      { numRuns: 1000 },
    );
  });

  test('"chắc chắn không có" luôn đúng; "có thể có" khớp với việc mọi bit đều bật', () => {
    fc.assert(
      fc.property(setArb, word, mArb, kArb, (items, q, m, k) => {
        const bf = new BloomFilter(m, k);
        items.forEach((x) => bf.add(x));
        const maybe = bf.mightContain(q);
        if (!maybe) expect(items).not.toContain(q);
        expect(maybe).toBe(positionsOf(q, m, k).every((p) => bf.bits[p] === 1));
      }),
      { numRuns: 1000 },
    );
  });

  test('trace: mảng bit cuối cùng khớp với BloomFilter, và kết luận khớp với mightContain', () => {
    fc.assert(
      fc.property(setArb, fc.array(word, { maxLength: 6 }), mArb, kArb, (items, queries, m, k) => {
        const ops = [
          ...items.map((item) => ({ kind: 'add' as const, item })),
          ...queries.map((item) => ({ kind: 'check' as const, item })),
        ];
        const frames = traceOps(m, k, ops);
        const bf = new BloomFilter(m, k);
        items.forEach((x) => bf.add(x));
        expect(frames.at(-1)!.state.bits).toEqual(bf.bits);
        for (const f of frames) {
          const e = f.event;
          if (e.kind === 'verdict') {
            expect(e.verdict === 'maybe').toBe(bf.mightContain(e.item));
            expect(e.truth).toBe(items.includes(e.item));
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  test('row group: bỏ qua chỉ khi chắc chắn không có, và đọc thì thấy đúng sự thật', () => {
    fc.assert(
      fc.property(fc.array(setArb, { minLength: 1, maxLength: 5 }), word, (sets, q) => {
        const groups = sets.map((keys, i) => ({ name: `rg${i + 1}`, keys }));
        for (const f of traceRowGroups(groups, q, 32, 3)) {
          const e = f.event;
          if (e.kind === 'check' && e.verdict === 'absent')
            expect(groups[e.group].keys).not.toContain(q);
          if (e.kind === 'read') expect(e.found).toBe(groups[e.group].keys.includes(q));
        }
      }),
      { numRuns: 500 },
    );
  });

  test('tỉ lệ dương tính giả đo được gần với công thức khi filter đủ lớn', () => {
    for (const b of [4, 8, 10]) {
      const k = Math.round(b * Math.LN2);
      const measured = measureFalsePositive(1000 * b, k, 1000, 5000).rate;
      const formula = falsePositiveRate(1000 * b, k, 1000);
      expect(Math.abs(measured - formula)).toBeLessThan(0.02);
    }
  });
});
