import type { Frame } from '@/src/engine/types';

// ---------- Cấu trúc trace dùng chung: các tầng của cây chia đôi ----------

// Một nhóm trên một tầng. values là phần đã có (khi trộn thì điền dần từ trái sang).
export type Group = { values: number[]; size: number };

export type MergeState = {
  rows: Group[][]; // rows[0] là tầng trên cùng (một nhóm cả mảng), tầng cuối là các nhóm 1 phần tử
  // Đang trộn rows[row][group] từ hai nhóm nguồn ở tầng row + 1; i, j là con trỏ trong hai nhóm đó.
  active: { row: number; group: number; i: number; j: number } | null;
  comparisons: number;
};

export type SplitEvent = { kind: 'start' } | { kind: 'split'; row: number; groups: number };

export type MergeEvent =
  | { kind: 'start' }
  | { kind: 'level'; row: number; width: number }
  | {
      kind: 'take';
      row: number;
      group: number;
      side: 'left' | 'right';
      value: number;
      compared: boolean;
    }
  | { kind: 'done' };

// Chia mảng theo các độ rộng 1, 2, 4, ... giống merge sort bottom-up. Trả về các tầng từ trên xuống.
function partition(n: number): { width: number; sizes: number[] }[] {
  const widths: number[] = [1];
  while (widths.at(-1)! < n) widths.push(widths.at(-1)! * 2);
  return widths.reverse().map((w) => {
    const sizes: number[] = [];
    for (let lo = 0; lo < Math.max(n, 1); lo += w) sizes.push(Math.max(0, Math.min(w, n - lo)));
    return { width: w, sizes };
  });
}

// Chia đôi từng tầng cho tới khi mỗi nhóm còn 1 phần tử. Chỉ là bước nhìn, chưa sort gì.
export function traceSplit(arr: readonly number[]): Frame<MergeState, SplitEvent>[] {
  const layout = partition(arr.length);
  const rowAt = (r: number): Group[] => {
    let lo = 0;
    return layout[r].sizes.map((size) => {
      const values = arr.slice(lo, lo + size);
      lo += size;
      return { values, size };
    });
  };
  const s: MergeState = { rows: [rowAt(0)], active: null, comparisons: 0 };
  const frames: Frame<MergeState, SplitEvent>[] = [];
  const snap = (event: SplitEvent) => frames.push({ state: structuredClone(s), event });
  snap({ kind: 'start' });
  for (let r = 1; r < layout.length; r++) {
    s.rows.push(rowAt(r));
    snap({ kind: 'split', row: r, groups: s.rows[r].length });
  }
  return frames;
}

// Trộn rows[row][group] từ hai nhóm nguồn ở tầng dưới. Ghi một frame cho mỗi phần tử được lấy.
function mergeInto(s: MergeState, row: number, group: number, snap: (e: MergeEvent) => void) {
  const left = s.rows[row + 1][2 * group] ?? { values: [], size: 0 };
  const right = s.rows[row + 1][2 * group + 1] ?? { values: [], size: 0 };
  const out = s.rows[row][group];
  out.values = [];
  let i = 0;
  let j = 0;
  s.active = { row, group, i, j };
  while (i < left.values.length || j < right.values.length) {
    const both = i < left.values.length && j < right.values.length;
    let side: 'left' | 'right';
    if (both) {
      s.comparisons++;
      side = left.values[i] <= right.values[j] ? 'left' : 'right';
    } else side = i < left.values.length ? 'left' : 'right';
    const value = side === 'left' ? left.values[i++] : right.values[j++];
    out.values.push(value);
    s.active = { row, group, i, j };
    snap({ kind: 'take', row, group, side, value, compared: both });
  }
}

// Merge sort bottom-up: trộn các nhóm 1 phần tử thành nhóm 2, rồi 4, rồi 8...
export function traceMergeSort(arr: readonly number[]): Frame<MergeState, MergeEvent>[] {
  const layout = partition(arr.length);
  const last = layout.length - 1;
  const s: MergeState = {
    rows: layout.map(({ sizes }, r) => {
      let lo = 0;
      return sizes.map((size) => {
        const values = r === last ? arr.slice(lo, lo + size) : [];
        lo += size;
        return { values, size };
      });
    }),
    active: null,
    comparisons: 0,
  };
  const frames: Frame<MergeState, MergeEvent>[] = [];
  const snap = (event: MergeEvent) => frames.push({ state: structuredClone(s), event });

  snap({ kind: 'start' });
  for (let r = last - 1; r >= 0; r--) {
    s.active = null;
    snap({ kind: 'level', row: r, width: layout[r].width });
    for (let g = 0; g < s.rows[r].length; g++) mergeInto(s, r, g, snap);
  }
  s.active = null;
  snap({ kind: 'done' });
  return frames;
}

