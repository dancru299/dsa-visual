import type { Frame } from '@/src/engine/types';

// Đồ thị có hướng dạng danh sách kề: mỗi bảng trỏ tới các bảng dùng nó làm nguồn.
export type Graph = Record<string, readonly string[]>;

export type NodeMark = 'idle' | 'frontier' | 'current' | 'done';

// Khớp về cấu trúc với GraphSceneState của src/scenes/GraphScene.tsx, nên scene vẽ được
// state này mà algorithm không cần import gì từ phía giao diện.
export type BfsState = {
  marks: Record<string, NodeMark>;
  activeEdge: string | null; // cạnh đang xét, dạng "a->b"
  treeEdges: string[]; // các cạnh đã dẫn tới một bảng mới
  pending: string[]; // queue: các bảng đã phát hiện, chờ xử lý
  order: string[]; // thứ tự lấy ra khỏi queue
  dist: Record<string, number>; // số bước từ bảng nguồn
};

export type BfsEvent =
  | { kind: 'start'; source: string }
  | { kind: 'dequeue'; node: string }
  | { kind: 'discover'; from: string; to: string }
  | { kind: 'skip'; from: string; to: string }
  | { kind: 'finish'; node: string }
  | { kind: 'done' };

export const edgeKey = (from: string, to: string) => `${from}->${to}`;

export function nodesOf(graph: Graph): string[] {
  const seen = new Set<string>();
  for (const [u, vs] of Object.entries(graph)) {
    seen.add(u);
    vs.forEach((v) => seen.add(v));
  }
  return [...seen];
}

// BFS từ một bảng nguồn: lần lượt lấy bảng ở đầu queue, đánh dấu các bảng con chưa thấy.
export function traceBfs(graph: Graph, source: string): Frame<BfsState, BfsEvent>[] {
  const s: BfsState = {
    marks: Object.fromEntries(nodesOf(graph).map((n): [string, NodeMark] => [n, 'idle'])),
    activeEdge: null,
    treeEdges: [],
    pending: [source],
    order: [],
    dist: { [source]: 0 },
  };
  s.marks[source] = 'frontier';
  const frames: Frame<BfsState, BfsEvent>[] = [];
  const snap = (event: BfsEvent) => frames.push({ state: structuredClone(s), event });

  snap({ kind: 'start', source });
  while (s.pending.length > 0) {
    const u = s.pending.shift()!;
    s.marks[u] = 'current';
    s.order.push(u);
    snap({ kind: 'dequeue', node: u });
    for (const v of graph[u] ?? []) {
      s.activeEdge = edgeKey(u, v);
      if (s.marks[v] === 'idle') {
        s.marks[v] = 'frontier';
        s.dist[v] = s.dist[u] + 1;
        s.pending.push(v);
        s.treeEdges.push(s.activeEdge);
        snap({ kind: 'discover', from: u, to: v });
      } else {
        snap({ kind: 'skip', from: u, to: v });
      }
    }
    s.activeEdge = null;
    s.marks[u] = 'done';
    snap({ kind: 'finish', node: u });
  }
  snap({ kind: 'done' });
  return frames;
}

// Các bảng bị ảnh hưởng, theo thứ tự BFS. Suy ra từ trace để test kiểm tra đúng thứ được hiển thị.
export function affected(graph: Graph, source: string): string[] {
  return traceBfs(graph, source).at(-1)!.state.order;
}

// ---------- Lời giải brute-force để so sánh ----------

// Lặp đi lặp lại: nếu u đã tới được và có cạnh u → v thì v cũng tới được, cho tới khi không đổi.
// Đồng thời tính số bước ít nhất. Chậm, nhưng không phụ thuộc thứ tự duyệt.
export function shortestHopsBruteForce(graph: Graph, source: string): Record<string, number> {
  const dist: Record<string, number> = { [source]: 0 };
  let changed = true;
  while (changed) {
    changed = false;
    for (const [u, vs] of Object.entries(graph)) {
      if (dist[u] === undefined) continue;
      for (const v of vs) {
        if (dist[v] === undefined || dist[u] + 1 < dist[v]) {
          dist[v] = dist[u] + 1;
          changed = true;
        }
      }
    }
  }
  return dist;
}
