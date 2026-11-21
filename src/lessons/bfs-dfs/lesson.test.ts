import { describe, expect, test } from 'vitest';
import type { Frame } from '@/src/engine/types';
import {
  childrenOf,
  countPaths,
  nodesOf,
  parentsOf,
  shortestHopsBruteForce,
  type WalkEvent,
  type WalkState,
} from './algorithm';
import {
  BFS,
  bfsDfsLesson,
  DFS,
  GRAPH,
  LIMIT,
  LIMITED,
  NO_SEEN,
  READ,
  RECAP,
  SOURCE,
  TABLES,
} from './lesson';

type F = Frame<WalkState, WalkEvent>;
const { steps } = bfsDfsLesson;
const built = steps.map((s) => ({ step: s, frames: s.build() as Frame<unknown, unknown>[] }));
const answerOf = (f: Frame<unknown, unknown>) => f.ask!.choices[f.ask!.correct];
const onlyAsk = (frames: F[]) => {
  const asks = frames.filter((f) => f.ask);
  expect(asks).toHaveLength(1);
  return asks[0];
};
const DIST = shortestHopsBruteForce(GRAPH, SOURCE);

describe('bài BFS và DFS', () => {
  test('mỗi bước có ít nhất hai frame, id không trùng, frame đầu không có câu đoán', () => {
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    for (const { step, frames } of built) {
      expect(frames.length, step.id).toBeGreaterThan(1);
      expect(frames[0].ask, step.id).toBeUndefined();
    }
    expect(built.flatMap((b) => b.frames.filter((f) => f.ask)).length).toBeGreaterThanOrEqual(3);
  });

  test('mọi câu đoán có lựa chọn không trùng nhau', () => {
    for (const { frames } of built)
      for (const f of frames.filter((x) => x.ask))
        expect(new Set(f.ask!.choices).size).toBe(f.ask!.choices.length);
  });

  test('dữ liệu: TABLES là mọi bảng của graph, xếp theo số bước, và mọi bảng tới được từ nguồn', () => {
    expect(new Set(TABLES)).toEqual(new Set(nodesOf(GRAPH)));
    expect(new Set(Object.keys(DIST))).toEqual(new Set(TABLES));
    const depths = TABLES.map((t) => DIST[t]);
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
  });

  test('đồ thị: câu đoán ở một bảng không có bảng con nhưng có nhiều bảng nguồn', () => {
    const f = onlyAsk(READ);
    expect(f.event.kind).toBe('read');
    if (f.event.kind === 'read') {
      expect(childrenOf(GRAPH, f.event.node)).toEqual([]);
      expect(parentsOf(GRAPH, f.event.node).length).toBeGreaterThanOrEqual(2);
    }
  });

  test('BFS: đáp án là bảng thật sự được lấy ra, và nó ở đầu queue', () => {
    const f = onlyAsk(BFS);
    const k = BFS.indexOf(f);
    expect(f.event.kind).toBe('dequeue');
    if (f.event.kind === 'dequeue') {
      expect(answerOf(f)).toBe(f.event.node);
      expect(BFS[k - 1].state.pending[0]).toBe(f.event.node);
    }
  });

  test('DFS: đáp án là bảng thật sự được thăm, và nó xa nguồn hơn bảng bị để lại', () => {
    const f = onlyAsk(DFS);
    expect(f.event.kind).toBe('enter');
    if (f.event.kind === 'enter') {
      expect(answerOf(f)).toBe(f.event.node);
      const other = f.ask!.choices.find((c) => c !== answerOf(f))!;
      expect(DIST[other]).toBeLessThan(DIST[f.event.node]);
    }
    expect(DFS.at(-1)!.state.order).toHaveLength(TABLES.length);
  });

  test('bỏ seen: câu đoán ở lần thêm trùng đầu tiên, và số lần lấy ra bằng số đường đi', () => {
    const f = onlyAsk(NO_SEEN);
    expect(f.event.kind === 'discover' && f.event.again).toBe(true);
    const order = NO_SEEN.at(-1)!.state.order;
    for (const t of TABLES) {
      expect(order.filter((x) => x === t).length).toBe(countPaths(GRAPH, SOURCE, t));
    }
    expect(order.length).toBeGreaterThan(TABLES.length);
  });

  test('giới hạn n bước: câu đoán ở bảng đầu tiên chạm giới hạn, và chỉ chọn bảng trong phạm vi', () => {
    const f = onlyAsk(LIMITED);
    expect(f.event.kind === 'cut' && f.event.depth).toBe(LIMIT);
    expect(new Set(LIMITED.at(-1)!.state.order)).toEqual(
      new Set(TABLES.filter((t) => DIST[t] <= LIMIT)),
    );
  });

  test('tóm tắt: một hàng cho mỗi bảng, cột BFS có số bước không giảm', () => {
    const rows = RECAP.at(-1)!.state.rows;
    expect(rows).toHaveLength(TABLES.length);
    const bfsDepths = rows.map((r) => Number(r[1].match(/\((\d+)\)/)![1]));
    expect(bfsDepths).toEqual([...bfsDepths].sort((a, b) => a - b));
    expect(rows.map((r) => r[2].split(' ')[0])).toEqual(DFS.at(-1)!.state.order);
  });
});
