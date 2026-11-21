import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import {
  formatCount,
  formatDuration,
  growthRow,
  hashJoin,
  nestedLoopJoin,
  traceDirectAccess,
  traceNestedLoopJoin,
} from './algorithm';

const key = fc.integer({ min: 0, max: 5 });
const table = fc.array(key, { maxLength: 8 });
const sortPairs = (ps: [number, number][]) =>
  [...ps].sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((p) => p.join(':'));

describe('O(1): đọc theo vị trí', () => {
  test('đúng một lần đọc, bất kể mảng dài bao nhiêu', () => {
    fc.assert(
      fc.property(fc.array(fc.integer(), { minLength: 1, maxLength: 200 }), (arr) => {
        const i = arr.length - 1;
        const last = traceDirectAccess(arr, i).at(-1)!.state;
        expect(last.comparisons).toBe(1);
        expect(last.arr[last.result!]).toBe(arr[i]);
      }),
    );
  });
});

describe('O(n²): nested loop join', () => {
  test('luôn so đúng n · m cặp', () => {
    fc.assert(
      fc.property(table, table, (l, r) => {
        expect(traceNestedLoopJoin(l, r).at(-1)!.state.comparisons).toBe(l.length * r.length);
      }),
      { numRuns: 500 },
    );
  });

  // Hash join cho cùng kết quả mà chỉ cần O(n + m): chính là lý do cơ sở dữ liệu ưu tiên nó.
  test('cho cùng các cặp khớp như hash join', () => {
    fc.assert(
      fc.property(table, table, (l, r) => {
        expect(sortPairs(nestedLoopJoin(l, r))).toEqual(sortPairs(hashJoin(l, r)));
      }),
      { numRuns: 1000 },
    );
  });

  test('cuối cùng không còn ô nào đang so dở', () => {
    fc.assert(
      fc.property(table, table, (l, r) => {
        const grid = traceNestedLoopJoin(l, r).at(-1)!.state.grid;
        expect(grid.flat().every((m) => m === 'match' || m === 'miss')).toBe(true);
      }),
      { numRuns: 300 },
    );
  });
});

describe('bảng tốc độ tăng', () => {
  test('các con số của bước 5', () => {
    expect(growthRow(1_000_000_000)).toEqual({
      n: 1_000_000_000,
      constant: 1,
      log: 30,
      linear: 1_000_000_000,
      quadratic: 1e18,
    });
  });

  test('số lớn in dạng luỹ thừa của 10', () => {
    expect(formatCount(256)).toBe('256');
    expect(formatCount(1000)).toBe('1.000');
    expect(formatCount(1e6)).toBe('10⁶');
    expect(formatCount(1e12)).toBe('10¹²');
    expect(formatCount(1e18)).toBe('10¹⁸');
  });

  test('thời gian khi mỗi bước mất 1 micro giây', () => {
    expect(formatDuration(1_000_000)).toBe('1 giây');
    expect(formatDuration(1e9)).toBe('16,7 phút');
    expect(formatDuration(1e12)).toBe('11,6 ngày');
    expect(formatDuration(1e18)).toBe('31.710 năm');
  });
});
