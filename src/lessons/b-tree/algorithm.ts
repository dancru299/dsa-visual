import type { Frame } from '@/src/engine/types';

// Mỗi node chứa tối đa MAX_KEYS khoá đã sort và có số con bằng số khoá + 1. Bài dùng số nhỏ để
// vẽ được; index thật của database chứa vài trăm khoá mỗi node.
export const MAX_KEYS = 3;

export type BNode = { id: number; keys: number[]; children: number[] }; // children: id, rỗng ở lá
export type BTree = { root: number; nodes: Record<number, BNode>; nextId: number };

export const emptyTree = (): BTree => ({
  root: 0,
  nodes: { 0: { id: 0, keys: [], children: [] } },
  nextId: 1,
});

export const isLeaf = (n: BNode) => n.children.length === 0;

// Trong một node: vị trí đầu tiên có khoá ≥ key. Khoá ở đó bằng key thì tìm thấy, không thì đi
// xuống con cùng chỉ số: mọi khoá trong con đó nằm giữa keys[i - 1] và keys[i].
export const slotOf = (keys: readonly number[], key: number) => {
  let i = 0;
  while (i < keys.length && key > keys[i]) i++;
  return i;
};

export function parentOf(tree: BTree, id: number): number | null {
  for (const n of Object.values(tree.nodes)) if (n.children.includes(id)) return n.id;
  return null;
}

// ---------- Trace ----------

export type BState = {
  root: number;
  nodes: BNode[]; // mọi node, sort theo id
  target: number | null; // khoá đang tìm hoặc đang chèn
  current: number | null; // node đang xét
  path: number[]; // các node đã đi qua từ gốc
  hit: number | null; // khoá vừa tìm thấy
  fresh: number | null; // khoá vừa chèn
  overflow: number | null; // node đang tràn
  promoted: number | null; // khoá vừa được đẩy lên cha
};

export type BEvent =
  | { kind: 'start' }
  | { kind: 'scan'; node: number; keys: number[]; target: number; slot: number; found: boolean }
  | { kind: 'found'; key: number; node: number }
  | { kind: 'miss'; node: number; target: number }
  | { kind: 'place'; key: number; node: number; keys: number[] } // keys: sau khi thêm
  | { kind: 'overflow'; node: number; keys: number[] }
  | {
      kind: 'split';
      node: number;
      left: number[];
      up: number;
      right: number[];
      parent: number | null; // null: tách gốc, có gốc mới
    }
  | { kind: 'done' };

type Frames = Frame<BState, BEvent>[];

class Tracer {
  readonly frames: Frames = [];
  readonly s: BState;
  constructor(readonly tree: BTree) {
    this.s = {
      root: tree.root,
      nodes: [],
      target: null,
      current: null,
      path: [],
      hit: null,
      fresh: null,
      overflow: null,
      promoted: null,
    };
  }

  snap(event: BEvent) {
    this.s.root = this.tree.root;
    this.s.nodes = Object.values(this.tree.nodes)
      .sort((a, b) => a.id - b.id)
      .map((n) => ({ id: n.id, keys: [...n.keys], children: [...n.children] }));
    this.frames.push({ state: structuredClone(this.s), event });
  }

  // Đi xuống từ gốc. Trả về node chứa khoá, hoặc lá nơi khoá sẽ được chèn.
  descend(key: number): { node: number; found: boolean } {
    const s = this.s;
    s.target = key;
    s.path = [];
    s.hit = null;
    s.fresh = null;
    s.promoted = null;
    let id = this.tree.root;
    for (;;) {
      const n = this.tree.nodes[id];
      s.current = id;
      s.path.push(id);
      const slot = slotOf(n.keys, key);
      const found = n.keys[slot] === key;
      this.snap({ kind: 'scan', node: id, keys: [...n.keys], target: key, slot, found });
      if (found || isLeaf(n)) return { node: id, found };
      id = n.children[slot];
    }
  }

