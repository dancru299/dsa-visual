import type { BNode } from './algorithm';

// Bố cục của cây, tính bằng đơn vị của viewBox SVG. Không phụ thuộc giao diện nên lesson.tsx
// dùng được để tính bề ngang lớn nhất của cả bước, giữ viewBox cố định khi cây lớn dần.
export const CELL = 28; // bề ngang một ô khoá
export const PAD = 4; // lề trong của node
export const NODE_H = 32;
export const GAP = 10; // khe giữa hai node cạnh nhau
export const LEVEL_H = 70; // khoảng cách giữa hai tầng
export const TOP = 14;

export type Placed = {
  id: number;
  keys: number[];
  children: number[];
  depth: number;
  left: number;
  width: number;
};

export const nodeWidth = (keys: number) => Math.max(1, keys) * CELL + 2 * PAD;

// Lá xếp lần lượt từ trái sang phải; node trong nằm giữa các con của nó.
export function layout(root: number, nodes: readonly BNode[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const placed = new Map<number, Placed>();
  let cursor = 0;
  let maxDepth = 0;
  const place = (id: number, depth: number): Placed => {
    const n = byId.get(id)!;
    maxDepth = Math.max(maxDepth, depth);
    const width = nodeWidth(n.keys.length);
    let left: number;
    if (n.children.length === 0) {
      left = cursor;
      cursor += width + GAP;
    } else {
      const kids = n.children.map((c) => place(c, depth + 1));
      const first = kids[0];
      const last = kids.at(-1)!;
      left = (first.left + last.left + last.width) / 2 - width / 2;
    }
    const p = { id, keys: n.keys, children: n.children, depth, left, width };
    placed.set(id, p);
    return p;
  };
  place(root, 0);
  const min = Math.min(...[...placed.values()].map((p) => p.left));
  for (const p of placed.values()) p.left -= min;
  const width = Math.max(...[...placed.values()].map((p) => p.left + p.width));
  return { placed, width, levels: maxDepth + 1 };
}

export const topOf = (depth: number) => TOP + depth * LEVEL_H;
export const heightFor = (levels: number) => topOf(levels - 1) + NODE_H + TOP;
