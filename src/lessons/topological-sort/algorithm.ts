import type { Frame } from '@/src/engine/types';
import {
  childrenOf,
  edgeKey,
  nodesOf,
  parentsOf,
  type Graph,
  type NodeMark,
} from '../bfs-dfs/algorithm';

export { edgeKey, nodesOf, parentsOf, type Graph };

// Khớp về cấu trúc với GraphSceneState của src/scenes/GraphScene.tsx.
export type TopoState = {
  marks: Record<string, NodeMark>;
  activeEdge: string | null;
  treeEdges: string[]; // cạnh được tô đậm: cạnh vừa mở khoá một bảng, hoặc cạnh của vòng
  pending: string[]; // bảng sẵn sàng (Kahn), đợt đang chạy, hoặc call stack (DFS)
  order: string[]; // thứ tự chạy tìm được tới lúc này
  badges: Record<string, number>; // bậc vào còn lại, hoặc số thứ tự đợt
};

export type TopoEvent =
  | { kind: 'start' }
  | { kind: 'count'; from: string; to: string } // bậc vào của to tăng 1
  | { kind: 'dequeue'; node: string } // Kahn: lấy một bảng sẵn sàng ra chạy
  | { kind: 'decrement'; from: string; to: string; left: number } // left = 0: to sẵn sàng
  | { kind: 'stuck'; left: string[]; cycle: string[] } // hết bảng sẵn sàng mà vẫn còn bảng
  | { kind: 'wave'; index: number; nodes: string[] } // một đợt chạy song song
  | { kind: 'enter'; node: string; from: string | null } // DFS: gọi visit(node)
  | { kind: 'skip'; from: string; to: string } // DFS: bảng đã thấy
  | { kind: 'leave'; node: string } // DFS: mọi bảng phía sau đã xong, return
  | { kind: 'done' };

type Frames = Frame<TopoState, TopoEvent>[];

export function indegreeOf(graph: Graph, tables: readonly string[]): Record<string, number> {
  const indegree = Object.fromEntries(tables.map((t) => [t, 0]));
  for (const u of Object.keys(graph)) for (const v of childrenOf(graph, u)) indegree[v]++;
  return indegree;
}

function emptyState(tables: readonly string[]): TopoState {
  return {
    marks: Object.fromEntries(tables.map((t): [string, NodeMark] => [t, 'idle'])),
    activeEdge: null,
    treeEdges: [],
    pending: [],
    order: [],
    badges: {},
  };
}

function recorder(s: TopoState) {
  const frames: Frames = [];
  return { frames, snap: (event: TopoEvent) => frames.push({ state: structuredClone(s), event }) };
}

const ready = (s: TopoState, tables: readonly string[]) => tables.filter((t) => s.badges[t] === 0);

// Bước 1: đếm bậc vào bằng cách duyệt mọi cạnh. pending là các bảng đang có bậc vào 0.
export function traceIndegree(graph: Graph, tables: readonly string[]): Frames {
  const s = emptyState(tables);
  const { frames, snap } = recorder(s);
  tables.forEach((t) => (s.badges[t] = 0));
  s.pending = [...tables];
  snap({ kind: 'start' });
  for (const u of Object.keys(graph)) {
    s.marks[u] = 'current';
    for (const v of childrenOf(graph, u)) {
      s.activeEdge = edgeKey(u, v);
      s.badges[v]++;
      s.pending = ready(s, tables);
      snap({ kind: 'count', from: u, to: v });
    }
    s.marks[u] = 'idle';
    s.order.push(u);
  }
  s.activeEdge = null;
  s.pending.forEach((t) => (s.marks[t] = 'frontier'));
  snap({ kind: 'done' });
  return frames;
}

// Tìm một vòng bằng DFS ba màu: gặp lại một bảng đang nằm trên call stack là có vòng.
export function findCycle(graph: Graph, tables: readonly string[]): string[] | null {
  const color: Record<string, 'white' | 'gray' | 'black'> = Object.fromEntries(
    tables.map((t) => [t, 'white']),
  );
  const stack: string[] = [];
  const visit = (u: string): string[] | null => {
    color[u] = 'gray';
    stack.push(u);
    for (const v of childrenOf(graph, u)) {
      if (color[v] === 'gray') return [...stack.slice(stack.indexOf(v)), v];
      if (color[v] === 'white') {
        const found = visit(v);
        if (found) return found;
      }
    }
    stack.pop();
    color[u] = 'black';
    return null;
  };
  for (const t of tables) {
    if (color[t] !== 'white') continue;
    const found = visit(t);
    if (found) return found;
  }
  return null;
}

// Thuật toán Kahn: bảng nào hết phải chờ (bậc vào 0) thì vào queue; chạy xong một bảng thì giảm
// bậc vào của các bảng phía sau nó.
export function traceKahn(graph: Graph, tables: readonly string[]): Frames {
  const s = emptyState(tables);
  const { frames, snap } = recorder(s);
  s.badges = indegreeOf(graph, tables);
  const queue = ready(s, tables);
  queue.forEach((t) => (s.marks[t] = 'frontier'));
  s.pending = [...queue];
  snap({ kind: 'start' });

  while (queue.length > 0) {
    const u = queue.shift()!;
    s.pending = [...queue];
    s.marks[u] = 'current';
    s.order.push(u);
    snap({ kind: 'dequeue', node: u });
    for (const v of childrenOf(graph, u)) {
      s.activeEdge = edgeKey(u, v);
      s.badges[v]--;
      if (s.badges[v] === 0) {
        queue.push(v);
        s.pending = [...queue];
        s.marks[v] = 'frontier';
        s.treeEdges.push(s.activeEdge);
      }
      snap({ kind: 'decrement', from: u, to: v, left: s.badges[v] });
    }
    s.activeEdge = null;
    s.marks[u] = 'done';
  }

  const left = tables.filter((t) => !s.order.includes(t));
  if (left.length > 0) {
    const cycle = findCycle(graph, tables) ?? [];
    cycle.forEach((t) => (s.marks[t] = 'current'));
    s.treeEdges = cycle.slice(1).map((v, i) => edgeKey(cycle[i], v));
    snap({ kind: 'stuck', left, cycle });
  } else {
    snap({ kind: 'done' });
  }
  return frames;
}

