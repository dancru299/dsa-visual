import type { Frame } from '@/src/engine/types';

export const parentOf = (i: number) => (i - 1) >> 1;
export const childrenOf = (i: number) => [2 * i + 1, 2 * i + 2];

// ---------- Cấu trúc dữ liệu ----------

// Min-heap trên mảng: phần tử ở index i luôn ≤ hai con ở 2i + 1 và 2i + 2,
// nên phần tử nhỏ nhất luôn nằm ở index 0.
export class MinHeap {
  private a: number[] = [];

  get size(): number {
    return this.a.length;
  }

  peek(): number | undefined {
    return this.a[0];
  }

  toArray(): number[] {
    return [...this.a];
  }

  push(x: number): void {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0 && a[parentOf(i)] > a[i]) {
      const p = parentOf(i);
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }

  pop(): number | undefined {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  // Bỏ gốc và thêm x trong một lần: dùng cho Top-K.
  replaceTop(x: number): number | undefined {
    const top = this.a[0];
    if (this.a.length === 0) {
      this.a.push(x);
      return undefined;
    }
    this.a[0] = x;
    this.siftDown(0);
    return top;
  }

  private siftDown(i: number): void {
    const a = this.a;
    while (2 * i + 1 < a.length) {
      let c = 2 * i + 1;
      if (c + 1 < a.length && a[c + 1] < a[c]) c++;
      if (a[i] <= a[c]) break;
      [a[i], a[c]] = [a[c], a[i]];
      i = c;
    }
  }
}

export const isHeap = (a: readonly number[]) =>
  a.every((x, i) => childrenOf(i).every((c) => c >= a.length || x <= a[c]));

// ---------- Trace ----------

export type HeapNode = { id: number; value: number; tag?: string }; // tag: tên dãy trong k-way merge

export type HeapState = {
  heap: HeapNode[];
  focus: number[]; // các index đang được so sánh
  swapped: number[]; // các index vừa đổi chỗ
  out: HeapNode[]; // các phần tử đã lấy ra, theo thứ tự
  lifted: boolean; // gốc vừa được nhấc ra nhưng chỗ của nó chưa được lấp
  stream: number[] | null; // Top-K: dòng dữ liệu đầu vào
  cursor: number | null; // Top-K: vị trí đang đọc
  skipped: number[]; // Top-K: các vị trí bị bỏ qua
  lists: { tag: string; values: number[] }[] | null; // k-way merge: các dãy đã sort
  heads: number[] | null; // k-way merge: số phần tử của mỗi dãy đã đưa vào heap
  k: number | null;
};

export type HeapEvent =
  | { kind: 'start' }
  | { kind: 'check'; i: number; children: number[] }
  | { kind: 'append'; value: number; index: number }
  | { kind: 'compare'; i: number; j: number; dir: 'up' | 'down' }
  | { kind: 'swap'; i: number; j: number }
  | { kind: 'settle'; index: number }
  | { kind: 'take-root'; value: number }
  | { kind: 'move-last'; value: number }
  | { kind: 'arrive'; value: number }
  | { kind: 'skip'; value: number; root: number }
  | { kind: 'replace'; value: number; old: number }
  | { kind: 'emit'; value: number; tag: string }
  | { kind: 'done' };

// Số phần tử thật sự còn trong heap: gốc đã nhấc ra thì không tính.
export const sizeOf = (s: HeapState) => s.heap.length - (s.lifted ? 1 : 0);
export const rootOf = (s: HeapState) => (s.lifted ? undefined : s.heap[0]);

export const emptyState = (values: readonly number[] = []): HeapState => ({
  heap: values.map((value, id) => ({ id, value })),
  focus: [],
  swapped: [],
  out: [],
  lifted: false,
  stream: null,
  cursor: null,
  skipped: [],
  lists: null,
  heads: null,
  k: null,
});

// Ghi frame cho từng lần so sánh và đổi chỗ khi push, pop, thay gốc.
export class HeapTracer {
  readonly frames: Frame<HeapState, HeapEvent>[] = [];
  private nextId: number;

  constructor(readonly s: HeapState) {
    this.nextId = Math.max(-1, ...s.heap.map((n) => n.id)) + 1;
  }

  snap(event: HeapEvent) {
    this.frames.push({ state: structuredClone(this.s), event });
    this.s.swapped = [];
  }

  private swap(i: number, j: number) {
    const h = this.s.heap;
    [h[i], h[j]] = [h[j], h[i]];
    this.s.swapped = [i, j];
    this.snap({ kind: 'swap', i, j });
  }

  private siftUp(i: number) {
    const h = this.s.heap;
    while (i > 0) {
      const p = parentOf(i);
      this.s.focus = [i, p];
      this.snap({ kind: 'compare', i, j: p, dir: 'up' });
      if (h[p].value <= h[i].value) break;
      this.swap(i, p);
      i = p;
    }
    this.s.focus = [i];
    this.snap({ kind: 'settle', index: i });
    this.s.focus = [];
  }

