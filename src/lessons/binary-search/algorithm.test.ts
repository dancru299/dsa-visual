import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import {
  binarySearch,
  linearSearch,
  traceBinarySearch,
  traceHalving,
  traceLinearSearch,
  worstCaseBinary,
} from './algorithm';

// Mảng dùng trong bài học.
const ARR = [3, 8, 12, 17, 21, 26, 34, 41, 47, 55, 62, 66, 73, 80, 88, 95];

const sortedUnique = fc
  .uniqueArray(fc.integer({ min: -1000, max: 1000 }))
  .map((xs) => [...xs].sort((a, b) => a - b));

const withMember = sortedUnique
  .filter((arr) => arr.length > 0)
  .chain((arr) => fc.tuple(fc.constant(arr), fc.constantFrom(...arr)));

describe('binarySearch', () => {
  test('tìm thấy 73 ở index 12, như bước 5 của bài', () => {
    expect(binarySearch(ARR, 73)).toBe(12);
  });

  test('trả về -1 khi không có 50, như bước 6 của bài', () => {
    expect(binarySearch(ARR, 50)).toBe(-1);
  });

  test('mảng rỗng và mảng một phần tử', () => {
    expect(binarySearch([], 1)).toBe(-1);
    expect(binarySearch([7], 7)).toBe(0);
    expect(binarySearch([7], 8)).toBe(-1);
  });

  test('khớp với indexOf trên mảng đã sort', () => {
    fc.assert(
      fc.property(sortedUnique, fc.integer({ min: -1000, max: 1000 }), (arr, target) => {
        expect(binarySearch(arr, target)).toBe(arr.indexOf(target));
      }),
      { numRuns: 1000 },
    );
  });

  // Với target ngẫu nhiên trong [-1000, 1000], gần như mọi lần chạy ở test trên đều rơi vào
  // trường hợp không tìm thấy. Test này buộc target nằm trong mảng để nhánh "tìm thấy" cũng
  // được thử hàng nghìn lần.
  test('luôn tìm thấy phần tử có trong mảng', () => {
    fc.assert(
      fc.property(withMember, ([arr, target]) => {
        expect(arr[binarySearch(arr, target)]).toBe(target);
      }),
      { numRuns: 1000 },
    );
  });

  test('số lần so sánh không vượt quá ⌊log₂ n⌋ + 1', () => {
    fc.assert(
      fc.property(sortedUnique, fc.integer({ min: -1000, max: 1000 }), (arr, target) => {
        const last = traceBinarySearch(arr, target).at(-1)!.state;
        expect(last.comparisons).toBeLessThanOrEqual(worstCaseBinary(arr.length));
      }),
      { numRuns: 1000 },
    );
  });
});

describe('trace của binary search', () => {
  test('khoảng [lo..hi] chỉ co lại, không bao giờ nở ra', () => {
    fc.assert(
      fc.property(sortedUnique, fc.integer({ min: -1000, max: 1000 }), (arr, target) => {
        const frames = traceBinarySearch(arr, target);
        for (let i = 1; i < frames.length; i++) {
          const prev = frames[i - 1].state;
          const cur = frames[i].state;
          expect(cur.lo).toBeGreaterThanOrEqual(prev.lo);
          expect(cur.hi).toBeLessThanOrEqual(prev.hi);
        }
      }),
      { numRuns: 300 },
    );
  });

  test('mỗi frame giữ bản sao state riêng', () => {
    const frames = traceBinarySearch(ARR, 73);
    expect(frames[0].state.lo).toBe(0);
    expect(frames.at(-1)!.state.lo).toBe(12);
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i].state).not.toBe(frames[i - 1].state);
      expect(frames[i].state.cells).not.toBe(frames[i - 1].state.cells);
    }
  });

  test('ô đang xét ở mỗi lần so sánh đúng là mid = (lo + hi) // 2', () => {
    for (const f of traceBinarySearch(ARR, 50)) {
      if (f.event.kind !== 'compare') continue;
      expect(f.state.focus).toBe(f.event.mid);
      expect(f.event.mid).toBe(Math.floor((f.state.lo + f.state.hi) / 2));
    }
  });

  test('khi không tìm thấy, lo dừng ở vị trí cần chèn', () => {
    const last = traceBinarySearch(ARR, 50).at(-1)!.state;
    expect(last.lo).toBe(9);
    expect(last.lo).toBe(ARR.filter((x) => x < 50).length);
  });
});

describe('linearSearch', () => {
  test('cần 13 lần so sánh để tìm 73', () => {
    const last = traceLinearSearch(ARR, 73).at(-1)!.state;
    expect(last.result).toBe(12);
    expect(last.comparisons).toBe(13);
  });

  test('khớp với indexOf', () => {
    fc.assert(
      fc.property(sortedUnique, fc.integer({ min: -1000, max: 1000 }), (arr, target) => {
        expect(linearSearch(arr, target)).toBe(arr.indexOf(target));
      }),
      { numRuns: 500 },
    );
  });
});

describe('worstCaseBinary', () => {
  test('các con số trong bảng của bước 7', () => {
    expect([16, 1000, 1_000_000, 1_000_000_000].map(worstCaseBinary)).toEqual([5, 10, 20, 30]);
  });

  test('2 tỷ phần tử cần 31 lần, như đáp án câu "Thử nghĩ"', () => {
    expect(worstCaseBinary(2_000_000_000)).toBe(31);
  });

  test('16 chia đôi 4 lần thì còn 1', () => {
    const sizes = traceHalving(16, []).at(-1)!.state.sizes;
    expect(sizes).toEqual([16, 8, 4, 2, 1]);
  });
});
