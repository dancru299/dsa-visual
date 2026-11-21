import { describe, expect, test } from 'vitest';
import { choiceOrder } from '@/src/lib/choiceOrder';
import { BUILT_LESSONS } from './catalog';
import { LESSONS } from './index';
import { BFS_SMALL, DFS_SMALL, WRONG_SMALL } from './bfs-dfs/quiz';
import { BISECT_INDEX, DATES, TARGET_DATE } from './binary-search/quiz';
import { worstCaseBinary } from './binary-search/algorithm';
import { ARRAY } from './heap/quiz';
import { isHeap } from './heap/algorithm';
import { CROSSED, CROSSED_VALID, POPPED } from './stack/quiz';
import { isValidBruteForce } from './stack/algorithm';
import { RING, RING_TAIL } from './queue/quiz';
import { ORDERS, SMALL as TOPO_SMALL } from './topological-sort/quiz';
import { isTopoOrder } from './topological-sort/algorithm';

describe('quiz cuối bài', () => {
  test.each(BUILT_LESSONS.map((l) => [l.slug]))('%s: ít nhất 3 câu, mỗi câu hợp lệ', (slug) => {
    const { quiz, steps } = LESSONS[slug];
    expect(quiz.length).toBeGreaterThanOrEqual(3);
    expect(new Set(quiz.map((q) => q.prompt)).size).toBe(quiz.length);
    for (const q of quiz) {
      expect(q.choices.length, q.prompt).toBeGreaterThanOrEqual(2);
      expect(new Set(q.choices).size, q.prompt).toBe(q.choices.length);
      expect(q.correct, q.prompt).toBeGreaterThanOrEqual(0);
      expect(q.correct, q.prompt).toBeLessThan(q.choices.length);
      expect(Number.isInteger(q.step) && q.step >= 0 && q.step < steps.length, q.prompt).toBe(true);
      expect(q.explain.length, q.prompt).toBeGreaterThan(20);
      // Thứ tự hiển thị là một hoán vị của các đáp án: không mất, không lặp lựa chọn nào.
      expect([...choiceOrder(q)].sort()).toEqual(q.choices.map((_, i) => i));
    }
  });

  test('đáp án đúng không dồn vào một vị trí sau khi xáo', () => {
    const positions = BUILT_LESSONS.flatMap(({ slug }) =>
      LESSONS[slug].quiz.map((q) => choiceOrder(q).indexOf(q.correct)),
    );
    const counts = [0, 1, 2].map((p) => positions.filter((x) => x === p).length);
    // Không vị trí nào chiếm quá 60% số câu.
    counts.forEach((c) => expect(c).toBeLessThan(positions.length * 0.6));
  });
});

describe('đáp án tính từ code thuật toán', () => {
  test('binary search: số lần so và bisect_left', () => {
    expect(worstCaseBinary(1e9)).toBe(30);
    expect(worstCaseBinary(2e6) - worstCaseBinary(1e6)).toBe(1);
    expect([...DATES].sort()).toEqual(DATES);
    expect(DATES[BISECT_INDEX - 1] < TARGET_DATE && TARGET_DATE < DATES[BISECT_INDEX]).toBe(true);
  });

  test('stack: thứ tự pop, và chuỗi ngoặc chéo nhau không hợp lệ', () => {
    expect(POPPED).toEqual(['B', 'C', 'A']);
    expect(CROSSED_VALID).toBe(false);
    expect(isValidBruteForce(CROSSED)).toBe(false);
  });

  test('queue: ô ghi tiếp của ring buffer quay vòng', () => {
    expect(RING_TAIL).toBe((RING.head + RING.size) % RING.capacity);
    expect(RING_TAIL).toBeLessThan(RING.head);
  });

  test('heap: list trong câu hỏi là một min-heap', () => {
    expect(isHeap(ARRAY)).toBe(true);
  });

  test('BFS và DFS: ba thứ tự khác nhau, chỉ thứ tự đầu là BFS', () => {
    expect(new Set([BFS_SMALL, DFS_SMALL, WRONG_SMALL].map((o) => o.join())).size).toBe(3);
  });

  test('topological sort: chỉ lựa chọn đầu tiên là thứ tự hợp lệ', () => {
    expect(ORDERS.map((o) => isTopoOrder(TOPO_SMALL, o))).toEqual([true, false, false]);
  });
});
