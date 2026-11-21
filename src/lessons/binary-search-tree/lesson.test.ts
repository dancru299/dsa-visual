import { describe, expect, test } from 'vitest';
import type { Frame } from '@/src/engine/types';
import { build, comparesOf, heightOf, type BstEvent, type BstState } from './algorithm';
import {
  ADDED,
  bstLesson,
  HEIGHT_ROWS,
  INORDER,
  INSERT,
  KEYS,
  RANGE,
  RANGED,
  RECAP,
  SEARCH,
  SORTED,
  SORTED_KEYS,
  TARGET,
} from './lesson';
import { QUIZ_NEW, QUIZ_PARENT, QUIZ_SIDE } from './quiz';

type F = Frame<BstState, BstEvent>;
const { steps } = bstLesson;
const built = steps.map((s) => ({ step: s, frames: s.build() as Frame<unknown, unknown>[] }));
const answerOf = (f: Frame<unknown, unknown>) => f.ask!.choices[f.ask!.correct];
const onlyAsk = (frames: F[]) => {
  const asks = frames.filter((f) => f.ask);
  expect(asks).toHaveLength(1);
  return asks[0];
};

describe('bài Binary Search Tree', () => {
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

  test('tìm: đáp án là số lần so thật sự, và tìm thấy khoá', () => {
    expect(answerOf(onlyAsk(SEARCH))).toBe(String(comparesOf(SEARCH)));
    expect(SEARCH.some((f) => f.event.kind === 'found' && f.event.key === TARGET)).toBe(true);
  });

  test('chèn: câu đoán ở chỗ trống, đúng chỗ khoá mới được gắn vào', () => {
    const f = onlyAsk(INSERT);
    expect(f.event.kind).toBe('empty');
    const ins = INSERT.find((x) => x.event.kind === 'insert')!.event;
    if (f.event.kind === 'empty' && ins.kind === 'insert') {
      expect(ins.key).toBe(ADDED);
      expect(ins.parent).toBe(f.event.parent);
      expect(ins.side).toBe(f.event.side);
      expect(answerOf(f)).toContain(`của ${f.event.parent}`);
    }
  });

  test('duyệt: đáp án là khoá in ra đầu tiên, và kết quả đã sort', () => {
    const first = INORDER.find((f) => f.event.kind === 'emit')!.event;
    expect(first.kind === 'emit' && answerOf(onlyAsk(INORDER))).toBe(
      first.kind === 'emit' && String(first.key),
    );
    expect(INORDER.at(-1)!.state.out).toEqual([...KEYS].sort((a, b) => a - b));
  });

  test('khoảng: câu đoán ở nhánh bỏ qua đầu tiên, node đó nhỏ hơn cận dưới', () => {
    const f = onlyAsk(RANGED);
    expect(f.event.kind === 'prune' && f.event.side).toBe('left');
    if (f.event.kind === 'prune') expect(f.event.key).toBeLessThan(RANGE[0]);
    const [lo, hi] = RANGE;
    expect(RANGED.at(-1)!.state.out).toEqual(
      [...KEYS].sort((a, b) => a - b).filter((k) => lo <= k && k <= hi),
    );
  });

  test('khoá đã sort: đáp án là số lần so khi chèn khoá cuối, và cây thành chuỗi', () => {
    const last = SORTED_KEYS.at(-1)!;
    const compares = SORTED.filter(
      (f) => f.event.kind === 'compare' && f.event.target === last,
    ).length;
    expect(answerOf(onlyAsk(SORTED))).toBe(String(compares));
    expect(compares).toBe(SORTED_KEYS.length - 1);
    expect(heightOf(build(SORTED_KEYS))).toBe(SORTED_KEYS.length);
  });

  test('tóm tắt: bảng chiều cao khớp với số đo, và cây ngẫu nhiên nằm giữa hai cực', () => {
    expect(RECAP.at(-1)!.state.rows).toHaveLength(HEIGHT_ROWS.length);
    for (const r of HEIGHT_ROWS) {
      expect(r.random).toBeGreaterThanOrEqual(r.balanced);
      expect(r.random).toBeLessThan(r.sorted);
    }
  });

  test('quiz: vị trí của khoá chèn cuối khớp với cây thật', () => {
    const node = build([8, 3, 10, 1, 6]).nodes[QUIZ_NEW];
    expect(node.parent).toBe(QUIZ_PARENT);
    expect(QUIZ_SIDE).toBe('phải');
  });
});
