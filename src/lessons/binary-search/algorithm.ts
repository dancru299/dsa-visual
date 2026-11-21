/**
 * Binary search trên mảng đã sort tăng dần, không có phần tử trùng.
 * Trả về index của target, hoặc -1 nếu target không có trong mảng.
 *
 * Phase 1 sẽ viết lại hàm này để suy ra từ trace. Test trong algorithm.test.ts giữ nguyên
 * và phải vẫn xanh sau khi viết lại.
 */
export function binarySearch(arr: readonly number[], target: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}
