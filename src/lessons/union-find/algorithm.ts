import type { Frame } from '@/src/engine/types';

// Union-Find lưu trong một mảng parent: parent[x] là phần tử cha của x; gốc là phần tử có
// parent[x] = x, và gốc đại diện cho cả nhóm.

export type Mode = {
  bySize: boolean; // gắn cây nhỏ vào cây lớn; false thì luôn gắn gốc của a vào gốc của b
  compress: boolean; // nén đường khi find
};

export type UFState = {
  parent: number[];
  size: number[]; // số phần tử của cây, chỉ có nghĩa ở gốc
  labels: string[];
  current: number | null; // phần tử đang đứng khi find
  path: number[]; // các phần tử đã đi qua trong lần find hiện tại
  pair: [number, number] | null; // cặp đang union
  roots: number[]; // các gốc vừa tìm được
  changed: number | null; // phần tử vừa đổi parent
};

export type UFEvent =
  | { kind: 'start' }
  | { kind: 'step'; x: number; to: number } // đi từ x lên parent[x]
  | { kind: 'root'; x: number; root: number; steps: number } // find(x) xong
  | { kind: 'compress'; x: number; root: number; was: number }
  | { kind: 'same'; a: number; b: number; root: number } // đã cùng nhóm
  | { kind: 'link'; a: number; b: number; child: number; parent: number }
  | { kind: 'done' };

type Frames = Frame<UFState, UFEvent>[];

export const singletons = (n: number) => Array.from({ length: n }, (_, i) => i);

class Tracer {
  readonly frames: Frames = [];
  readonly s: UFState;
  constructor(
    parent: readonly number[],
    labels: readonly string[],
    readonly mode: Mode,
  ) {
    const size = parent.map(() => 0);
    parent.forEach((_, i) => {
      let r = i;
      while (parent[r] !== r) r = parent[r];
      size[r]++;
    });
    this.s = {
      parent: [...parent],
      size,
      labels: [...labels],
      current: null,
      path: [],
      pair: null,
      roots: [],
      changed: null,
    };
  }

  snap(event: UFEvent) {
    this.frames.push({ state: structuredClone(this.s), event });
    this.s.changed = null;
  }

  find(x: number): number {
    const s = this.s;
    s.path = [x];
    s.current = x;
    let root = x;
    let steps = 0;
    while (s.parent[root] !== root) {
      const to = s.parent[root];
      root = to;
      steps++;
      s.current = root;
      s.path.push(root);
      this.snap({ kind: 'step', x: s.path.at(-2)!, to });
    }
    s.roots = [...s.roots, root];
    this.snap({ kind: 'root', x, root, steps });
    if (this.mode.compress) {
      let y = x;
      while (s.parent[y] !== root) {
        const was = s.parent[y];
        s.parent[y] = root;
        s.changed = y;
        s.current = y;
        this.snap({ kind: 'compress', x: y, root, was });
        y = was;
      }
    }
    return root;
  }

  union(a: number, b: number) {
    const s = this.s;
    s.pair = [a, b];
    s.roots = [];
    let ra = this.find(a);
    let rb = this.find(b);
    s.current = null;
    s.path = [];
    if (ra === rb) {
      this.snap({ kind: 'same', a, b, root: ra });
      return;
    }
    if (this.mode.bySize && s.size[ra] > s.size[rb]) [ra, rb] = [rb, ra];
    s.parent[ra] = rb;
    s.size[rb] += s.size[ra];
    s.changed = ra;
    this.snap({ kind: 'link', a, b, child: ra, parent: rb });
  }
}

const defaultLabels = (n: number) => singletons(n).map(String);

export function traceFind(
  parent: readonly number[],
  x: number,
  compress: boolean,
  labels = defaultLabels(parent.length),
): Frames {
  const t = new Tracer(parent, labels, { bySize: false, compress });
  t.snap({ kind: 'start' });
  t.find(x);
  t.s.current = null;
  t.snap({ kind: 'done' });
  return t.frames;
}

export function traceUnions(
  parent: readonly number[],
  pairs: readonly (readonly [number, number])[],
  mode: Mode,
  labels = defaultLabels(parent.length),
  finds: readonly number[] = [],
): Frames {
  const t = new Tracer(parent, labels, mode);
  t.snap({ kind: 'start' });
  for (const [a, b] of pairs) t.union(a, b);
  for (const x of finds) {
    t.s.pair = null;
    t.s.roots = [];
    t.find(x);
  }
  t.s.current = null;
  t.s.pair = null;
  t.s.path = [];
  t.snap({ kind: 'done' });
  return t.frames;
}

// ---------- Tiện ích để vẽ và để test ----------

export const rootOf = (parent: readonly number[], x: number) => {
  while (parent[x] !== x) x = parent[x];
  return x;
};

export const depthOf = (parent: readonly number[], x: number) => {
  let d = 0;
  while (parent[x] !== x) {
    x = parent[x];
    d++;
  }
  return d;
};

export const heightOf = (parent: readonly number[]) =>
  Math.max(...parent.map((_, i) => depthOf(parent, i))) + 1;

// Các nhóm, mỗi nhóm sort tăng dần, các nhóm sort theo phần tử nhỏ nhất.
export function groupsOf(parent: readonly number[]): number[][] {
  const by = new Map<number, number[]>();
  parent.forEach((_, i) => {
    const r = rootOf(parent, i);
    by.set(r, [...(by.get(r) ?? []), i]);
  });
  return [...by.values()].sort((a, b) => a[0] - b[0]);
}

// Lời giải tham chiếu: BFS trên đồ thị vô hướng tạo từ các cặp.
export function componentsBruteForce(
  n: number,
  pairs: readonly (readonly [number, number])[],
): number[][] {
  const adj = singletons(n).map(() => [] as number[]);
  for (const [a, b] of pairs) {
    adj[a].push(b);
    adj[b].push(a);
  }
  const seen = new Set<number>();
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    if (seen.has(i)) continue;
    const comp: number[] = [];
    const queue = [i];
    seen.add(i);
    while (queue.length > 0) {
      const u = queue.shift()!;
      comp.push(u);
      for (const v of adj[u]) {
        if (!seen.has(v)) {
          seen.add(v);
          queue.push(v);
        }
      }
    }
    out.push(comp.sort((a, b) => a - b));
  }
  return out.sort((a, b) => a[0] - b[0]);
}

// ---------- Gộp bản ghi (entity resolution) ----------

export type Record_ = { id: string; email: string; phone: string };

// Duyệt từng bản ghi: giá trị nào (email, số điện thoại) đã gặp thì union với bản ghi đầu tiên có
// giá trị đó. Trả về các cặp kèm lý do, theo đúng thứ tự xử lý.
export function matchPairs(records: readonly Record_[]) {
  const seen = new Map<string, number>();
  const pairs: { a: number; b: number; why: string }[] = [];
  records.forEach((r, i) => {
    for (const [field, value] of [
      ['email', r.email],
      ['phone', r.phone],
    ] as const) {
      const key = `${field}:${value}`;
      const first = seen.get(key);
      if (first === undefined) seen.set(key, i);
      else
        pairs.push({
          a: i,
          b: first,
          why: `${field === 'email' ? 'cùng email' : 'cùng số điện thoại'} ${value}`,
        });
    }
  });
  return pairs;
}
