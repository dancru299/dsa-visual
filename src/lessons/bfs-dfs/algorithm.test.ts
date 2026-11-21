import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import {
  bfsDepths,
  bfsOrder,
  childrenOf,
  countPaths,
  dfsIterative,
  dfsOrder,
  shortestHopsBruteForce,
  traceDfs,
  traceRead,
  type Graph,
} from './algorithm';

const name = (i: number) => `n${i}`;

// Đồ thị có hướng ngẫu nhiên trên các node n0..n(size-1), có thể có vòng và cạnh tự trỏ.
// dag: chỉ giữ cạnh từ số nhỏ sang số lớn, nên không có vòng.
const graphArb = (dag: boolean, maxNodes = 8) =>
  fc.integer({ min: 1, max: maxNodes }).chain((size) =>
    fc.array(fc.tuple(fc.nat(size - 1), fc.nat(size - 1)), { maxLength: size * 3 }).map((pairs) => {
      const g: Record<string, string[]> = {};
      for (const [a, b] of pairs) {
        if (dag && a >= b) continue;
        const list = (g[name(a)] ??= []);
        if (!list.includes(name(b))) list.push(name(b));
      }
      return { graph: g as Graph, source: name(0) };
    }),
  );

describe('BFS', () => {
  test('số bước tới mỗi bảng bằng số bước ít nhất của lời giải brute-force', () => {
    fc.assert(
      fc.property(graphArb(false), ({ graph, source }) => {
        expect(bfsDepths(graph, source)).toEqual(shortestHopsBruteForce(graph, source));
      }),
      { numRuns: 1000 },
    );
  });

  test('mỗi bảng tới được lấy ra đúng một lần, theo số bước không giảm', () => {
    fc.assert(
      fc.property(graphArb(false), ({ graph, source }) => {
        const order = bfsOrder(graph, source);
        const dist = shortestHopsBruteForce(graph, source);
        expect(new Set(order).size).toBe(order.length);
        expect(new Set(order)).toEqual(new Set(Object.keys(dist)));
        const depths = order.map((n) => dist[n]);
        expect(depths).toEqual([...depths].sort((a, b) => a - b));
      }),
      { numRuns: 1000 },
    );
  });

  test('giới hạn n bước chọn đúng các bảng cách nguồn không quá n bước', () => {
    fc.assert(
      fc.property(graphArb(false), fc.nat(4), ({ graph, source }, n) => {
        const dist = shortestHopsBruteForce(graph, source);
        const within = Object.keys(dist).filter((v) => dist[v] <= n);
        expect(new Set(bfsOrder(graph, source, { maxDepth: n }))).toEqual(new Set(within));
      }),
      { numRuns: 1000 },
    );
  });

  test('bỏ seen trên DAG: mỗi bảng bị lấy ra đúng bằng số đường đi tới nó', () => {
    fc.assert(
      fc.property(graphArb(true, 7), ({ graph, source }) => {
        const order = bfsOrder(graph, source, { seen: false });
        for (const v of new Set(order)) {
          expect(order.filter((x) => x === v).length).toBe(countPaths(graph, source, v));
        }
      }),
      { numRuns: 500 },
    );
  });
});

describe('DFS', () => {
  test('thứ tự thăm của bản đệ quy giống bản dùng stack tường minh', () => {
    fc.assert(
      fc.property(graphArb(false), ({ graph, source }) => {
        expect(dfsOrder(graph, source)).toEqual(dfsIterative(graph, source));
      }),
      { numRuns: 1000 },
    );
  });

  test('vào và ra lồng nhau như call stack, và call stack luôn là một đường đi trong đồ thị', () => {
    fc.assert(
      fc.property(graphArb(false), ({ graph, source }) => {
        const stack: string[] = [];
        for (const f of traceDfs(graph, source)) {
          const e = f.event;
          if (e.kind === 'enter') {
            expect(e.from).toBe(stack.at(-1) ?? null);
            stack.push(e.node);
          }
          if (e.kind === 'leave') expect(stack.pop()).toBe(e.node);
          expect(f.state.pending).toEqual(stack);
          stack.slice(1).forEach((v, i) => expect(childrenOf(graph, stack[i])).toContain(v));
        }
        expect(stack).toEqual([]);
      }),
      { numRuns: 1000 },
    );
  });
});

describe('đọc danh sách kề', () => {
  test('mỗi frame đọc đúng danh sách con của bảng đó', () => {
    fc.assert(
      fc.property(graphArb(false), ({ graph }) => {
        const tables = Object.keys(graph);
        if (tables.length === 0) return;
        const frames = traceRead(graph, tables);
        for (const f of frames) {
          if (f.event.kind === 'read')
            expect(f.state.pending).toEqual(childrenOf(graph, f.event.node));
        }
        expect(frames.at(-1)!.state.order).toEqual(tables);
      }),
      { numRuns: 300 },
    );
  });
});