// Chỉ bước trộn: hai dãy đã sort thành một.
export function traceMergeTwo(
  left: readonly number[],
  right: readonly number[],
): Frame<MergeState, MergeEvent>[] {
  const s: MergeState = {
    rows: [
      [{ values: [], size: left.length + right.length }],
      [
        { values: [...left], size: left.length },
        { values: [...right], size: right.length },
      ],
    ],
    active: null,
    comparisons: 0,
  };
  const frames: Frame<MergeState, MergeEvent>[] = [];
  const snap = (event: MergeEvent) => frames.push({ state: structuredClone(s), event });
  snap({ kind: 'start' });
  mergeInto(s, 0, 0, snap);
  s.active = null;
  snap({ kind: 'done' });
  return frames;
}

// Các hàm mà property test kiểm tra, suy ra từ chính trace được hiển thị.
export const mergeSort = (arr: readonly number[]) =>
  traceMergeSort(arr).at(-1)!.state.rows[0][0].values;

export const merge = (left: readonly number[], right: readonly number[]) =>
  traceMergeTwo(left, right).at(-1)!.state.rows[0][0].values;

// ---------- Sort-merge join ----------

export type JoinState = {
  left: number[]; // orders.customer_id, đã sort
  right: number[]; // customers.id, đã sort và không trùng
  i: number;
  j: number;
  pairs: [number, number][];
  comparisons: number;
};

export type JoinEvent =
  | { kind: 'start' }
  | { kind: 'compare'; a: number; b: number; rel: 'lt' | 'gt' | 'eq' }
  | { kind: 'done' };

// Hai con trỏ cùng đi một lượt: O(n + m) sau khi cả hai bên đã sort.
// Giả định khoá bên phải không trùng (ví dụ khoá chính customers.id).
export function traceMergeJoin(
  left: readonly number[],
  right: readonly number[],
): Frame<JoinState, JoinEvent>[] {
  const s: JoinState = {
    left: [...left],
    right: [...right],
    i: 0,
    j: 0,
    pairs: [],
    comparisons: 0,
  };
  const frames: Frame<JoinState, JoinEvent>[] = [];
  const snap = (event: JoinEvent) => frames.push({ state: structuredClone(s), event });
  snap({ kind: 'start' });
  while (s.i < left.length && s.j < right.length) {
    const a = left[s.i];
    const b = right[s.j];
    s.comparisons++;
    if (a < b) {
      s.i++;
      snap({ kind: 'compare', a, b, rel: 'lt' });
    } else if (a > b) {
      s.j++;
      snap({ kind: 'compare', a, b, rel: 'gt' });
    } else {
      s.pairs.push([s.i, s.j]);
      s.i++;
      snap({ kind: 'compare', a, b, rel: 'eq' });
    }
  }
  snap({ kind: 'done' });
  return frames;
}

export const mergeJoin = (left: readonly number[], right: readonly number[]) =>
  traceMergeJoin(left, right).at(-1)!.state.pairs;

// ---------- Bảng chi phí: n log₂ n so với n² ----------

export type CostState = { rows: { n: number; nlogn: number; n2: number }[]; shown: number };
export type CostEvent = { kind: 'start' } | { kind: 'row'; n: number };

export function traceCost(ns: readonly number[]): Frame<CostState, CostEvent>[] {
  const s: CostState = {
    rows: ns.map((n) => ({ n, nlogn: n * Math.log2(n), n2: n * n })),
    shown: 0,
  };
  const frames: Frame<CostState, CostEvent>[] = [];
  const snap = (event: CostEvent) => frames.push({ state: structuredClone(s), event });
  snap({ kind: 'start' });
  for (const n of ns) {
    s.shown++;
    snap({ kind: 'row', n });
  }
  return frames;
}