  // Thêm khoá vào lá rồi tách ngược lên chừng nào node còn tràn.
  insertAt(leafId: number, key: number) {
    const t = this.tree;
    const s = this.s;
    const leaf = t.nodes[leafId];
    leaf.keys.splice(slotOf(leaf.keys, key), 0, key);
    s.fresh = key;
    this.snap({ kind: 'place', key, node: leafId, keys: [...leaf.keys] });

    let id = leafId;
    while (t.nodes[id].keys.length > MAX_KEYS) {
      const n = t.nodes[id];
      s.current = id;
      s.overflow = id;
      this.snap({ kind: 'overflow', node: id, keys: [...n.keys] });

      const mid = Math.floor(n.keys.length / 2);
      const up = n.keys[mid];
      const right: BNode = {
        id: t.nextId++,
        keys: n.keys.slice(mid + 1),
        children: n.children.slice(mid + 1),
      };
      n.keys = n.keys.slice(0, mid);
      n.children = n.children.slice(0, mid + 1);
      t.nodes[right.id] = right;

      const parentId = parentOf(t, id);
      if (parentId === null) {
        const root: BNode = { id: t.nextId++, keys: [up], children: [id, right.id] };
        t.nodes[root.id] = root;
        t.root = root.id;
      } else {
        const p = t.nodes[parentId];
        const at = p.children.indexOf(id);
        p.keys.splice(at, 0, up);
        p.children.splice(at + 1, 0, right.id);
      }
      s.overflow = null;
      s.promoted = up;
      s.current = parentId ?? t.root;
      this.snap({
        kind: 'split',
        node: id,
        left: [...n.keys],
        up,
        right: [...right.keys],
        parent: parentId,
      });
      id = parentId ?? t.root;
    }
  }
}

export function insertKey(tree: BTree, key: number): BTree {
  const tr = new Tracer(tree);
  const { node, found } = tr.descend(key);
  if (!found) tr.insertAt(node, key);
  return tree;
}

export const build = (keys: readonly number[]) => keys.reduce(insertKey, emptyTree());

export function traceSearch(keys: readonly number[], target: number): Frames {
  const tr = new Tracer(build(keys));
  tr.snap({ kind: 'start' });
  const { node, found } = tr.descend(target);
  if (found) {
    tr.s.hit = target;
    tr.snap({ kind: 'found', key: target, node });
  } else {
    tr.snap({ kind: 'miss', node, target });
  }
  tr.s.current = null;
  tr.snap({ kind: 'done' });
  return tr.frames;
}

// Chèn lần lượt từng khoá vào cây dựng từ keys.
export function traceInsert(keys: readonly number[], added: readonly number[]): Frames {
  const tr = new Tracer(build(keys));
  tr.snap({ kind: 'start' });
  for (const key of added) {
    const { node, found } = tr.descend(key);
    if (!found) tr.insertAt(node, key);
  }
  const s = tr.s;
  s.current = null;
  s.target = null;
  s.path = [];
  s.promoted = null;
  tr.snap({ kind: 'done' });
  return tr.frames;
}

// ---------- Các hàm mà test kiểm tra ----------

export const contains = (keys: readonly number[], target: number) =>
  traceSearch(keys, target).some((f) => f.event.kind === 'found');

export function depths(tree: BTree): Record<number, number> {
  const d: Record<number, number> = { [tree.root]: 0 };
  const queue = [tree.root];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const c of tree.nodes[id].children) {
      d[c] = d[id] + 1;
      queue.push(c);
    }
  }
  return d;
}

export const heightOf = (tree: BTree) => Math.max(...Object.values(depths(tree))) + 1;

export function inorderKeys(tree: BTree, id = tree.root): number[] {
  const n = tree.nodes[id];
  if (isLeaf(n)) return [...n.keys];
  return n.keys
    .flatMap((k, i) => [...inorderKeys(tree, n.children[i]), k])
    .concat(inorderKeys(tree, n.children.at(-1)!));
}

// Đúng là B-tree: mọi lá cùng độ sâu, node không quá MAX_KEYS khoá, node trong có số con bằng
// số khoá + 1, và duyệt theo thứ tự ra dãy tăng dần.
export function isBTree(tree: BTree): boolean {
  const d = depths(tree);
  const nodes = Object.values(tree.nodes);
  const leafDepths = new Set(nodes.filter(isLeaf).map((n) => d[n.id]));
  const shapeOk = nodes.every(
    (n) =>
      n.keys.length <= MAX_KEYS &&
      (n.id === tree.root || n.keys.length >= 1) &&
      (isLeaf(n) || n.children.length === n.keys.length + 1),
  );
  const keys = inorderKeys(tree);
  const sorted = keys.every((k, i) => i === 0 || keys[i - 1] < k);
  return leafDepths.size <= 1 && shapeOk && sorted && Object.keys(d).length === nodes.length;
}

// Chiều cao nhỏ nhất có thể của cây chứa n khoá khi mỗi node chứa tối đa m khoá: cây cao h chứa
// được nhiều nhất (m + 1)^h − 1 khoá. Làm tròn bằng số nguyên để không lệch vì sai số dấu phẩy động.
export function minHeight(n: number, m: number): number {
  let h = 0;
  let capacity = 0;
  while (capacity < n) {
    h++;
    capacity = capacity * (m + 1) + m;
  }
  return Math.max(h, 1);
}
