import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import {
  dfsTopoOrder,
  findCycle,
  hasCycleBruteForce,
  indegreeOf,
  isTopoOrder,
  kahnOrder,
  parentsOf,
  traceIndegree,
  traceKahn,
  waveNumberBruteForce,
  wavesOf,
  type Graph,
} from './algorithm';

const name = (i: number) => `n${i}`;

// Đồ thị có hướng ngẫu nhiên trên n0..n(size-1). dag: chỉ giữ cạnh từ số nhỏ sang số lớn.
// tables có đủ mọi node, kể cả node không có cạnh nào.
const graphArb = (dag: boolean) =>
  fc.integer({ min: 1, max: 9 }).chain((size) =>
    fc.array(fc.tuple(fc.nat(size - 1), fc.nat(size - 1)), { maxLength: size * 3 }).map((pairs) => {
      const g: Record<string, string[]> = {};
      for (const [a, b] of pairs) {
        if (dag ? a >= b : a === b) continue;
        const list = (g[name(a)] ??= []);
        if (!list.includes(name(b))) list.push(name(b));
      }
      const tables = Array.from({ length: size }, (_, i) => name(i));
      return { graph: g as Graph, tables };
    }),
  );

describe('bậc vào', () => {
  test('bậc vào của mỗi bảng bằng số bảng nó phụ thuộc', () => {
    fc.assert(
      fc.property(graphArb(false), ({ graph, tables }) => {
        const counted = traceIndegree(graph, tables).at(-1)!.state.badges;
        for (const t of tables) expect(counted[t]).toBe(parentsOf(graph, t).length);
        expect(indegreeOf(graph, tables)).toEqual(counted);
      }),
      { numRuns: 500 },
    );
  });
});

describe('Kahn', () => {
  test('trên DAG: ra đủ mọi bảng, theo một thứ tự hợp lệ', () => {
    fc.assert(
      fc.property(graphArb(true), ({ graph, tables }) => {
        const order = kahnOrder(graph, tables);
        expect([...order].sort()).toEqual([...tables].sort());
        expect(isTopoOrder(graph, order)).toBe(true);
      }),
      { numRuns: 1000 },
    );
  });

  test('bị kẹt khi và chỉ khi đồ thị có vòng, và vòng tìm được là vòng thật', () => {
    fc.assert(
      fc.property(graphArb(false), ({ graph, tables }) => {
        const last = traceKahn(graph, tables).at(-1)!;
        const cyclic = hasCycleBruteForce(graph);
        expect(last.event.kind).toBe(cyclic ? 'stuck' : 'done');
        if (last.event.kind === 'stuck') {
          const { cycle } = last.event;
          expect(cycle[0]).toBe(cycle.at(-1));
          cycle.slice(1).forEach((v, i) => expect(graph[cycle[i]]).toContain(v));
          // Mọi bảng trên vòng đều không bao giờ hết phải chờ.
          cycle.forEach((t) => expect(last.event.kind === 'stuck' && last.event.left).toContain(t));
        }
        expect(findCycle(graph, tables) !== null).toBe(cyclic);
      }),
      { numRuns: 1000 },
    );
  });
});

describe('chia đợt', () => {
  test('mỗi bảng nằm ở đợt = 1 + đợt lớn nhất của các bảng nó phụ thuộc', () => {
    fc.assert(
      fc.property(graphArb(true), ({ graph, tables }) => {
        const expected = waveNumberBruteForce(graph, tables);
        wavesOf(graph, tables).forEach((wave, i) =>
          wave.forEach((t) => expect(expected[t]).toBe(i + 1)),
        );
        expect(wavesOf(graph, tables).flat().sort()).toEqual([...tables].sort());
      }),
      { numRuns: 1000 },
    );
  });
});

describe('DFS', () => {
  test('trên DAG: đảo ngược thứ tự return cho một thứ tự hợp lệ gồm đủ mọi bảng', () => {
    fc.assert(
      fc.property(graphArb(true), ({ graph, tables }) => {
        const order = dfsTopoOrder(graph, tables);
        expect([...order].sort()).toEqual([...tables].sort());
        expect(isTopoOrder(graph, order)).toBe(true);
      }),
      { numRuns: 1000 },
    );
  });
});
