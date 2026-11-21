import type { Frame } from '@/src/engine/types';

// Đồ thị có hướng dạng danh sách kề: mỗi bảng trỏ tới các bảng dùng nó làm nguồn.
// Bảng không có bảng con thì có thể không có khoá, giống graph.get(table, []) bên Python.
export type Graph = Record<string, readonly string[]>;

export type NodeMark = 'idle' | 'frontier' | 'current' | 'done';

// Khớp về cấu trúc với GraphSceneState của src/scenes/GraphScene.tsx, nên scene vẽ được
// state này mà algorithm không cần import gì từ phía giao diện.
export type WalkState = {
  marks: Record<string, NodeMark>;
  activeEdge: string | null; // cạnh đang xét, dạng "a->b"
  treeEdges: string[]; // các cạnh đã dẫn tới một bảng mới
  pending: string[]; // queue (BFS), call stack (DFS), hoặc danh sách con khi đọc graph
  order: string[]; // thứ tự lấy ra (BFS) hoặc thứ tự thăm (DFS); có thể lặp khi bỏ seen
  badges: Record<string, number>; // số bước từ bảng nguồn theo đường đã đi
};

export type WalkEvent =
  | { kind: 'start'; source: string }
  | { kind: 'read'; node: string; children: string[] } // đọc graph.get(node, [])
  | { kind: 'dequeue'; node: string } // BFS: lấy ra ở đầu queue
  | { kind: 'discover'; from: string; to: string; again: boolean } // BFS: thêm vào queue
  | { kind: 'skip'; from: string; to: string } // bảng đã thấy rồi
  | { kind: 'cut'; node: string; depth: number } // BFS giới hạn độ sâu: không đi tiếp
  | { kind: 'finish'; node: string } // BFS: xét xong mọi bảng con
  | { kind: 'enter'; node: string; from: string | null } // DFS: gọi dfs(node)
  | { kind: 'leave'; node: string; back: string | null } // DFS: return về bảng đã gọi nó
  | { kind: 'done' };

export const edgeKey = (from: string, to: string) => `${from}->${to}`;
export const childrenOf = (graph: Graph, node: string) => graph[node] ?? [];

export function nodesOf(graph: Graph): string[] {
  const seen = new Set<string>();
  for (const [u, vs] of Object.entries(graph)) {
    seen.add(u);
    vs.forEach((v) => seen.add(v));
  }
  return [...seen];
}

export const parentsOf = (graph: Graph, node: string) =>
  Object.keys(graph).filter((u) => childrenOf(graph, u).includes(node));

function emptyState(graph: Graph): WalkState {
  return {
    marks: Object.fromEntries(nodesOf(graph).map((n): [string, NodeMark] => [n, 'idle'])),
    activeEdge: null,
    treeEdges: [],
    pending: [],
    order: [],
    badges: {},
  };
}

class Recorder {
  readonly frames: Frame<WalkState, WalkEvent>[] = [];
  constructor(readonly s: WalkState) {}
  snap(event: WalkEvent) {
    this.frames.push({ state: structuredClone(this.s), event });
  }
}

// Bước 1: đọc danh sách kề của từng bảng, theo thứ tự cho trước.
export function traceRead(graph: Graph, tables: readonly string[]): Frame<WalkState, WalkEvent>[] {
  const r = new Recorder(emptyState(graph));
  const s = r.s;
  r.snap({ kind: 'start', source: tables[0] });
  const read: string[] = [];
  for (const node of tables) {
    const children = [...childrenOf(graph, node)];
    for (const n of Object.keys(s.marks)) s.marks[n] = read.includes(n) ? 'done' : 'idle';
    children.forEach((c) => (s.marks[c] = 'frontier'));
    s.marks[node] = 'current';
    s.treeEdges = children.map((c) => edgeKey(node, c));
    s.pending = children;
    read.push(node);
    s.order = [...read];
    r.snap({ kind: 'read', node, children });
  }
  for (const n of Object.keys(s.marks)) s.marks[n] = 'done';
  s.treeEdges = [];
  s.pending = [];
  r.snap({ kind: 'done' });
  return r.frames;
}

export type BfsOptions = {
  maxDepth?: number; // giống dbt --select "source+n": không đi quá n bước
  seen?: boolean; // false: bỏ tập seen, một bảng tới được bằng nhiều đường sẽ vào queue nhiều lần
};

