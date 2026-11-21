import { describe, expect, test } from 'vitest';
import type { Frame } from '@/src/engine/types';
import type { MergeEvent, MergeState } from './algorithm';
import {
  ARR,
  COST,
  CUSTOMER_IDS,
  FULL_SORT,
  JOIN,
  LEFT,
  MERGE_TWO,
  mergeSortLesson,
  ORDER_KEYS,
  RIGHT,
  SPLIT,
} from './lesson';

const { steps } = mergeSortLesson;
const built = steps.map((s) => ({ step: s, frames: s.build() as Frame<unknown, unknown>[] }));
const answerOf = (f: Frame<unknown>) => f.ask!.choices[f.ask!.correct];
const onlyAsk = <S, E>(frames: Frame<S, E>[]) => {
  const asks = frames.filter((f) => f.ask);
  expect(asks).toHaveLength(1);
  return asks[0];
};

describe('bài Merge sort', () => {
  test('mỗi bước có ít nhất hai frame, id không trùng, frame đầu không có câu đoán', () => {
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    for (const { step, frames } of built) {
      expect(frames.length, step.id).toBeGreaterThan(1);
      expect(frames[0].ask, step.id).toBeUndefined();
    }
  });

  test('mọi câu đoán có lựa chọn không trùng nhau', () => {
    for (const { frames } of built)
      for (const f of frames.filter((x) => x.ask))
        expect(new Set(f.ask!.choices).size).toBe(f.ask!.choices.length);
  });

  test('chia đôi: đáp án là số tầng chia thật sự', () => {
    expect(answerOf(onlyAsk(SPLIT))).toBe(String(SPLIT.at(-1)!.state.rows.length - 1));
  });

  test('trộn: đáp án là số thật sự được lấy ở frame đó', () => {
    const f = onlyAsk(MERGE_TWO);
    expect(f.event.kind).toBe('take');
    if (f.event.kind === 'take') expect(answerOf(f)).toBe(String(f.event.value));
    expect(MERGE_TWO.at(-1)!.state.rows[0][0].values).toEqual(
      [...LEFT, ...RIGHT].sort((a, b) => a - b),
    );
  });

  test('cả quá trình: đáp án bằng số lần so thật sự ở tầng trên cùng', () => {
    const f = onlyAsk(FULL_SORT as Frame<MergeState, MergeEvent>[]);
    const k = FULL_SORT.indexOf(f);
    const before = FULL_SORT[k].state.comparisons;
    const after = FULL_SORT.at(-1)!.state.comparisons;
    expect(answerOf(f)).toBe(String(after - before));
    expect(FULL_SORT.at(-1)!.state.rows[0][0].values).toEqual([...ARR].sort((a, b) => a - b));
  });

  test('chi phí: câu đoán nằm ở hàng 1 triệu', () => {
    const f = onlyAsk(COST);
    expect(f.state.rows[f.state.shown - 1].n).toBe(1_000_000);
  });

  test('merge join: câu đoán ở lần tiến j, và kết quả khớp với việc ghép từng cặp', () => {
    const f = onlyAsk(JOIN);
    expect(f.event.kind === 'compare' && f.event.rel).toBe('gt');
    const expected = ORDER_KEYS.flatMap((a, i) =>
      CUSTOMER_IDS.flatMap((b, j) => (a === b ? [[i, j]] : [])),
    );
    expect(JOIN.at(-1)!.state.pairs).toEqual(expected);
  });
});
