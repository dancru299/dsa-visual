import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import {
  balancedHeight,
  build,
  contains,
  heightOf,
  inorder,
  isBst,
  rangeQuery,
  shuffled,
  traceInsert,
  traceRange,
} from './algorithm';

const keysArb = fc.uniqueArray(fc.integer({ min: 1, max: 99 }), { maxLength: 30 });
const sortUp = (xs: readonly number[]) => [...xs].sort((a, b) => a - b);

describe('cây tìm kiếm nhị phân', () => {
  test('chèn theo thứ tự bất kỳ vẫn giữ quy tắc trái < node < phải', () => {
    fc.assert(
      fc.property(keysArb, (keys) => {
        expect(isBst(build(keys))).toBe(true);
      }),
      { numRuns: 1000 },
    );
  });

  test('duyệt in-order ra đúng các khoá theo thứ tự tăng dần', () => {
    fc.assert(
      fc.property(keysArb, (keys) => {
        expect(inorder(keys)).toEqual(sortUp(keys));
      }),
      { numRuns: 1000 },
    );
  });

  test('tìm kiếm khớp với việc dò cả list', () => {
    fc.assert(
      fc.property(keysArb, fc.integer({ min: 0, max: 100 }), (keys, t) => {
        expect(contains(keys, t)).toBe(keys.includes(t));
      }),
      { numRuns: 1000 },
    );
  });

  test('truy vấn khoảng khớp với lọc cả list, và nhánh bỏ qua không chứa khoá nào trong khoảng', () => {
    fc.assert(
      fc.property(keysArb, fc.integer({ min: 0, max: 100 }), fc.nat(40), (keys, lo, width) => {
        const hi = lo + width;
        expect(rangeQuery(keys, lo, hi)).toEqual(sortUp(keys.filter((k) => lo <= k && k <= hi)));
        const pruned = traceRange(keys, lo, hi).at(-1)!.state.pruned;
        pruned.forEach((k) => expect(k < lo || k > hi).toBe(true));
      }),
      { numRuns: 1000 },
    );
  });

  test('mỗi lần chèn so đúng bằng độ sâu của chỗ được gắn vào', () => {
    fc.assert(
      fc.property(keysArb, (keys) => {
        let compares = 0;
        for (const f of traceInsert([], keys)) {
          if (f.event.kind === 'compare') compares++;
          const e = f.event;
          if (e.kind === 'insert') {
            const node = f.state.nodes.find((n) => n.key === e.key)!;
            expect(compares).toBe(node.depth);
            compares = 0;
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  test('chiều cao nằm giữa cây cân bằng và cây thành chuỗi; chèn đã sort thì thành chuỗi', () => {
    fc.assert(
      fc.property(keysArb, (keys) => {
        const h = heightOf(build(keys));
        expect(h).toBeGreaterThanOrEqual(balancedHeight(keys.length));
        expect(h).toBeLessThanOrEqual(keys.length);
        expect(heightOf(build(sortUp(keys)))).toBe(keys.length);
      }),
      { numRuns: 1000 },
    );
  });

  test('shuffled là một hoán vị của 1..n và cố định theo seed', () => {
    const a = shuffled(50, 7);
    expect(sortUp(a)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    expect(shuffled(50, 7)).toEqual(a);
  });
});
