import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { affected, shortestHopsBruteForce, traceBfs, type Graph } from './algorithm';
import { LINEAGE } from './data';

// Đồ thị có hướng ngẫu nhiên, tối đa 7 node n0..n6, có thể có chu trình và cạnh tự trỏ.
const graph: fc.Arbitrary<Graph> = fc
  .uniqueArray(fc.tuple(fc.integer({ min: 0, max: 6 }), fc.integer({ min: 0, max: 6 })), {
    maxLength: 16,
    selector: ([a, b]) => `${a}-${b}`,
  })
  .map((edges) => {
    const g: Record<string, string[]> = { n0: [] };
    for (const [a, b] of edges) (g[`n${a}`] ??= []).push(`n${b}`);
    return g;
  });

describe('BFS trên lineage', () => {
  test('raw_orders đổi thì 4 bảng phía sau bị ảnh hưởng, theo thứ tự từng lớp', () => {
    expect(affected(LINEAGE, 'raw_orders')).toEqual([
      'raw_orders',
      'stg_orders',
      'orders_snapshot',
      'fct_orders',
      'revenue_dashboard',
    ]);
  });

  test('bảng không nằm phía sau raw_orders thì không bị chạm tới', () => {
    const marks = traceBfs(LINEAGE, 'raw_orders').at(-1)!.state.marks;
    expect(marks['raw_customers']).toBe('idle');
    expect(marks['dim_customers']).toBe('idle');
  });

  test('tập bảng tới được khớp với brute-force, mỗi bảng chỉ được lấy ra một lần', () => {
    fc.assert(
      fc.property(graph, (g) => {
        const order = affected(g, 'n0');
        expect(new Set(order).size).toBe(order.length);
        expect(new Set(order)).toEqual(new Set(Object.keys(shortestHopsBruteForce(g, 'n0'))));
      }),
      { numRuns: 1000 },
    );
  });

  test('số bước BFS tính ra là đường ngắn nhất, và thứ tự lấy ra không bao giờ lùi lớp', () => {
    fc.assert(
      fc.property(graph, (g) => {
        const { dist, order } = traceBfs(g, 'n0').at(-1)!.state;
        expect(dist).toEqual(shortestHopsBruteForce(g, 'n0'));
        for (let i = 1; i < order.length; i++) {
          expect(dist[order[i]]).toBeGreaterThanOrEqual(dist[order[i - 1]]);
        }
      }),
      { numRuns: 1000 },
    );
  });

  test('queue không bao giờ chứa một bảng hai lần', () => {
    fc.assert(
      fc.property(graph, (g) => {
        for (const f of traceBfs(g, 'n0')) {
          expect(new Set(f.state.pending).size).toBe(f.state.pending.length);
        }
      }),
      { numRuns: 300 },
    );
  });
});
