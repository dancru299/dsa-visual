import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { nestedLoopJoin } from '../big-o/algorithm';
import { merge, mergeJoin, mergeSort, traceMergeSort, traceSplit } from './algorithm';

const nums = fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 40 });
const sorted = nums.map((xs) => [...xs].sort((a, b) => a - b));

describe('merge sort', () => {
  test('ví dụ trong bài', () => {
    expect(mergeSort([38, 27, 43, 3, 9, 82, 10, 15])).toEqual([3, 9, 10, 15, 27, 38, 43, 82]);
  });

  test('khớp với Array.prototype.sort trên mọi mảng, kể cả rỗng và có phần tử trùng', () => {
    fc.assert(
      fc.property(nums, (xs) => {
        expect(mergeSort(xs)).toEqual([...xs].sort((a, b) => a - b));
      }),
      { numRuns: 1000 },
    );
  });

  test('trộn hai dãy đã sort cho ra một dãy đã sort gồm đủ phần tử của cả hai', () => {
    fc.assert(
      fc.property(sorted, sorted, (a, b) => {
        expect(merge(a, b)).toEqual([...a, ...b].sort((x, y) => x - y));
      }),
      { numRuns: 1000 },
    );
  });

  test('số tầng là ⌈log₂ n⌉ + 1, và số lần so sánh không vượt quá n · ⌈log₂ n⌉', () => {
    fc.assert(
      fc.property(
        nums.filter((xs) => xs.length > 1),
        (xs) => {
          const levels = Math.ceil(Math.log2(xs.length));
          const last = traceMergeSort(xs).at(-1)!.state;
          expect(last.rows).toHaveLength(levels + 1);
          expect(last.comparisons).toBeLessThanOrEqual(xs.length * levels);
        },
      ),
      { numRuns: 500 },
    );
  });

  test('mỗi nhóm trên mỗi tầng đều đã sort khi trộn xong', () => {
    fc.assert(
      fc.property(nums, (xs) => {
        for (const row of traceMergeSort(xs).at(-1)!.state.rows) {
          for (const g of row) expect(g.values).toEqual([...g.values].sort((a, b) => a - b));
        }
      }),
      { numRuns: 300 },
    );
  });

  test('chia đôi 8 phần tử ra 3 tầng con, tầng cuối là 8 nhóm 1 phần tử', () => {
    const last = traceSplit([38, 27, 43, 3, 9, 82, 10, 15]).at(-1)!.state;
    expect(last.rows.map((r) => r.length)).toEqual([1, 2, 4, 8]);
  });
});

describe('sort-merge join', () => {
  const uniqueSorted = fc
    .uniqueArray(fc.integer({ min: 0, max: 9 }), { maxLength: 8 })
    .map((xs) => [...xs].sort((a, b) => a - b));
  const pairsOf = (ps: [number, number][]) => ps.map((p) => p.join(':')).sort();

  test('cho cùng các cặp như nested loop join, khi khoá bên phải không trùng', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 9 }), { maxLength: 10 }),
        uniqueSorted,
        (l, r) => {
          const left = [...l].sort((a, b) => a - b);
          expect(pairsOf(mergeJoin(left, r))).toEqual(pairsOf(nestedLoopJoin(left, r)));
        },
      ),
      { numRuns: 1000 },
    );
  });
});