// BFS từ một bảng nguồn: lần lượt lấy bảng ở đầu queue, đưa các bảng con chưa thấy vào cuối queue.
export function traceBfs(
  graph: Graph,
  source: string,
  { maxDepth = Infinity, seen = true }: BfsOptions = {},
): Frame<WalkState, WalkEvent>[] {
  const r = new Recorder(emptyState(graph));
  const s = r.s;
  // Mỗi phần tử của queue mang theo số bước của nó, vì khi bỏ seen một bảng có thể vào queue
  // nhiều lần (ở đây cùng số bước, nhưng nói chung có thể khác).
  const queue: { node: string; depth: number }[] = [{ node: source, depth: 0 }];
  const found = new Set([source]);
  s.pending = [source];
  s.marks[source] = 'frontier';
  s.badges[source] = 0;
  r.snap({ kind: 'start', source });

  while (queue.length > 0) {
    const { node: u, depth } = queue.shift()!;
    s.pending = queue.map((q) => q.node);
    s.marks[u] = 'current';
    s.order.push(u);
    r.snap({ kind: 'dequeue', node: u });
    if (depth >= maxDepth) {
      r.snap({ kind: 'cut', node: u, depth });
    } else {
      for (const v of childrenOf(graph, u)) {
        s.activeEdge = edgeKey(u, v);
        if (seen && found.has(v)) {
          r.snap({ kind: 'skip', from: u, to: v });
          continue;
        }
        const again = found.has(v);
        found.add(v);
        queue.push({ node: v, depth: depth + 1 });
        s.pending = queue.map((q) => q.node);
        s.marks[v] = 'frontier';
        s.badges[v] = depth + 1;
        if (!s.treeEdges.includes(s.activeEdge)) s.treeEdges.push(s.activeEdge);
        r.snap({ kind: 'discover', from: u, to: v, again });
      }
    }
    s.activeEdge = null;
    // Khi bỏ seen, bảng vừa xử lý có thể vẫn còn một bản khác trong queue.
    s.marks[u] = queue.some((q) => q.node === u) ? 'frontier' : 'done';
    r.snap({ kind: 'finish', node: u });
  }
  r.snap({ kind: 'done' });
  return r.frames;
}

// DFS đệ quy: vào một bảng, lần lượt gọi đệ quy cho từng bảng con chưa thấy, xong thì quay lui.
// pending là call stack: bảng ở cuối là lời gọi đang chạy.
export function traceDfs(graph: Graph, source: string): Frame<WalkState, WalkEvent>[] {
  const r = new Recorder(emptyState(graph));
  const s = r.s;
  const seen = new Set<string>();
  r.snap({ kind: 'start', source });

  const visit = (u: string, from: string | null) => {
    seen.add(u);
    if (from !== null) s.marks[from] = 'frontier';
    s.marks[u] = 'current';
    s.pending.push(u);
    s.order.push(u);
    s.badges[u] = s.pending.length - 1;
    if (from !== null) s.treeEdges.push(edgeKey(from, u));
    s.activeEdge = from === null ? null : edgeKey(from, u);
    r.snap({ kind: 'enter', node: u, from });
    for (const v of childrenOf(graph, u)) {
      s.activeEdge = edgeKey(u, v);
      if (seen.has(v)) r.snap({ kind: 'skip', from: u, to: v });
      else visit(v, u);
    }
    s.activeEdge = null;
    s.pending.pop();
    s.marks[u] = 'done';
    const back = s.pending.at(-1) ?? null;
    if (back !== null) s.marks[back] = 'current';
    r.snap({ kind: 'leave', node: u, back });
  };

  visit(source, null);
  r.snap({ kind: 'done' });
  return r.frames;
}

// ---------- Các hàm mà test kiểm tra, suy ra từ chính trace được hiển thị ----------

export const bfsOrder = (graph: Graph, source: string, options?: BfsOptions) =>
  traceBfs(graph, source, options).at(-1)!.state.order;

export const bfsDepths = (graph: Graph, source: string, options?: BfsOptions) =>
  traceBfs(graph, source, options).at(-1)!.state.badges;

export const dfsOrder = (graph: Graph, source: string) =>
  traceDfs(graph, source).at(-1)!.state.order;

// ---------- Lời giải tham chiếu để so sánh ----------

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

// DFS không đệ quy: stack giữ (bảng, vị trí bảng con kế tiếp), nên thứ tự thăm phải giống bản đệ quy.
export function dfsIterative(graph: Graph, source: string): string[] {
  const seen = new Set([source]);
  const order = [source];
  const stack = [{ node: source, next: 0 }];
  while (stack.length > 0) {
    const top = stack.at(-1)!;
    const kids = childrenOf(graph, top.node);
    if (top.next === kids.length) {
      stack.pop();
      continue;
    }
    const v = kids[top.next++];
    if (!seen.has(v)) {
      seen.add(v);
      order.push(v);
      stack.push({ node: v, next: 0 });
    }
  }
  return order;
}

// Số đường đi khác nhau từ source tới node trong một DAG. Khi bỏ seen, đó đúng là số lần node
// được lấy ra khỏi queue.
export function countPaths(graph: Graph, source: string, node: string): number {
  if (source === node) return 1;
  return childrenOf(graph, source).reduce((n, v) => n + countPaths(graph, v, node), 0);
}