// Chia thành đợt: mỗi đợt là mọi bảng đang sẵn sàng, chạy song song cùng lúc.
export function traceWaves(graph: Graph, tables: readonly string[]): Frames {
  const s = emptyState(tables);
  const { frames, snap } = recorder(s);
  const indegree = indegreeOf(graph, tables);
  snap({ kind: 'start' });
  let wave = tables.filter((t) => indegree[t] === 0);
  let index = 0;
  while (wave.length > 0) {
    index++;
    s.order.push(...s.pending);
    s.pending.forEach((t) => (s.marks[t] = 'done'));
    wave.forEach((t) => {
      s.marks[t] = 'current';
      s.badges[t] = index;
    });
    s.pending = [...wave];
    snap({ kind: 'wave', index, nodes: [...wave] });
    const next: string[] = [];
    for (const u of wave) {
      for (const v of childrenOf(graph, u)) if (--indegree[v] === 0) next.push(v);
    }
    wave = tables.filter((t) => next.includes(t));
  }
  s.order.push(...s.pending);
  s.pending.forEach((t) => (s.marks[t] = 'done'));
  s.pending = [];
  snap({ kind: 'done' });
  return frames;
}

// Cách thứ hai: DFS. Một bảng chỉ return khi mọi bảng phía sau nó đã return, nên đảo ngược thứ
// tự return là ra thứ tự chạy. order ở đây là kết quả tới lúc này: bảng vừa return thêm vào đầu.
export function traceTopoDfs(graph: Graph, tables: readonly string[]): Frames {
  const s = emptyState(tables);
  const { frames, snap } = recorder(s);
  const seen = new Set<string>();
  snap({ kind: 'start' });

  const visit = (u: string, from: string | null) => {
    seen.add(u);
    if (from !== null) {
      s.marks[from] = 'frontier';
      s.treeEdges.push(edgeKey(from, u));
    }
    s.marks[u] = 'current';
    s.pending.push(u);
    s.activeEdge = from === null ? null : edgeKey(from, u);
    snap({ kind: 'enter', node: u, from });
    for (const v of childrenOf(graph, u)) {
      s.activeEdge = edgeKey(u, v);
      if (seen.has(v)) snap({ kind: 'skip', from: u, to: v });
      else visit(v, u);
    }
    s.activeEdge = null;
    s.pending.pop();
    s.marks[u] = 'done';
    s.order.unshift(u);
    const back = s.pending.at(-1);
    if (back !== undefined) s.marks[back] = 'current';
    snap({ kind: 'leave', node: u });
  };

  for (const t of tables) if (!seen.has(t)) visit(t, null);
  snap({ kind: 'done' });
  return frames;
}

// ---------- Các hàm mà test kiểm tra, suy ra từ chính trace được hiển thị ----------

export const kahnOrder = (graph: Graph, tables: readonly string[]) =>
  traceKahn(graph, tables).at(-1)!.state.order;

export const dfsTopoOrder = (graph: Graph, tables: readonly string[]) =>
  traceTopoDfs(graph, tables).at(-1)!.state.order;

export const wavesOf = (graph: Graph, tables: readonly string[]) =>
  traceWaves(graph, tables).flatMap((f) => (f.event.kind === 'wave' ? [f.event.nodes] : []));

// ---------- Lời giải tham chiếu để so sánh ----------

// Thứ tự hợp lệ khi mọi cạnh u → v đều có u đứng trước v.
export function isTopoOrder(graph: Graph, order: readonly string[]): boolean {
  const pos = new Map(order.map((t, i) => [t, i]));
  return Object.keys(graph).every((u) =>
    childrenOf(graph, u).every((v) => pos.has(u) && pos.has(v) && pos.get(u)! < pos.get(v)!),
  );
}

// Có vòng khi có cạnh u → v mà từ v lại đi tới được u. Chậm nhưng không phụ thuộc thuật toán nào.
export function hasCycleBruteForce(graph: Graph): boolean {
  const reach = (from: string, target: string): boolean => {
    const seen = new Set([from]);
    const stack = [from];
    while (stack.length > 0) {
      const u = stack.pop()!;
      if (u === target) return true;
      for (const v of childrenOf(graph, u)) {
        if (!seen.has(v)) {
          seen.add(v);
          stack.push(v);
        }
      }
    }
    return false;
  };
  return Object.keys(graph).some((u) => childrenOf(graph, u).some((v) => reach(v, u)));
}

// Đợt của mỗi bảng = 1 + đợt lớn nhất trong các bảng nó phụ thuộc (bảng nguồn ở đợt 1).
// Số đợt bằng số bảng trên đường dài nhất. Chỉ dùng cho DAG.
export function waveNumberBruteForce(graph: Graph, tables: readonly string[]) {
  const memo: Record<string, number> = {};
  const wave = (t: string): number =>
    (memo[t] ??= 1 + Math.max(0, ...parentsOf(graph, t).map(wave)));
  return Object.fromEntries(tables.map((t) => [t, wave(t)]));
}
