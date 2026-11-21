import type { Frame } from '@/src/engine/types';

// Algorithm chỉ ghi state và event. Lời dẫn, số dòng code và câu đoán nằm trong lesson.tsx.

export type Cell = 'idle' | 'scan' | 'seen' | 'mid' | 'out' | 'found'; // scan, seen dùng cho linear search

// State chung cho mọi scene "dãy khối". Linear search không có lo, hi nên để null.
export type TrackState = {
  arr: number[];
  target: number;
  cells: Cell[];
  focus: number | null; // ô đang được xét
  lo: number | null;
  hi: number | null;
  comparisons: number;
  result: number | null; // null khi chưa xong; sau đó là index tìm được hoặc -1
};

export type BSState = TrackState & { lo: number; hi: number };

export type BSEvent =
  | { kind: 'start' }
  | { kind: 'compare'; iteration: number; mid: number }
  | { kind: 'found'; mid: number }
  | { kind: 'go-right'; mid: number } // arr[mid] < target → lo = mid + 1
  | { kind: 'go-left'; mid: number } // arr[mid] > target → hi = mid - 1
  | { kind: 'not-found' };

export function traceBinarySearch(
  arr: readonly number[],
  target: number,
): Frame<BSState, BSEvent>[] {
  const frames: Frame<BSState, BSEvent>[] = [];
  const s: BSState = {
    arr: [...arr],
    target,
    cells: arr.map((): Cell => 'idle'),
    focus: null,
    lo: 0,
    hi: arr.length - 1,
    comparisons: 0,
    result: null,
  };
  // structuredClone: mỗi frame giữ bản sao riêng. Thiếu nó, mọi frame trỏ vào cùng một object.
  const snap = (event: BSEvent) => frames.push({ state: structuredClone(s), event });

  snap({ kind: 'start' });
  while (s.lo <= s.hi) {
    const mid = (s.lo + s.hi) >> 1;
    s.cells[mid] = 'mid';
    s.focus = mid;
    s.comparisons++;
    snap({ kind: 'compare', iteration: s.comparisons, mid });
    if (arr[mid] === target) {
      s.cells[mid] = 'found';
      s.result = mid;
      snap({ kind: 'found', mid });
      return frames;
    }
    if (arr[mid] < target) {
      for (let i = s.lo; i <= mid; i++) s.cells[i] = 'out';
      s.lo = mid + 1;
      snap({ kind: 'go-right', mid });
    } else {
      for (let i = mid; i <= s.hi; i++) s.cells[i] = 'out';
      s.hi = mid - 1;
      snap({ kind: 'go-left', mid });
    }
  }
  s.result = -1;
  snap({ kind: 'not-found' });
  return frames;
}

// Hàm mà property test kiểm tra. Nó suy ra từ chính trace được hiển thị,
// không phải một bản binary search viết riêng.
export function binarySearch(arr: readonly number[], target: number): number {
  return traceBinarySearch(arr, target).at(-1)!.state.result!;
}

export type LinearEvent =
  | { kind: 'start' }
  | { kind: 'compare'; i: number }
  | { kind: 'found'; i: number }
  | { kind: 'not-found' };

export function traceLinearSearch(
  arr: readonly number[],
  target: number,
): Frame<TrackState, LinearEvent>[] {
  const frames: Frame<TrackState, LinearEvent>[] = [];
  const s: TrackState = {
    arr: [...arr],
    target,
    cells: arr.map((): Cell => 'idle'),
    focus: null,
    lo: null,
    hi: null,
    comparisons: 0,
    result: null,
  };
  const snap = (event: LinearEvent) => frames.push({ state: structuredClone(s), event });

  snap({ kind: 'start' });
  for (let i = 0; i < arr.length; i++) {
    if (i > 0) s.cells[i - 1] = 'seen';
    s.cells[i] = 'scan';
    s.focus = i;
    s.comparisons++;
    if (arr[i] === target) {
      s.cells[i] = 'found';
      s.result = i;
      snap({ kind: 'found', i });
      return frames;
    }
    snap({ kind: 'compare', i });
  }
  if (arr.length > 0) s.cells[arr.length - 1] = 'seen';
  s.result = -1;
  snap({ kind: 'not-found' });
  return frames;
}

export function linearSearch(arr: readonly number[], target: number): number {
  return traceLinearSearch(arr, target).at(-1)!.state.result!;
}

// Số lần so sánh tệ nhất của binary search với n phần tử: ⌊log₂ n⌋ + 1.
export const worstCaseBinary = (n: number) => (n < 1 ? 0 : Math.floor(Math.log2(n)) + 1);

export type HalvingState = {
  n: number;
  sizes: number[]; // n, n/2, n/4, ... 1
  shown: number; // số hàng của bậc thang đang hiện
  table: { n: number; linear: number; binary: number }[];
  tableShown: number;
};

export type HalvingEvent =
  { kind: 'start' } | { kind: 'halve'; size: number } | { kind: 'row'; n: number };

// Chia đôi n tới khi còn 1, rồi lần lượt hiện bảng so sánh với các n lớn hơn.
export function traceHalving(
  n: number,
  bigNs: readonly number[],
): Frame<HalvingState, HalvingEvent>[] {
  const sizes: number[] = [];
  for (let size = n; size >= 1; size = Math.floor(size / 2)) sizes.push(size);
  const s: HalvingState = {
    n,
    sizes,
    shown: 0,
    table: bigNs.map((m) => ({ n: m, linear: m, binary: worstCaseBinary(m) })),
    tableShown: 0,
  };
  const frames: Frame<HalvingState, HalvingEvent>[] = [];
  const snap = (event: HalvingEvent) => frames.push({ state: structuredClone(s), event });

  snap({ kind: 'start' });
  for (let k = 0; k < sizes.length; k++) {
    s.shown = k + 1;
    snap({ kind: 'halve', size: sizes[k] });
  }
  for (let r = 0; r < bigNs.length; r++) {
    s.tableShown = r + 1;
    snap({ kind: 'row', n: bigNs[r] });
  }
  return frames;
}
