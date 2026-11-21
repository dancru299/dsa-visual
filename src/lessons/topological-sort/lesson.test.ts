import { describe, expect, test } from 'vitest';
import type { Frame } from '@/src/engine/types';
import {
  hasCycleBruteForce,
  isTopoOrder,
  nodesOf,
  parentsOf,
  waveNumberBruteForce,
  type TopoEvent,
  type TopoState,
} from './algorithm';
import {
  CODE_GRAPHLIB,
  CYCLE,
  CYCLE_GRAPH,
  DFS,
  GRAPH,
  INDEGREE,
  KAHN,
  LONGEST_PATH,
  RECAP,
  SOURCES,
  TABLES,
  topologicalSortLesson,
  WAVE_COUNT,
  WAVES,
} from './lesson';

type F = Frame<TopoState, TopoEvent>;
const { steps } = topologicalSortLesson;
const built = steps.map((s) => ({ step: s, frames: s.build() as Frame<unknown, unknown>[] }));
const answerOf = (f: Frame<unknown, unknown>) => f.ask!.choices[f.ask!.correct];
const onlyAsk = (frames: F[]) => {
  const asks = frames.filter((f) => f.ask);
  expect(asks).toHaveLength(1);
  return asks[0];
};

describe('bài Topological sort', () => {
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

  test('dữ liệu: TABLES là mọi bảng, GRAPH là DAG, CYCLE_GRAPH có vòng', () => {
    expect(new Set(TABLES)).toEqual(new Set(nodesOf(GRAPH)));
    expect(hasCycleBruteForce(GRAPH)).toBe(false);
    expect(hasCycleBruteForce(CYCLE_GRAPH)).toBe(true);
  });

  test('code graphlib liệt kê đúng các bảng nó phụ thuộc', () => {
    for (const t of TABLES) {
      const line = CODE_GRAPHLIB.find((l) => l.trim().startsWith(`'${t}':`));
      const parents = parentsOf(GRAPH, t);
      if (parents.length === 0) expect(line).toBeUndefined();
      else parents.forEach((p) => expect(line).toContain(`'${p}'`));
    }
  });

  test('bậc vào: đáp án là đúng các bảng có bậc vào 0 ở frame cuối', () => {
    const f = onlyAsk(INDEGREE);
    expect(f).toBe(INDEGREE.at(-1));
    expect(f.state.pending).toEqual(SOURCES);
    expect(answerOf(f)).toBe(SOURCES.join(' và '));
  });

  test('Kahn: câu đoán ở lần giảm mà chưa về 0, và kết quả là thứ tự hợp lệ', () => {
    const f = onlyAsk(KAHN);
    expect(f.event.kind === 'decrement' && f.event.left).toBeGreaterThan(0);
    expect(answerOf(f).startsWith('Chưa')).toBe(true);
    if (f.event.kind === 'decrement') expect(f.state.pending).not.toContain(f.event.to);
    expect(isTopoOrder(GRAPH, KAHN.at(-1)!.state.order)).toBe(true);
  });

  test('chia đợt: đáp án bằng số đợt thật sự và bằng số bảng trên đường dài nhất', () => {
    const f = onlyAsk(WAVES);
    const waves = WAVES.filter((x) => x.event.kind === 'wave').length;
    expect(answerOf(f)).toBe(String(waves));
    expect(WAVE_COUNT).toBe(waves);
    expect(LONGEST_PATH).toHaveLength(waves);
    LONGEST_PATH.slice(1).forEach((t, i) => expect(GRAPH[LONGEST_PATH[i]]).toContain(t));
    expect(Math.max(...Object.values(waveNumberBruteForce(GRAPH, TABLES)))).toBe(waves);
  });

  test('có vòng: câu đoán ở frame bị kẹt, và vòng tìm được nằm trong CYCLE_GRAPH', () => {
    const f = onlyAsk(CYCLE);
    expect(f.event.kind).toBe('stuck');
    expect(answerOf(f).startsWith('Có vòng')).toBe(true);
    if (f.event.kind === 'stuck') {
      const { cycle } = f.event;
      cycle.slice(1).forEach((v, i) => expect(CYCLE_GRAPH[cycle[i]]).toContain(v));
    }
  });

  test('DFS: bảng return đầu tiên đứng cuối thứ tự chạy, và thứ tự hợp lệ', () => {
    const f = onlyAsk(DFS);
    expect(f.event.kind).toBe('leave');
    const order = DFS.at(-1)!.state.order;
    if (f.event.kind === 'leave') expect(order.at(-1)).toBe(f.event.node);
    expect(answerOf(f)).toBe('Cuối cùng');
    expect(isTopoOrder(GRAPH, order)).toBe(true);
  });

  test('tóm tắt: một hàng cho mỗi đợt, gồm đủ mọi bảng', () => {
    const rows = RECAP.at(-1)!.state.rows;
    expect(rows).toHaveLength(WAVE_COUNT);
    expect(rows.flatMap((r) => r[1].split(', ')).sort()).toEqual([...TABLES].sort());
  });
});
