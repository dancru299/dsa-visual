import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import {
  build,
  contains,
  heightOf,
  inorderKeys,
  isBTree,
  MAX_KEYS,
  minHeight,
  traceInsert,
} from './algorithm';

const keysArb = fc.uniqueArray(fc.integer({ min: 1, max: 500 }), { maxLength: 60 });
const sortUp = (xs: readonly number[]) => [...xs].sort((a, b) => a - b);

describe('B-tree', () => {
  test('chèn theo thứ tự bất kỳ: vẫn là B-tree và giữ đủ mọi khoá', () => {
    fc.assert(
      fc.property(keysArb, (keys) => {
        const tree = build(keys);
        expect(isBTree(tree)).toBe(true);
        expect(inorderKeys(tree)).toEqual(sortUp(keys));
      }),
      { numRuns: 1000 },
    );
  });

  test('tìm kiếm khớp với việc dò cả list', () => {
    fc.assert(
      fc.property(keysArb, fc.integer({ min: 0, max: 501 }), (keys, t) => {
        expect(contains(keys, t)).toBe(keys.includes(t));
      }),
      { numRuns: 1000 },
    );
  });

  test('chiều cao không dưới mức tối thiểu và không quá log₂(n + 1), kể cả khi chèn đã sort', () => {
    fc.assert(
      fc.property(keysArb, (keys) => {
        for (const order of [keys, sortUp(keys)]) {
          const h = heightOf(build(order));
          expect(h).toBeGreaterThanOrEqual(minHeight(order.length, MAX_KEYS));
          expect(h).toBeLessThanOrEqual(Math.max(1, Math.floor(Math.log2(order.length + 1))));
        }
      }),
      { numRuns: 1000 },
    );
  });

  test('mọi frame của trace chèn: nhiều nhất một node tràn, tràn đúng một khoá, và hết tràn khi xong', () => {
    fc.assert(
      fc.property(keysArb, (keys) => {
        for (const f of traceInsert([], keys)) {
          const big = f.state.nodes.filter((n) => n.keys.length > MAX_KEYS);
          expect(big.length).toBeLessThanOrEqual(1);
          for (const n of big) expect(n.keys.length).toBe(MAX_KEYS + 1);
          // Sau một lần tách, node cha có thể tràn tiếp; frame overflow kế tiếp sẽ tách nó.
          if (f.event.kind === 'done') expect(big).toEqual([]);
        }
      }),
      { numRuns: 500 },
    );
  });

  test('tách: khoá giữa đi lên, nửa trái nhỏ hơn nó, nửa phải lớn hơn nó', () => {
    fc.assert(
      fc.property(keysArb, (keys) => {
        for (const f of traceInsert([], keys)) {
          const e = f.event;
          if (e.kind !== 'split') continue;
          e.left.forEach((k) => expect(k).toBeLessThan(e.up));
          e.right.forEach((k) => expect(k).toBeGreaterThan(e.up));
          expect(e.left.length + e.right.length + 1).toBe(MAX_KEYS + 1);
        }
      }),
      { numRuns: 500 },
    );
  });

  test('minHeight khớp với công thức (m + 1)^h − 1', () => {
    expect(minHeight(1e9, 1)).toBe(30);
    expect(minHeight(1e9, 3)).toBe(15);
    expect(minHeight(1e9, 300)).toBe(4);
    expect(minHeight(1000, 1)).toBe(10);
  });
});
