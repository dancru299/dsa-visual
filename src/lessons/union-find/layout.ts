// Bố cục rừng cây theo đơn vị viewBox SVG. Không phụ thuộc giao diện, để lesson.tsx tính được
// bề ngang và số tầng lớn nhất của cả bước rồi giữ viewBox cố định.
export const SLOT = 44; // bề ngang dành cho một lá
export const R = 16; // bán kính node
export const LEVEL_H = 52;
export const TOP = 22;
export const TREE_GAP = 12; // khe thêm giữa hai cây

export function forestLayout(parent: readonly number[]) {
  const children = parent.map(() => [] as number[]);
  parent.forEach((p, i) => {
    if (p !== i) children[p].push(i);
  });
  const roots = parent.flatMap((p, i) => (p === i ? [i] : []));
  const pos = new Map<number, { x: number; depth: number }>();
  let cursor = 0;
  let maxDepth = 0;
  const place = (id: number, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);
    let x: number;
    if (children[id].length === 0) {
      x = cursor + SLOT / 2;
      cursor += SLOT;
    } else {
      const xs = children[id].map((c) => place(c, depth + 1));
      x = (xs[0] + xs.at(-1)!) / 2;
    }
    pos.set(id, { x, depth });
    return x;
  };
  roots.forEach((r) => {
    place(r, 0);
    cursor += TREE_GAP;
  });
  return { pos, width: cursor - TREE_GAP, levels: maxDepth + 1 };
}

export const yOf = (depth: number) => TOP + R + depth * LEVEL_H;
export const heightFor = (levels: number) => yOf(levels - 1) + R + TOP;
