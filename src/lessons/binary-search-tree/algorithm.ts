import type { Frame } from '@/src/engine/types';

// ---------- Cấu trúc dữ liệu ----------

// Cây lưu dạng phẳng theo khoá: mỗi khoá biết cha, con trái, con phải và độ sâu. Khoá không trùng.
export type BstNode = {
  key: number;
  parent: number | null;
  left: number | null;
  right: number | null;
  depth: number;
};
export type Tree = { root: number | null; nodes: Record<number, BstNode> };

export const emptyTree = (): Tree => ({ root: null, nodes: {} });

// Đường đi khi tìm một khoá: các khoá đã so, và chỗ dừng (khoá tìm thấy, hoặc chỗ trống).
export function walk(tree: Tree, key: number) {
  const path: number[] = [];
  let node = tree.root;
  let parent: number | null = null;
  let side: 'left' | 'right' | null = null;
  while (node !== null) {
    path.push(node);
    if (key === node) return { path, found: true, parent, side };
    parent = node;
    side = key < node ? 'left' : 'right';
    node = tree.nodes[node][side];
  }
  return { path, found: false, parent, side };
}

// Chèn không đệ quy, để cây lệch (chèn khoá đã sort) sâu bao nhiêu cũng không tràn stack.
export function insert(tree: Tree, key: number): Tree {
  const { found, parent, side } = walk(tree, key);
  if (found) return tree;
  const depth = parent === null ? 0 : tree.nodes[parent].depth + 1;
  tree.nodes[key] = { key, parent, left: null, right: null, depth };
  if (parent === null) tree.root = key;
  else tree.nodes[parent][side!] = key;
  return tree;
}

export const build = (keys: readonly number[]) => keys.reduce(insert, emptyTree());

export const heightOf = (tree: Tree) =>
  Object.values(tree.nodes).reduce((h, n) => Math.max(h, n.depth + 1), 0);

// Mọi khoá trong cây con có gốc là key.
export function subtreeKeys(tree: Tree, key: number | null): number[] {
  const out: number[] = [];
  const stack = key === null ? [] : [key];
  while (stack.length > 0) {
    const k = stack.pop()!;
    out.push(k);
    const n = tree.nodes[k];
    if (n.left !== null) stack.push(n.left);
    if (n.right !== null) stack.push(n.right);
  }
  return out;
}

// Mỗi node: mọi khoá bên trái nhỏ hơn nó, mọi khoá bên phải lớn hơn nó.
export const isBst = (tree: Tree) =>
  Object.values(tree.nodes).every(
    (n) =>
      subtreeKeys(tree, n.left).every((k) => k < n.key) &&
      subtreeKeys(tree, n.right).every((k) => k > n.key),
  );

// ---------- Trace ----------

export type NodeView = { key: number; parent: number | null; depth: number };

export type BstState = {
  nodes: NodeView[]; // theo thứ tự chèn
  target: number | null; // khoá đang tìm hoặc đang chèn
  current: number | null; // khoá đang so sánh, hoặc đang đứng
  path: number[]; // các khoá đã đi qua trên đường hiện tại
  spot: { parent: number; side: 'left' | 'right'; key: number } | null; // chỗ trống sắp gắn khoá mới
  found: number | null; // khoá vừa tìm thấy hoặc vừa chèn
  out: number[]; // khoá đã in ra (duyệt, truy vấn khoảng)
  pruned: number[]; // khoá trong các nhánh được bỏ qua
  range: [number, number] | null;
};

export type BstEvent =
  | { kind: 'start' }
  | { kind: 'compare'; key: number; target: number; go: 'left' | 'right' | 'found' }
  | { kind: 'found'; key: number }
  | { kind: 'empty'; parent: number; side: 'left' | 'right'; target: number } // rơi ra chỗ trống
  | { kind: 'insert'; key: number; parent: number | null; side: 'left' | 'right' | null }
  | { kind: 'visit'; key: number } // duyệt: tới một node
  | { kind: 'emit'; key: number } // in khoá ra kết quả
  | { kind: 'prune'; key: number; side: 'left' | 'right'; skipped: number[] }
  | { kind: 'done' };

type Frames = Frame<BstState, BstEvent>[];

const viewOf = (tree: Tree): NodeView[] =>
  Object.values(tree.nodes)
    .sort((a, b) => a.depth - b.depth || a.key - b.key)
    .map(({ key, parent, depth }) => ({ key, parent, depth }));

function recorder(tree: Tree) {
  const s: BstState = {
    nodes: viewOf(tree),
    target: null,
    current: null,
    path: [],
    spot: null,
    found: null,
    out: [],
    pruned: [],
    range: null,
  };
  const frames: Frames = [];
  const snap = (event: BstEvent) => {
    s.nodes = viewOf(tree);
    frames.push({ state: structuredClone(s), event });
  };
  return { s, frames, snap };
}

// So lần lượt từ gốc xuống. Dừng khi gặp khoá, hoặc khi rơi ra một chỗ trống.
type Side = 'left' | 'right';
type Descent = { found: true } | { found: false; parent: number | null; side: Side | null };