  private siftDown(i: number) {
    const h = this.s.heap;
    while (2 * i + 1 < h.length) {
      let c = 2 * i + 1;
      if (c + 1 < h.length && h[c + 1].value < h[c].value) c++;
      this.s.focus = [i, c];
      this.snap({ kind: 'compare', i, j: c, dir: 'down' });
      if (h[i].value <= h[c].value) break;
      this.swap(i, c);
      i = c;
    }
    this.s.focus = [i];
    this.snap({ kind: 'settle', index: i });
    this.s.focus = [];
  }

  push(value: number, tag?: string) {
    const node: HeapNode = { id: this.nextId++, value, ...(tag ? { tag } : {}) };
    this.s.heap.push(node);
    const index = this.s.heap.length - 1;
    this.s.focus = [index];
    this.snap({ kind: 'append', value, index });
    this.siftUp(index);
  }

  // Lấy gốc ra. emit: ghi sự kiện 'emit' (k-way merge) thay vì 'take-root'.
  pop(emit = false): HeapNode {
    const h = this.s.heap;
    const top = h[0];
    this.s.out.push(top);
    this.s.lifted = true;
    this.s.focus = [];
    if (emit) this.snap({ kind: 'emit', value: top.value, tag: top.tag ?? '' });
    else this.snap({ kind: 'take-root', value: top.value });
    this.s.lifted = false;
    const last = h.pop()!;
    if (h.length > 0) {
      h[0] = last;
      this.s.focus = [0];
      this.snap({ kind: 'move-last', value: last.value });
      this.siftDown(0);
    }
    return top;
  }

  replaceTop(value: number) {
    const old = this.s.heap[0].value;
    this.s.heap[0] = { id: this.nextId++, value };
    this.s.focus = [0];
    this.snap({ kind: 'replace', value, old });
    this.siftDown(0);
  }
}

// Bước 1: kiểm tra tính chất heap ở từng node có con.
export function traceCheck(values: readonly number[]): Frame<HeapState, HeapEvent>[] {
  const t = new HeapTracer(emptyState(values));
  t.snap({ kind: 'start' });
  for (let i = 0; 2 * i + 1 < values.length; i++) {
    const children = childrenOf(i).filter((c) => c < values.length);
    t.s.focus = [i, ...children];
    t.snap({ kind: 'check', i, children });
  }
  t.s.focus = [];
  t.snap({ kind: 'done' });
  return t.frames;
}

export type HeapOp = { kind: 'push'; value: number } | { kind: 'pop' };

export function traceOps(
  values: readonly number[],
  ops: readonly HeapOp[],
): Frame<HeapState, HeapEvent>[] {
  const t = new HeapTracer(emptyState(values));
  t.snap({ kind: 'start' });
  for (const op of ops) {
    if (op.kind === 'push') t.push(op.value);
    else if (t.s.heap.length > 0) t.pop();
  }
  t.snap({ kind: 'done' });
  return t.frames;
}

// Top-K số lớn nhất: giữ min-heap k phần tử, gốc là ngưỡng để vào top.
export function traceTopK(stream: readonly number[], k: number): Frame<HeapState, HeapEvent>[] {
  const t = new HeapTracer({ ...emptyState(), stream: [...stream], cursor: null, k });
  t.snap({ kind: 'start' });
  stream.forEach((x, idx) => {
    t.s.cursor = idx;
    t.snap({ kind: 'arrive', value: x });
    if (t.s.heap.length < k) t.push(x);
    else if (x > t.s.heap[0].value) t.replaceTop(x);
    else {
      t.s.skipped.push(idx);
      t.s.focus = [0];
      t.snap({ kind: 'skip', value: x, root: t.s.heap[0].value });
      t.s.focus = [];
    }
  });
  t.s.cursor = null;
  t.snap({ kind: 'done' });
  return t.frames;
}

// Trộn k dãy đã sort: heap luôn giữ phần tử nhỏ nhất chưa lấy của mỗi dãy.
export function traceKWayMerge(
  lists: readonly { tag: string; values: number[] }[],
): Frame<HeapState, HeapEvent>[] {
  const t = new HeapTracer({
    ...emptyState(),
    lists: lists.map((l) => ({ tag: l.tag, values: [...l.values] })),
    heads: lists.map(() => 0),
  });
  const heads = t.s.heads!;
  t.snap({ kind: 'start' });
  lists.forEach((l, i) => {
    if (l.values.length > 0) {
      heads[i] = 1;
      t.push(l.values[0], l.tag);
    }
  });
  while (t.s.heap.length > 0) {
    const top = t.pop(true);
    const i = lists.findIndex((l) => l.tag === top.tag);
    if (heads[i] < lists[i].values.length) {
      const next = lists[i].values[heads[i]];
      heads[i]++;
      t.push(next, lists[i].tag);
    }
  }
  t.snap({ kind: 'done' });
  return t.frames;
}

// Các hàm mà property test kiểm tra, suy ra từ chính trace được hiển thị.
export const topK = (stream: readonly number[], k: number) =>
  traceTopK(stream, k)
    .at(-1)!
    .state.heap.map((n) => n.value)
    .sort((a, b) => b - a);

export const kWayMerge = (lists: readonly { tag: string; values: number[] }[]) =>
  traceKWayMerge(lists)
    .at(-1)!
    .state.out.map((n) => n.value);
