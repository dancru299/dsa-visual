import { describe, expect, test } from 'vitest';
import type { Frame } from '@/src/engine/types';
import { bucketOf, hashKey, longestChain, type HashEvent, type HashState } from './algorithm';
import {
  ANAGRAMS,
  BIG_M,
  COLLISIONS,
  GROUP_BY,
  HASHING,
  hashTableLesson,
  LOOKUPS,
  M,
  MISSING,
  ORDERS,
  RESIZE,
  SKEW,
} from './lesson';

type F = Frame<HashState, HashEvent>;
const { steps } = hashTableLesson;
const built = steps.map((s) => ({ step: s, frames: s.build() as F[] }));
const answerOf = (f: F) => f.ask!.choices[f.ask!.correct];
const onlyAsk = (frames: F[]) => {
  const asks = frames.filter((f) => f.ask);
  expect(asks).toHaveLength(1);
  return asks[0];
};

describe('bài Hash table', () => {
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

  test('hàm hash: đáp án là ngăn mà "em" thật sự vào', () => {
    expect(answerOf(onlyAsk(HASHING))).toBe(String(bucketOf('em', M)));
  });

  test(`tra cứu: "${MISSING}" chỉ cần nhìn một ngăn, và ngăn đó rỗng`, () => {
    const f = onlyAsk(LOOKUPS);
    expect(answerOf(f)).toBe(String(bucketOf(MISSING, M)));
    const miss = LOOKUPS.find((x) => x.event.kind === 'miss')!;
    expect(miss.state.comparisons).toBe(0);
  });

  test('va chạm: đáp án là số lần so thật sự để tìm "nam"', () => {
    const f = onlyAsk(COLLISIONS);
    expect(f.event.kind).toBe('found');
    expect(answerOf(f)).toBe(String(f.state.comparisons));
    expect(f.state.comparisons).toBe(
      f.state.buckets[bucketOf('nam', M)].findIndex((e) => e.key === 'nam') + 1,
    );
  });

  test('resize: đáp án là ngăn mới của "nam", và chain ngắn lại', () => {
    expect(answerOf(onlyAsk(RESIZE))).toBe(String(hashKey('nam') % BIG_M));
    expect(longestChain(RESIZE.at(-1)!.state)).toBeLessThan(longestChain(RESIZE[0].state));
  });

  test('GROUP BY: số đếm khớp với đếm trực tiếp, câu đoán nằm ở lần gặp lại một khách', () => {
    const counts = new Map<string, number>();
    ORDERS.forEach((k) => counts.set(k, (counts.get(k) ?? 0) + 1));
    const groups = new Map(
      GROUP_BY.at(-1)!
        .state.buckets.flat()
        .map((e) => [e.key, e.value] as [string, number]),
    );
    expect(groups).toEqual(counts);
    expect(onlyAsk(GROUP_BY).event.kind).toBe('update');
  });

  test('hash lệch: mọi key chung một ngăn, đáp án là số lần so để tìm key cuối', () => {
    const f = onlyAsk(SKEW);
    expect(longestChain(f.state)).toBe(ANAGRAMS.length);
    expect(answerOf(f)).toBe(String(ANAGRAMS.length));
  });
});