function descend(tree: Tree, s: BstState, snap: (e: BstEvent) => void, key: number): Descent {
  s.target = key;
  s.path = [];
  s.spot = null;
  s.found = null;
  let node = tree.root;
  while (node !== null) {
    s.current = node;
    s.path.push(node);
    const go: Side | 'found' = key === node ? 'found' : key < node ? 'left' : 'right';
    snap({ kind: 'compare', key: node, target: key, go });
    if (go === 'found') return { found: true };
    const next = tree.nodes[node][go];
    if (next === null) return { found: false, parent: node, side: go };
    node = next;
  }
  return { found: false, parent: null, side: null };
}

export function traceSearch(keys: readonly number[], target: number): Frames {
  const tree = build(keys);
  const { s, frames, snap } = recorder(tree);
  s.target = target;
  snap({ kind: 'start' });
  const r = descend(tree, s, snap, target);
  if (r.found) {
    s.found = target;
    snap({ kind: 'found', key: target });
  } else if (r.parent !== null) {
    s.current = null;
    s.spot = { parent: r.parent, side: r.side!, key: target };
    snap({ kind: 'empty', parent: r.parent, side: r.side!, target });
  }
  s.current = null;
  snap({ kind: 'done' });
  return frames;
}

// Chèn lần lượt từng khoá vào cây dựng từ keys: đi xuống như khi tìm, rồi gắn vào chỗ trống.
export function traceInsert(keys: readonly number[], added: readonly number[]): Frames {
  const tree = build(keys);
  const { s, frames, snap } = recorder(tree);
  snap({ kind: 'start' });
  for (const key of added) {
    const r = descend(tree, s, snap, key);
    if (r.found) continue;
    if (r.parent !== null) {
      s.current = null;
      s.spot = { parent: r.parent, side: r.side!, key };
      snap({ kind: 'empty', parent: r.parent, side: r.side!, target: key });
    }
    insert(tree, key);
    s.spot = null;
    s.found = key;
    snap({ kind: 'insert', key, parent: r.parent, side: r.side });
  }
  s.current = null;
  s.target = null;
  s.path = [];
  snap({ kind: 'done' });
  return frames;
}

// Duyệt in-order: cây con trái, rồi chính node, rồi cây con phải. Ra đúng thứ tự tăng dần.
export function traceInorder(keys: readonly number[]): Frames {
  const tree = build(keys);
  const { s, frames, snap } = recorder(tree);
  snap({ kind: 'start' });
  const visit = (k: number | null) => {
    if (k === null) return;
    s.current = k;
    s.path.push(k);
    snap({ kind: 'visit', key: k });
    visit(tree.nodes[k].left);
    s.current = k;
    s.out.push(k);
    snap({ kind: 'emit', key: k });
    visit(tree.nodes[k].right);
    s.path.pop();
  };
  visit(tree.root);
  s.current = null;
  snap({ kind: 'done' });
  return frames;
}

// Truy vấn khoảng [lo, hi]: chỉ xuống nhánh nào còn có thể chứa khoá trong khoảng.
export function traceRange(keys: readonly number[], lo: number, hi: number): Frames {
  const tree = build(keys);
  const { s, frames, snap } = recorder(tree);
  s.range = [lo, hi];
  snap({ kind: 'start' });
  const skip = (k: number, side: 'left' | 'right') => {
    const child = tree.nodes[k][side];
    if (child === null) return;
    const skipped = subtreeKeys(tree, child);
    s.current = k;
    s.pruned.push(...skipped);
    snap({ kind: 'prune', key: k, side, skipped });
  };
  const visit = (k: number | null) => {
    if (k === null) return;
    s.current = k;
    s.path.push(k);
    snap({ kind: 'visit', key: k });
    if (lo < k) visit(tree.nodes[k].left);
    else skip(k, 'left');
    if (lo <= k && k <= hi) {
      s.current = k;
      s.out.push(k);
      snap({ kind: 'emit', key: k });
    }
    if (k < hi) visit(tree.nodes[k].right);
    else skip(k, 'right');
    s.path.pop();
  };
  visit(tree.root);
  s.current = null;
  snap({ kind: 'done' });
  return frames;
}

// ---------- Các hàm mà test kiểm tra, suy ra từ chính trace được hiển thị ----------

export const contains = (keys: readonly number[], target: number) =>
  traceSearch(keys, target).some((f) => f.event.kind === 'found');

export const inorder = (keys: readonly number[]) => traceInorder(keys).at(-1)!.state.out;

export const rangeQuery = (keys: readonly number[], lo: number, hi: number) =>
  traceRange(keys, lo, hi).at(-1)!.state.out;

export const comparesOf = (frames: Frames) =>
  frames.filter((f) => f.event.kind === 'compare').length;

// ---------- Chiều cao cây theo thứ tự chèn ----------

// Bộ sinh số ngẫu nhiên có seed (mulberry32): cùng seed thì cùng dãy, nên server và trình
// duyệt tính ra cùng một con số.
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled(n: number, seed: number): number[] {
  const rand = seeded(seed);
  const a = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const balancedHeight = (n: number) => Math.ceil(Math.log2(n + 1));
