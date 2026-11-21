import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { binarySearch } from './algorithm';

// Mảng dùng trong bài học của bản demo.
const ARR = [3, 8, 12, 17, 21, 26, 34, 41, 47, 55, 62, 66, 73, 80, 88, 95];

const sortedUnique = fc
  .uniqueArray(fc.integer({ min: -1000, max: 1000 }))
  .map((xs) => [...xs].sort((a, b) => a - b));

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
    const withMember = sortedUnique
      .filter((arr) => arr.length > 0)
      .chain((arr) => fc.tuple(fc.constant(arr), fc.constantFrom(...arr)));

    fc.assert(
      fc.property(withMember, ([arr, target]) => {
        expect(arr[binarySearch(arr, target)]).toBe(target);
      }),
      { numRuns: 1000 },
    );
  });
});
