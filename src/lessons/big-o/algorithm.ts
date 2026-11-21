import type { Frame } from '@/src/engine/types';
import { worstCaseBinary, type Cell, type TrackState } from '../binary-search/algorithm';

// ---------- O(1): biết vị trí thì đọc thẳng ----------

export type ReadEvent = { kind: 'start' } | { kind: 'read'; i: number };

export function traceDirectAccess(
  arr: readonly number[],
  i: number,
): Frame<TrackState, ReadEvent>[] {
  const s: TrackState = {
    arr: [...arr],
    target: arr[i],
    cells: arr.map((): Cell => 'idle'),
    focus: null,
    lo: null,
    hi: null,
    comparisons: 0,
    result: null,
  };
  const frames: Frame<TrackState, ReadEvent>[] = [];
  const snap = (event: ReadEvent) => frames.push({ state: structuredClone(s), event });
  snap({ kind: 'start' });
  s.cells[i] = 'found';
  s.focus = i;
  s.comparisons = 1;
  s.result = i;
  snap({ kind: 'read', i });
  return frames;
}

// ---------- O(n²): nested loop join ----------

export type PairMark = 'idle' | 'cmp' | 'match' | 'miss';

export type JoinState = {
  left: number[]; // ví dụ customer_id của từng đơn hàng
  right: number[]; // ví dụ id của từng khách hàng
  grid: PairMark[][]; // grid[i][j]: đã so dòng i bên trái với dòng j bên phải chưa, kết quả ra sao
  comparisons: number;
  matches: [number, number][];
};

export type JoinEvent =
  { kind: 'start' } | { kind: 'compare'; i: number; j: number; match: boolean } | { kind: 'done' };

// Với mỗi dòng bên trái, so với mọi dòng bên phải: n · m lần so sánh.
export function traceNestedLoopJoin(
  left: readonly number[],
  right: readonly number[],
): Frame<JoinState, JoinEvent>[] {
  const s: JoinState = {
    left: [...left],
    right: [...right],
    grid: left.map(() => right.map((): PairMark => 'idle')),
    comparisons: 0,
    matches: [],
  };
  const frames: Frame<JoinState, JoinEvent>[] = [];
  const snap = (event: JoinEvent) => frames.push({ state: structuredClone(s), event });
  let prev: [number, number] | null = null;

  snap({ kind: 'start' });
  for (let i = 0; i < left.length; i++) {
    for (let j = 0; j < right.length; j++) {
      if (prev && s.grid[prev[0]][prev[1]] === 'cmp') s.grid[prev[0]][prev[1]] = 'miss';
      const match = left[i] === right[j];
      s.comparisons++;
      s.grid[i][j] = match ? 'match' : 'cmp';
      if (match) s.matches.push([i, j]);
      prev = [i, j];
      snap({ kind: 'compare', i, j, match });
    }
  }
  if (prev && s.grid[prev[0]][prev[1]] === 'cmp') s.grid[prev[0]][prev[1]] = 'miss';
  snap({ kind: 'done' });
  return frames;
}

export function nestedLoopJoin(
  left: readonly number[],
  right: readonly number[],
): [number, number][] {
  return traceNestedLoopJoin(left, right).at(-1)!.state.matches;
}

// Cách làm khác để so sánh: hash join, O(n + m). Dựng dict từ bảng phải rồi tra từng dòng bên trái.
export function hashJoin(left: readonly number[], right: readonly number[]): [number, number][] {
  const index = new Map<number, number[]>();
  right.forEach((key, j) => index.set(key, [...(index.get(key) ?? []), j]));
  return left.flatMap((key, i) => (index.get(key) ?? []).map((j): [number, number] => [i, j]));
}

// ---------- Bảng tốc độ tăng ----------

export type GrowthRow = {
  n: number;
  constant: number;
  log: number;
  linear: number;
  quadratic: number;
};

export const growthRow = (n: number): GrowthRow => ({
  n,
  constant: 1,
  log: worstCaseBinary(n),
  linear: n,
  quadratic: n * n,
});

export type GrowthState = { rows: GrowthRow[]; shown: number };
export type GrowthEvent = { kind: 'start' } | { kind: 'row'; n: number };

export function traceGrowth(ns: readonly number[]): Frame<GrowthState, GrowthEvent>[] {
  const s: GrowthState = { rows: ns.map(growthRow), shown: 0 };
  const frames: Frame<GrowthState, GrowthEvent>[] = [];
  const snap = (event: GrowthEvent) => frames.push({ state: structuredClone(s), event });
  snap({ kind: 'start' });
  for (const n of ns) {
    s.shown++;
    snap({ kind: 'row', n });
  }
  return frames;
}

// ---------- Hiển thị số lớn và thời gian ----------

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (k: number) => [...String(k)].map((d) => SUPERSCRIPT[Number(d)]).join('');

// Số dưới 1 triệu in đủ chữ số; từ 1 triệu trở lên, luỹ thừa của 10 in dạng 10⁶, 10¹⁸.
// Gọn để bảng vừa màn hình điện thoại, và dễ so sánh hơn một dãy chữ số 0.
export function formatCount(v: number): string {
  if (v < 1_000_000) return v.toLocaleString('vi-VN');
  const k = Math.round(Math.log10(v));
  return 10 ** k === v ? `10${sup(k)}` : v.toExponential(1);
}

// Thời gian để chạy `steps` bước nếu mỗi bước mất 1 micro giây.
export function formatDuration(steps: number): string {
  const s = steps / 1_000_000;
  const units: [number, string][] = [
    [365 * 24 * 3600, 'năm'],
    [24 * 3600, 'ngày'],
    [3600, 'giờ'],
    [60, 'phút'],
    [1, 'giây'],
    [0.001, 'mili giây'],
  ];
  for (const [size, name] of units) {
    if (s >= size) {
      const value = s / size;
      const shown =
        value >= 100
          ? Math.round(value).toLocaleString('vi-VN')
          : value.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
      return `${shown} ${name}`;
    }
  }
  return `${steps.toLocaleString('vi-VN')} micro giây`;
}
